/** Shell nav tests (foundation spec §10): live links, no-dead-ends stubs. */
import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { Nav } from "./Nav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/players",
}));

test("live screens are links; Players is current", () => {
  render(<Nav />);
  expect(screen.getByRole("link", { name: "Players" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  expect(screen.getByRole("link", { name: "NFL" })).toHaveAttribute(
    "href",
    "/nfl",
  );
});

test("later-phase items are visible but not clickable", () => {
  render(<Nav />);
  for (const label of [
    "Game day",
    "Waivers & trades",
    "Weekly review",
    "Leagues",
  ]) {
    const item = screen.getByText(label, { selector: "[aria-disabled]" });
    expect(item).toHaveAttribute("aria-disabled", "true");
    expect(item.closest("a")).toBeNull();
  }
});
