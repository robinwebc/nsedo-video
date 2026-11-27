import { describe, expect, it } from "vitest";
import { planFromRules } from "./parser";

function ops(command: string) {
  return planFromRules(command).ops;
}

describe("rule parser", () => {
  it("cuts the first seconds from the Bangla example", () => {
    expect(ops("প্রথম ৫ সেকেন্ড কেটে দাও")).toEqual([{ op: "cutHead", seconds: 5 }]);
  });

  it("understands the English examples from the product brief", () => {
    expect(ops("cut the first 5 seconds")).toEqual([{ op: "cutHead", seconds: 5 }]);
    expect(ops("add Bangla subtitles")).toEqual([{ op: "captions", language: "bn", burnIn: true }]);
    expect(ops("make it 9:16 for Reels")).toEqual([{ op: "aspect", aspect: "9:16" }]);
    expect(ops("speed 1.5x")).toEqual([{ op: "speed", rate: 1.5 }]);
    expect(ops("add background music")).toEqual([{ op: "music", volume: 0.35, fadeIn: 0.8, fadeOut: 1.4 }]);
    expect(ops("remove silence")).toEqual([{ op: "removeSilence", thresholdDb: -35, minDuration: 0.4 }]);
    expect(ops("add text title")).toEqual([{ op: "text", text: "Title", position: "center", size: "lg" }]);
  });

  it("parses more Bangla commands", () => {
    expect(ops("শেষ ৩ সেকেন্ড বাদ দাও")).toEqual([{ op: "cutTail", seconds: 3 }]);
    expect(ops("স্পিড ১.৫x")).toEqual([{ op: "speed", rate: 1.5 }]);
    expect(ops("দেড় গুণ গতি")).toEqual([{ op: "speed", rate: 1.5 }]);
    expect(ops("দ্বিগুণ গতি")).toEqual([{ op: "speed", rate: 2 }]);
    expect(ops("মিউট করো")).toEqual([{ op: "mute", muted: true }]);
    expect(ops("নীরবতা সরাও")).toEqual([{ op: "removeSilence", thresholdDb: -35, minDuration: 0.4 }]);
    expect(ops("রিলসের জন্য ৯:১৬ করো")).toEqual([{ op: "aspect", aspect: "9:16" }]);
    expect(ops("ইউটিউবের জন্য ১৬:৯")).toEqual([{ op: "aspect", aspect: "16:9" }]);
    expect(ops("বর্গাকার করো")).toEqual([{ op: "aspect", aspect: "1:1" }]);
    expect(ops("৯০ ডিগ্রি ঘোরাও")).toEqual([{ op: "rotate", degrees: 90 }]);
    expect(ops("কালো সাদা করো")).toEqual([{ op: "filter", name: "mono" }]);
    expect(ops("উজ্জ্বল করো")).toEqual([{ op: "color", brightness: 0.08 }]);
    expect(ops("বাংলা সাবটাইটেল যোগ করো")).toEqual([{ op: "captions", language: "bn", burnIn: true }]);
    expect(ops("টাইটেল যোগ করো শুভ নববর্ষ")[0]).toMatchObject({ op: "text", text: "শুভ নববর্ষ" });
    expect(ops("৫ সেকেন্ডে ভাগ করো")).toEqual([{ op: "split", at: 5 }]);
    expect(ops("হাইলাইট রিল বানাও")).toEqual([{ op: "highlight", targetDuration: 15 }]);
    expect(ops("ভলিউম ৪০%")).toEqual([{ op: "volume", level: 0.4, mode: "set" }]);
  });

  it("keeps silence removal distinct from mute", () => {
    expect(ops("নীরবতা সরাও")[0].op).toBe("removeSilence");
    expect(ops("মিউট করো")[0].op).toBe("mute");
    expect(ops("remove silence")[0].op).toBe("removeSilence");
    expect(ops("mute")[0].op).toBe("mute");
  });

  it("combines clauses", () => {
    expect(ops("cut the first 2 seconds and make it 9:16")).toEqual([
      { op: "cutHead", seconds: 2 },
      { op: "aspect", aspect: "9:16" },
    ]);
    expect(ops("প্রথম ২ সেকেন্ড কাটো এবং স্পিড ২x")).toEqual([
      { op: "cutHead", seconds: 2 },
      { op: "speed", rate: 2 },
    ]);
  });

  it("does not treat black and white as two commands", () => {
    expect(ops("make it black and white")).toEqual([{ op: "filter", name: "mono" }]);
  });

  it("reports an empty plan for chatter", () => {
    const plan = planFromRules("hello there");
    expect(plan.ops).toEqual([]);
    expect(plan.language).toBe("en");
    expect(plan.summary.length).toBeGreaterThan(0);
  });

  it("summarizes Bangla plans in Bangla", () => {
    const plan = planFromRules("প্রথম ৫ সেকেন্ড কেটে দাও");
    expect(plan.language).toBe("bn");
    expect(plan.summary).toContain("কাটা");
    expect(plan.source).toBe("rules");
  });
});
