import { describe, expect, it } from "vitest";
import { applyOps, updateClip } from "./apply";
import { withIds } from "./ids";
import { createProject } from "./project";
import { timelineDuration } from "./time";
import type { Clip, Project } from "./types";

function clip(partial: Partial<Clip> = {}): Clip {
  return {
    id: "c1",
    name: "clip",
    sourceId: "s1",
    duration: 20,
    inPoint: 0,
    outPoint: 20,
    speed: 1,
    volume: 1,
    muted: false,
    rotate: 0,
    width: 1920,
    height: 1080,
    ...partial,
  };
}

function project(clips: Clip[]): Project {
  return { ...createProject("test"), id: "p1", clips };
}

describe("applyOps", () => {
  it("does not mutate the input project", () => {
    const input = project([clip()]);
    const snapshot = structuredClone(input);
    applyOps(input, [{ op: "cutHead", seconds: 5 }]);
    expect(input).toEqual(snapshot);
  });

  it("cuts the head in timeline seconds and respects speed", () => {
    const fast = applyOps(project([clip({ speed: 2 })]), [{ op: "cutHead", seconds: 5 }]).project;
    expect(fast.clips[0].id).toBe("c1");
    expect(fast.clips[0].inPoint).toBe(10);
    expect(fast.clips[0].outPoint).toBe(20);
    expect(timelineDuration(fast.clips)).toBe(5);
  });

  it("cuts a middle range into two clips", () => {
    const { project: next } = withIds(
      (() => {
        let n = 0;
        return () => `id${(n += 1)}`;
      })(),
      () => applyOps(project([clip()]), [{ op: "cut", start: 4, end: 8 }], { nextId: () => "right" }),
    );
    expect(next.clips.map((item) => [item.id, item.inPoint, item.outPoint])).toEqual([
      ["c1", 0, 4],
      ["right", 8, 20],
    ]);
  });

  it("cuts the tail and keeps a range", () => {
    const tailed = applyOps(project([clip()]), [{ op: "cutTail", seconds: 3 }]).project;
    expect(tailed.clips[0].outPoint).toBe(17);
    const kept = applyOps(project([clip()]), [{ op: "keep", start: 2, end: 9 }]).project;
    expect(kept.clips[0].inPoint).toBe(2);
    expect(kept.clips[0].outPoint).toBe(9);
  });

  it("splits, deletes, reorders, and reverses", () => {
    const split = applyOps(project([clip()]), [{ op: "split", at: 5 }], { nextId: () => "c2" }).project;
    expect(split.clips.map((item) => item.outPoint - item.inPoint)).toEqual([5, 15]);
    const removed = applyOps(split, [{ op: "deleteClip", clipId: "c1" }]).project;
    expect(removed.clips.map((item) => item.id)).toEqual(["c2"]);
    const two = project([clip({ id: "a" }), clip({ id: "b", sourceId: "s2" })]);
    expect(applyOps(two, [{ op: "reorder", clipIds: ["b", "a"] }]).project.clips.map((item) => item.id)).toEqual(["b", "a"]);
    expect(applyOps(two, [{ op: "reverseClips" }]).project.clips.map((item) => item.id)).toEqual(["b", "a"]);
    expect(applyOps(two, [{ op: "deleteClipIndex", index: 0 }]).project.clips.map((item) => item.id)).toEqual(["b"]);
  });

  it("applies speed, volume, mute, aspect, rotate, filter, colour, text, and music", () => {
    const { project: next } = applyOps(
      project([clip()]),
      [
        { op: "speed", rate: 8 },
        { op: "volume", level: 0.4, mode: "set" },
        { op: "mute", muted: true },
        { op: "aspect", aspect: "9:16" },
        { op: "rotate", degrees: 90 },
        { op: "rotate", degrees: 90 },
        { op: "filter", name: "warm" },
        { op: "color", brightness: 0.08 },
        { op: "text", text: "নববর্ষ", position: "center" },
        { op: "music", volume: 0.3, fadeIn: 1, fadeOut: 2 },
        { op: "captions", language: "bn", burnIn: true },
        { op: "quality", quality: "high" },
      ],
      { nextId: () => "t1" },
    );
    expect(next.clips[0].speed).toBe(4);
    expect(next.clips[0].volume).toBe(0.4);
    expect(next.clips[0].muted).toBe(true);
    expect(next.clips[0].rotate).toBe(180);
    expect(next.aspect).toBe("9:16");
    expect(next.filter).toBe("warm");
    expect(next.color.brightness).toBe(0.08);
    expect(next.texts[0]).toMatchObject({ id: "t1", text: "নববর্ষ", position: "center" });
    expect(next.musicPending).toEqual({ volume: 0.3, fadeIn: 1, fadeOut: 2 });
    expect(next.captionsBurnIn).toBe(true);
    expect(next.captionLanguage).toBe("bn");
    expect(next.quality).toBe("high");
    expect(timelineDuration(next.clips)).toBe(5);
  });

  it("updates music that is already attached and clamps trim handles", () => {
    const base = project([clip()]);
    base.music = { sourceId: "m", name: "song.mp3", volume: 0.5, fadeIn: 0, fadeOut: 0 };
    const next = applyOps(base, [{ op: "music", fadeIn: 2 }]).project;
    expect(next.music).toMatchObject({ sourceId: "m", fadeIn: 2, volume: 0.5 });
    const trimmed = updateClip(base, "c1", { inPoint: 18, outPoint: 19 });
    expect(trimmed.clips[0].inPoint).toBe(18);
    expect(trimmed.clips[0].outPoint).toBe(19);
  });

  it("applies sequential cuts from the end without shifting earlier ranges", () => {
    const { project: next } = applyOps(project([clip({ duration: 10, outPoint: 10 })]), [
      { op: "cut", start: 6, end: 8 },
      { op: "cut", start: 2, end: 4 },
    ]);
    expect(timelineDuration(next.clips)).toBe(6);
    expect(next.clips.map((item) => [item.inPoint, item.outPoint])).toEqual([
      [0, 2],
      [4, 6],
      [8, 10],
    ]);
  });
});
