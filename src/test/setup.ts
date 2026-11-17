/** Test setup: jest-dom matchers + DOM cleanup between tests (auto-cleanup
 * needs explicit registration because Vitest globals are off). */
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});
