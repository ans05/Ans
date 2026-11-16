import { describe, expect, it } from "vitest";

import {
  draftRescheduleTemplate,
  findClashes,
  quietHoursOverlap,
  suggestAlternativeSlot,
} from "./timezoneShield";
import { DUBAI, HONOLULU, LA, LONDON, meeting, TOKYO, trip, user } from "./testing/fixtures";

const ldn = (start: string, end: string) => meeting({ start: `2026-10-15T${start}:00+01:00`, end: `2026-10-15T${end}:00+01:00`, zone: LONDON });

describe("quietHoursOverlap", () => {
  it("is exact at the 10 pm boundary", () => {
    expect(quietHoursOverlap(ldn("21:00", "22:00"), LONDON)).toBeNull();
    expect(quietHoursOverlap(ldn("21:30", "22:01"), LONDON)).toBe("late");
    expect(quietHoursOverlap(ldn("22:00", "23:00"), LONDON)).toBe("late");
  });

  it("is exact at the 7 am boundary", () => {
    expect(quietHoursOverlap(ldn("07:00", "08:00"), LONDON)).toBeNull();
    expect(quietHoursOverlap(ldn("06:59", "07:30"), LONDON)).toBe("early");
    expect(quietHoursOverlap(ldn("00:30", "01:00"), LONDON)).toBe("early");
  });

  it("flags meetings that run past midnight or end exactly on it", () => {
    expect(quietHoursOverlap(meeting({ start: "2026-10-15T23:30:00+01:00", end: "2026-10-16T00:30:00+01:00" }), LONDON)).toBe("late");
    expect(quietHoursOverlap(meeting({ start: "2026-10-15T21:00:00+01:00", end: "2026-10-16T00:00:00+01:00" }), LONDON)).toBe("late");
  });

  it("judges by the destination's clock, not the organiser's", () => {
    const threePmPacific = meeting({ start: "2026-10-15T15:00:00-07:00", end: "2026-10-15T16:00:00-07:00" });
    expect(quietHoursOverlap(threePmPacific, LONDON)).toBe("late");
    expect(quietHoursOverlap(threePmPacific, LA)).toBeNull();
  });
});

describe("findClashes", () => {
  const sample = [
    meeting({ id: "metrics", title: "Metrics", start: "2026-10-15T15:00:00-07:00", end: "2026-10-15T16:00:00-07:00", organizer: "Marco" }),
    meeting({ id: "advisor", title: "Advisor", start: "2026-10-14T16:30:00-07:00", end: "2026-10-14T17:00:00-07:00" }),
    meeting({ id: "outbound-day", start: "2026-10-13T15:00:00-07:00", end: "2026-10-13T16:00:00-07:00" }),
    meeting({ id: "after-trip", start: "2026-10-20T15:00:00-07:00", end: "2026-10-20T16:00:00-07:00" }),
    meeting({ id: "own-block", kind: "task-block", start: "2026-10-15T15:00:00-07:00", end: "2026-10-15T16:00:00-07:00" }),
    meeting({ id: "local-morning", zone: LONDON, start: "2026-10-15T09:30:00+01:00", end: "2026-10-15T12:30:00+01:00" }),
  ];

  it("flags only meetings in quiet hours on days spent in the destination", () => {
    const clashes = findClashes(sample, trip());
    expect(clashes.map((c) => c.meeting.id)).toEqual(["advisor", "metrics"]);
  });

  it("describes each clash in local terms", () => {
    const [advisor, metrics] = findClashes(sample, trip());
    expect(advisor).toMatchObject({ reason: "early", localDay: "2026-10-15", localStart: "12:30 am", localEnd: "1:00 am" });
    expect(metrics).toMatchObject({ reason: "late", localDay: "2026-10-15", localStart: "11:00 pm", localEnd: "12:00 am" });
  });

  it("follows the destination through its DST change", () => {
    const late = trip({
      start: "2026-10-21",
      end: "2026-10-30",
      days: Array.from({ length: 10 }, (_, i) => ({ date: `2026-10-${21 + i}`, zone: LONDON, city: "London" })),
    });
    const meetings = [
      meeting({ id: "before", start: "2026-10-22T15:00:00-07:00", end: "2026-10-22T16:00:00-07:00" }), // 11 pm BST
      meeting({ id: "after", start: "2026-10-29T15:00:00-07:00", end: "2026-10-29T16:00:00-07:00" }), // 10 pm GMT
      meeting({ id: "after-ok", start: "2026-10-29T14:00:00-07:00", end: "2026-10-29T15:00:00-07:00" }), // 9–10 pm GMT
    ];
    const clashes = findClashes(meetings, late);
    expect(clashes.map((c) => [c.meeting.id, c.localStart])).toEqual([
      ["before", "11:00 pm"],
      ["after", "10:00 pm"],
    ]);
  });
});

describe("suggestAlternativeSlot", () => {
  const clash = findClashes([meeting({ start: "2026-10-15T15:00:00-07:00", end: "2026-10-15T16:00:00-07:00" })], trip())[0]!;

  it("finds the first hour inside working hours in both zones", () => {
    expect(suggestAlternativeSlot(clash, LA)).toMatchObject({
      home: "9:00 am – 10:00 am PDT",
      destination: "5:00 pm – 6:00 pm BST",
    });
  });

  it("accepts the last hour of the home working day", () => {
    // 9 am in Tokyo is 5 pm the previous day in San Francisco: still inside 9–6.
    const slot = suggestAlternativeSlot({ ...clash, zone: TOKYO }, LA);
    expect(slot?.destination.startsWith("9:00 am – 10:00 am")).toBe(true);
    expect(slot?.home).toBe("5:00 pm – 6:00 pm PDT");
  });

  it("gives up when working hours never overlap", () => {
    expect(suggestAlternativeSlot({ ...clash, zone: DUBAI }, HONOLULU)).toBeNull();
  });
});

describe("draftRescheduleTemplate", () => {
  const t = trip();

  it("asks to move a movable meeting and names a slot that suits both sides", () => {
    const [clash] = findClashes([meeting({ title: "Weekly metrics review", organizer: "Marco", start: "2026-10-15T15:00:00-07:00", end: "2026-10-15T16:00:00-07:00" })], t);
    const note = draftRescheduleTemplate(clash!, t, user);
    expect(note).toContain("Hi Marco,");
    expect(note).toContain("London Oct 13 – 17");
    expect(note).toContain("3:00 pm PDT");
    expect(note).toContain("11:00 pm BST");
    expect(note).toContain("9:00 am – 10:00 am PDT");
    expect(note.trim().endsWith("Alex")).toBe(true);
  });

  it("offers to catch the recording when the meeting cannot move", () => {
    const [clash] = findClashes([meeting({ title: "All-hands", movable: false, start: "2026-10-16T14:00:00-07:00", end: "2026-10-16T15:00:00-07:00" })], t);
    const note = draftRescheduleTemplate(clash!, t, user);
    expect(note).toContain("Hi all,");
    expect(note).toContain("recording");
    expect(note).not.toContain("Could we");
  });
});
