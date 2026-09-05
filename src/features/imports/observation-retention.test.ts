import { describe, expect, it } from "vitest";
import {
  OBSERVATION_RETENTION_DAYS,
  observationPurgeCutoffIso,
  observationsDueForPurge,
} from "./observation-retention";

describe("30-day observation image retention", () => {
  it("purges images captured 30 days ago and keeps newer ones", () => {
    expect(OBSERVATION_RETENTION_DAYS).toBe(30);
    const now = new Date("2026-09-04T08:00:00.000Z");
    const cutoff = observationPurgeCutoffIso(now);
    expect(cutoff).toBe("2026-08-05T08:00:00.000Z");

    const due = observationsDueForPurge(
      [
        {
          id: "old",
          capturedAt: "2026-08-04T08:00:00.000Z",
          storagePath: "u1/old.jpg",
        },
        {
          id: "edge",
          capturedAt: "2026-08-05T08:00:00.000Z",
          storagePath: "u1/edge.jpg",
        },
        {
          id: "fresh",
          capturedAt: "2026-09-01T08:00:00.000Z",
          storagePath: "u1/fresh.jpg",
        },
        {
          id: "no-image",
          capturedAt: "2026-07-01T08:00:00.000Z",
          storagePath: null,
        },
      ],
      now,
    );
    expect(due.map((row) => row.id).sort()).toEqual(["edge", "old"]);
  });
});
