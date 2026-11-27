import { describe, expect, it } from "vitest";
import { defaultAiSettings, extractJson, planCommand, sanitizeOps } from "./agent";
import { historyCommit, historyInit, historyRedo, historyUndo } from "./history";
import { createProject } from "./project";
import { cuesToSrt, parseSrt } from "./srt";

describe("model plan sanitizing", () => {
  it("reads fenced JSON and drops unknown operations", () => {
    const parsed = extractJson('```json\n{"summary":"কাটা","ops":[{"op":"cutHead","seconds":"5"},{"op":"explode"}]}\n```');
    expect(sanitizeOps(parsed)).toEqual([{ op: "cutHead", seconds: 5 }]);
  });

  it("uses the model when it returns valid ops", async () => {
    const fetchImpl = async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '{"summary":"9:16","ops":[{"type":"aspect","aspect":"9:16"}]}' } }],
        }),
        { status: 200 },
      );
    const plan = await planCommand("make it vertical", createProject("t"), { ...defaultAiSettings, aiApiKey: "test-key" }, fetchImpl);
    expect(plan.source).toBe("model");
    expect(plan.ops).toEqual([{ op: "aspect", aspect: "9:16" }]);
  });

  it("falls back to the rules when the model replies with garbage", async () => {
    const fetchImpl = async () => new Response(JSON.stringify({ choices: [{ message: { content: "sorry" } }] }), { status: 200 });
    const plan = await planCommand(
      "প্রথম ৫ সেকেন্ড কেটে দাও",
      createProject("t"),
      { ...defaultAiSettings, aiApiKey: "test-key" },
      fetchImpl,
    );
    expect(plan.source).toBe("rules");
    expect(plan.fallbackReason).toBe("error");
    expect(plan.ops).toEqual([{ op: "cutHead", seconds: 5 }]);
  });

  it("does not call the network without a key", async () => {
    let called = false;
    const fetchImpl = async () => {
      called = true;
      return new Response("{}", { status: 200 });
    };
    const plan = await planCommand("mute", createProject("t"), defaultAiSettings, fetchImpl);
    expect(called).toBe(false);
    expect(plan.ops).toEqual([{ op: "mute", muted: true }]);
  });

  it("rejects insecure endpoints and still returns a rule plan", async () => {
    const plan = await planCommand("mute", createProject("t"), {
      ...defaultAiSettings,
      aiApiKey: "k",
      aiBaseUrl: "http://example.com/v1",
    });
    expect(plan.fallbackReason).toBe("endpoint");
    expect(plan.ops[0]).toMatchObject({ op: "mute" });
  });
});

describe("history", () => {
  it("undoes and redoes a project snapshot", () => {
    const first = createProject("এক");
    let state = historyInit(first);
    const second = { ...first, name: "দুই" };
    state = historyCommit(state, second);
    expect(state.present.name).toBe("দুই");
    state = historyUndo(state);
    expect(state.present.name).toBe("এক");
    state = historyRedo(state);
    expect(state.present.name).toBe("দুই");
    expect(historyCommit(state, second)).toBe(state);
  });
});

describe("srt", () => {
  it("round-trips cues", () => {
    const cues = [
      { id: "a", start: 0, end: 1.5, text: "হ্যালো" },
      { id: "b", start: 2, end: 3.25, text: "nSedo" },
    ];
    const parsed = parseSrt(cuesToSrt(cues));
    expect(parsed.map((cue) => [cue.start, cue.end, cue.text])).toEqual([
      [0, 1.5, "হ্যালো"],
      [2, 3.25, "nSedo"],
    ]);
  });
});
