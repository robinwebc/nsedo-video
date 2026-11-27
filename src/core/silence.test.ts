import { describe, expect, it } from "vitest";
import { applyOps } from "./apply";
import { createProject } from "./project";
import { keepsToCutOps, offsetSilence, parseSilenceLog, planHighlight, safeSilenceCuts } from "./silence";
import { timelineDuration } from "./time";
import type { Clip } from "./types";

const clip: Clip = {
  id: "c1",
  name: "clip",
  sourceId: "s1",
  duration: 10,
  inPoint: 0,
  outPoint: 10,
  speed: 1,
  volume: 1,
  muted: false,
  rotate: 0,
  width: 1280,
  height: 720,
};

describe("silence planning", () => {
  it("parses ffmpeg silence logs", () => {
    const log = "silence_start: 1.5\nsilence_end: 3.25\nsilence_start: 8\n";
    expect(parseSilenceLog(log, 10)).toEqual([
      { start: 1.5, end: 3.25 },
      { start: 8, end: 10 },
    ]);
  });

  it("maps source silence onto the timeline when a clip is sped up", () => {
    expect(offsetSilence([{ start: 2, end: 4 }], 5, 2)).toEqual([{ start: 6, end: 7 }]);
  });

  it("turns silence into cuts that leave the audible parts", () => {
    const cuts = safeSilenceCuts(
      [
        { start: 2, end: 4 },
        { start: 6, end: 8 },
      ],
      10,
    );
    const project = { ...createProject("t"), clips: [clip] };
    const next = applyOps(project, cuts).project;
    expect(timelineDuration(next.clips)).toBe(6);
  });

  it("refuses to delete an entire clip when everything is silence", () => {
    expect(safeSilenceCuts([{ start: 0, end: 10 }], 10)).toEqual([]);
  });

  it("builds a highlight from the longest audible stretches", () => {
    const audible = [
      { start: 0, end: 2 },
      { start: 3, end: 9 },
      { start: 12, end: 14 },
    ];
    const keeps = planHighlight(audible, 20, 8);
    expect(keeps).toEqual([
      { start: 0, end: 2 },
      { start: 3, end: 9 },
    ]);
    const cuts = keepsToCutOps(keeps, 20);
    const project = {
      ...createProject("t"),
      clips: [{ ...clip, duration: 20, outPoint: 20 }],
    };
    expect(timelineDuration(applyOps(project, cuts).project.clips)).toBe(8);
  });
});
