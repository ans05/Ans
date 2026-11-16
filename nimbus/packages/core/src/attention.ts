import { formatTime } from "./time";
import type { Attention, Checklist, Clash, LeavePlan } from "./types";

export interface AttentionInput {
  leavePlan: LeavePlan | null;
  clashes: Clash[];
  checklist: Checklist | null;
  destinationCity: string;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/**
 * Decide the single thing the mascot should point at, or nothing.
 * Time-critical first, then conflicts, then preparation.
 */
export const deriveAttention = ({
  leavePlan,
  clashes,
  checklist,
  destinationCity,
}: AttentionInput): Attention | null => {
  if (leavePlan && (leavePlan.status === "soon" || leavePlan.status === "now" || leavePlan.status === "late")) {
    const at = formatTime(leavePlan.leaveAt, leavePlan.flight.from.zone);
    const code = leavePlan.flight.from.code;
    const delay = leavePlan.flight.delayMinutes ?? 0;
    const delayNote = delay > 0 ? `${leavePlan.flight.number} is delayed ${delay}m. ` : "";
    const message =
      leavePlan.status === "late"
        ? `${delayNote}You should be on your way to ${code}.`
        : leavePlan.status === "now"
          ? `${delayNote}Time to leave for ${code}.`
          : `${delayNote}Leave for ${code} by ${at}.`;
    return { id: `leave:${leavePlan.flight.id}`, tone: "warning", message, href: "/", cta: "See the plan" };
  }

  if (clashes.length > 0) {
    const n = clashes.length;
    return {
      id: `clash:${clashes.map((c) => c.meeting.id).join(",")}`,
      tone: "warning",
      message: `${n} ${plural(n, "meeting lands", "meetings land")} overnight in ${destinationCity}.`,
      href: "/shield",
      cta: "Review",
    };
  }

  if (checklist?.active) {
    const remaining = checklist.items.filter((i) => !i.done).length;
    if (remaining > 0) {
      return {
        id: `prep:${checklist.flight.id}`,
        tone: "info",
        message: `${remaining} ${plural(remaining, "item", "items")} to download before you fly.`,
        href: "/prep",
        cta: "Open checklist",
      };
    }
  }

  return null;
};
