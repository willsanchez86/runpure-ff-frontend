/** Sign-in screen tests (foundation spec §5): stub mode without Firebase env. */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import SignInPage from "./page";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

test("sample mode offers the labelled stub sign-in and lands in the app", async () => {
  render(
    <AuthProvider>
      <SignInPage />
    </AuthProvider>,
  );
  const button = await screen.findByRole("button", {
    name: "Continue (sample mode)",
  });
  expect(
    screen.getByText(/Invite only — accounts are created by the owner/),
  ).toBeInTheDocument();
  await userEvent.click(button);
  expect(replace).toHaveBeenCalledWith("/players");
});
