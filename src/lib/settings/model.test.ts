/** Settings sanitizer tests (foundation spec §8/§12: the prototype's load
 * rules — legacy ranges migrate, unknown columns drop, invalid sort resets). */
import { expect, test } from "vitest";
import { defaultSettings, sanitizeSettings } from "./model";

test("garbage input returns defaults", () => {
  expect(sanitizeSettings(null, 9)).toEqual(defaultSettings(9));
  expect(sanitizeSettings("nope", 9)).toEqual(defaultSettings(9));
});

test("legacy range values collapse to season", () => {
  const sanitized = sanitizeSettings({ range: "l5" }, 9);
  expect(sanitized.range).toBe("season");
});

test("unknown or removed column keys are dropped; empty sets restore defaults", () => {
  const sanitized = sanitizeSettings({ cols: ["total", "last3", "nope"] }, 9);
  expect(sanitized.cols).toEqual(["total"]);
  const empty = sanitizeSettings({ cols: ["last3"] }, 9);
  expect(empty.cols).toEqual(defaultSettings(9).cols);
});

test("an invalid sort key resets to the default sort", () => {
  const sanitized = sanitizeSettings({ sort: ["last3", -1] }, 9);
  expect(sanitized.sort).toEqual(defaultSettings(9).sort);
  const kept = sanitizeSettings({ sort: ["total", 1] }, 9);
  expect(kept.sort).toEqual(["total", 1]);
});

test("week bounds clamp into 1..18", () => {
  const sanitized = sanitizeSettings({ cwkFrom: -3, cwkTo: 99, minGp: 40 }, 9);
  expect(sanitized.cwkFrom).toBe(1);
  expect(sanitized.cwkTo).toBe(18);
  expect(sanitized.minGp).toBe(18);
});
