import { intervalMinutes, subtractIntervals } from "./time";
import type {
  Connectivity,
  FocusWindow,
  Meeting,
  TaskKind,
  TravelBlock,
  TravelKind,
} from "./types";

export const DEFAULT_MIN_FOCUS_MINUTES = 20;

export interface FocusWindowOptions {
  /** Gaps shorter than this are ignored. */
  minMinutes?: number;
}

interface Classification {
  suitedFor: TaskKind[];
  workStyle: string;
}

/**
 * Which kinds of work suit a window. Length matters most; the setting then
 * nudges it (a car ride is never deep work, a long flight always is).
 */
export const classifyWindow = (kind: TravelKind, minutes: number): Classification => {
  if (kind === "ride") {
    return { suitedFor: ["light", "quick"], workStyle: "Light tasks" };
  }
  if (minutes >= 120 && (kind === "flight" || kind === "train")) {
    return { suitedFor: ["deep", "quick", "light"], workStyle: "Deep work" };
  }
  if (minutes >= 45) {
    return { suitedFor: ["quick", "light", "deep"], workStyle: "Quick tasks" };
  }
  return { suitedFor: ["light", "quick"], workStyle: "Light tasks" };
};

const isHardCommitment = (m: Meeting) => m.kind === "meeting";

/**
 * Detect usable work windows: the parts of focusable travel blocks that are
 * not taken by meetings and are at least `minMinutes` long.
 */
export const detectFocusWindows = (
  travelBlocks: TravelBlock[],
  meetings: Meeting[],
  { minMinutes = DEFAULT_MIN_FOCUS_MINUTES }: FocusWindowOptions = {},
): FocusWindow[] => {
  const commitments = meetings.filter(isHardCommitment);
  const windows: FocusWindow[] = [];

  for (const block of travelBlocks) {
    if (!block.focusable) continue;

    const free = subtractIntervals(block, commitments);
    free.forEach((interval, index) => {
      const minutes = intervalMinutes(interval);
      if (minutes < minMinutes) return;
      const { suitedFor, workStyle } = classifyWindow(block.kind, minutes);
      windows.push({
        id: `${block.id}:${index}`,
        blockId: block.id,
        kind: block.kind,
        start: interval.start,
        end: interval.end,
        minutes,
        connectivity: block.connectivity,
        suitedFor,
        workStyle,
      });
    });
  }

  return windows;
};

export const travelKindLabel = (kind: TravelKind): string => {
  switch (kind) {
    case "ride":
      return "Ride";
    case "security":
      return "Security";
    case "gate":
      return "Gate";
    case "boarding":
      return "Boarding";
    case "flight":
      return "Flight";
    case "train":
      return "Train";
    case "hotel":
      return "Hotel";
  }
};

export const connectivityLabel = (connectivity: Connectivity): string => {
  switch (connectivity) {
    case "wifi":
      return "Wi‑Fi";
    case "cellular":
      return "cellular";
    case "offline":
      return "offline";
  }
};

export const taskKindLabel = (kind: TaskKind): string => {
  switch (kind) {
    case "deep":
      return "deep work";
    case "quick":
      return "quick task";
    case "light":
      return "light task";
  }
};

/** Sum of minutes across windows that have at least one task assigned. */
export const plannedFocusMinutes = (
  windows: FocusWindow[],
  assignedWindowIds: Iterable<string>,
): number => {
  const assigned = new Set(assignedWindowIds);
  return windows
    .filter((w) => assigned.has(w.id))
    .reduce((sum, w) => sum + w.minutes, 0);
};
