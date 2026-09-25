import { describe, it, expect } from "vitest";
import { cameraFailureCategory, readQaVisit, entryCampaign } from "./scan-diagnostics";

describe("anonymous scan diagnostics", () => {
  it("keeps explicit QA within the tab across navigation, without treating campaign traffic as QA", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v); } };
    expect(readQaVisit("?utm_campaign=shelf_lv_pilot_02", storage)).toBe(false);
    expect(readQaVisit("?qa=1", storage)).toBe(true);
    expect(readQaVisit("", storage)).toBe(true);
    const blocked = { getItem: () => { throw new Error(); }, setItem: () => { throw new Error(); } };
    expect(readQaVisit("?qa=1", blocked)).toBe(true);
  });
  it("classifies expected camera failures without retaining messages", () => {
    expect(cameraFailureCategory(new DOMException("private", "NotAllowedError"))).toBe("camera_denied");
    expect(cameraFailureCategory(new DOMException("private", "NotReadableError"))).toBe("camera_busy");
    expect(cameraFailureCategory(new Error("private"))).toBe("camera_start_failed");
  });
});

it("keeps entry campaign in this tab rather than inheriting old localStorage attribution", () => {
  const map = new Map<string, string>();
  const storage = { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => { map.set(k, v); } };
  expect(entryCampaign("?utm_campaign=shelf_lv_pilot_02", storage)).toBe("shelf_lv_pilot_02");
  expect(entryCampaign("", storage)).toBe("shelf_lv_pilot_02");
  map.clear();
  expect(entryCampaign("", storage)).toBe("");
  expect(entryCampaign("?utm_campaign=later_navigation", storage)).toBe("");
});
