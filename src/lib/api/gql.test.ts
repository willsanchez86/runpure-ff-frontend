/** Data-layer tests (foundation spec §12): persisted-hash request shape and
 * errors-inside-HTTP-200 unwrapping. */
import { afterEach, expect, test, vi } from "vitest";
import { MeDocument } from "../../../generated/graphql";
import { gqlRequest, GqlError } from "./gql";

const okJson = (body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));

vi.stubEnv("NEXT_PUBLIC_API_URL", "http://test.local/graphql");

afterEach(() => {
  vi.unstubAllGlobals();
});

test("sends the APQ extension with the hex hash and no query text", async () => {
  const fetchMock = vi.fn((_url: string, _init?: RequestInit) =>
    okJson({ data: { me: null } }),
  );
  vi.stubGlobal("fetch", fetchMock);
  await gqlRequest(MeDocument, undefined);
  expect(fetchMock).toHaveBeenCalledOnce();
  const init = fetchMock.mock.calls[0]?.[1];
  const raw = typeof init?.body === "string" ? init.body : "{}";
  const body = JSON.parse(raw) as {
    query?: string;
    extensions: { persistedQuery: { sha256Hash: string } };
  };
  expect(body.query).toBeUndefined();
  expect(body.extensions.persistedQuery.sha256Hash).toMatch(/^[0-9a-f]{64}$/);
});

test("a non-empty errors array fails the request even on HTTP 200", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => okJson({ data: null, errors: [{ message: "denied" }] })),
  );
  const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  await expect(gqlRequest(MeDocument, undefined)).rejects.toThrow(GqlError);
  await expect(gqlRequest(MeDocument, undefined)).rejects.toThrow("denied");
  consoleSpy.mockRestore();
});

test("an HTTP error status fails with the status in the message", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(new Response("nope", { status: 429 }))),
  );
  await expect(gqlRequest(MeDocument, undefined)).rejects.toThrow("429");
});
