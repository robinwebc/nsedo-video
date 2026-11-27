import { describe, expect, it } from "vitest";
import {
  atempoChain,
  chooseEncoder,
  clipAudioFilters,
  clipRenderArgs,
  clipVideoFilters,
  encoderArgs,
  frameSize,
  musicFilter,
  parseEncoderList,
} from "./exportPlan";
import { createProject } from "./project";
import type { Clip, Project } from "./types";

function clip(partial: Partial<Clip> = {}): Clip {
  return {
    id: "c1",
    name: "clip",
    sourceId: "s1",
    duration: 8,
    inPoint: 1,
    outPoint: 6,
    speed: 1,
    volume: 1,
    muted: false,
    rotate: 0,
    width: 1920,
    height: 1080,
    ...partial,
  };
}

function base(partial: Partial<Project> = {}): Project {
  return { ...createProject("t"), clips: [clip()], ...partial };
}

describe("export plan", () => {
  it("picks frame sizes for the aspect and quality presets", () => {
    expect(frameSize(base({ aspect: "9:16", quality: "standard" }))).toEqual({ width: 1080, height: 1920 });
    expect(frameSize(base({ aspect: "16:9", quality: "draft" }))).toEqual({ width: 1280, height: 720 });
    expect(frameSize(base({ aspect: "1:1", quality: "high" }))).toEqual({ width: 1080, height: 1080 });
    expect(frameSize(base({ aspect: "original", quality: "draft" }))).toEqual({ width: 1280, height: 720 });
  });

  it("chains atempo inside the supported range", () => {
    expect(atempoChain(4)).toBe("atempo=2,atempo=2");
    expect(atempoChain(0.25)).toBe("atempo=0.5,atempo=0.5");
  });

  it("builds video and audio filters from the project", () => {
    const project = base({
      aspect: "9:16",
      filter: "mono",
      color: { brightness: 0.1, contrast: 0.2, saturation: 0 },
    });
    project.clips = [clip({ speed: 1.5, rotate: 90, muted: true })];
    const size = frameSize(project);
    const video = clipVideoFilters(project.clips[0], project, size);
    expect(video).toContain("transpose=1");
    expect(video).toContain("setpts=");
    expect(video).toContain("crop=1080:1920");
    expect(video).toContain("hue=s=0");
    expect(video).toContain("brightness=0.1");
    expect(clipAudioFilters(project.clips[0])).toContain("volume=0");
    expect(clipAudioFilters(project.clips[0])).toContain("atempo=1.5");
  });

  it("selects an encoder and emits quality-specific arguments", () => {
    expect(chooseEncoder(["mpeg4", "libx264", "aac"])).toBe("libx264");
    expect(chooseEncoder(["libopenh264"])).toBe("libopenh264");
    expect(chooseEncoder(["aac"])).toBe("mpeg4");
    expect(encoderArgs("libx264", "high")).toContain("18");
    expect(encoderArgs("libx264", "draft")).toContain("30");
    expect(encoderArgs("mpeg4", "standard")).toContain("5");
  });

  it("trims with input seeking and fades music", () => {
    const project = base();
    const args = clipRenderArgs("in.mp4", "out.mp4", project.clips[0], project, frameSize(project), "libx264");
    expect(args.slice(0, 6)).toEqual(["-ss", "1", "-to", "6", "-i", "in.mp4"]);
    expect(args.at(-1)).toBe("out.mp4");
    const filter = musicFilter(12, { sourceId: "m", name: "a.mp3", volume: 0.35, fadeIn: 1, fadeOut: 2 });
    expect(filter).toContain("afade=t=in:st=0:d=1");
    expect(filter).toContain("afade=t=out:st=10:d=2");
    expect(filter).toContain("volume=0.35");
  });

  it("reads encoder names from ffmpeg -encoders output", () => {
    const log = " V..... libx264             H.264\n A..... aac                 AAC\n";
    expect(parseEncoderList(log)).toContain("libx264");
  });
});
