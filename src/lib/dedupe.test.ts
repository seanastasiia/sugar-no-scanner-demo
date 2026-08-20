import { describe, expect, it } from "vitest";
import { mergeDetectionTray } from "./dedupe";

describe("mergeDetectionTray", () => {
  it("adds a product once and suppresses repeat detections", () => {
    const first = mergeDetectionTray([], new Map(), ["bar-1"], 1_000);
    const second = mergeDetectionTray(first.tray, first.seen, ["bar-1"], 2_000);
    expect(first.added).toEqual(["bar-1"]);
    expect(second.added).toEqual([]);
    expect(second.tray).toEqual(["bar-1"]);
  });

  it("keeps distinct products from one shelf frame", () => {
    const result = mergeDetectionTray([], new Map(), ["bar-1", "bar-2"], 1_000);
    expect(result.tray).toEqual(["bar-1", "bar-2"]);
  });
});
