/** Hand-written GraphQL request layer (foundation spec §6.1, ADR-0019):
 * fetch + Firebase ID token + persisted-operation hash + errors-in-200 unwrap.
 * Caching belongs to TanStack Query; this module only performs one request. */
import type { TypedDocumentNode } from "@graphql-typed-document-node/core";
import { getFirebaseAuth, isFirebaseConfigured } from "@/lib/auth/firebase";

/** A GraphQL error entry as the endpoint reports it. */
interface GraphQLErrorShape {
  message: string;
}

/** Thrown when the endpoint reports errors — including inside an HTTP 200
 * (ADR-0017); callers surface `message` in the screen's error state. */
export class GqlError extends Error {
  /** Operation name, for logging (system design §4). */
  readonly operation: string;
  constructor(operation: string, message: string) {
    super(message);
    this.name = "GqlError";
    this.operation = operation;
  }
}

/** Read at call time so tests can stub it; Next inlines it in app builds. */
function apiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "";
}

/** The generated documents carry `__meta__.hash` ("sha256:<hex>") when the
 * persisted-documents preset is on; narrow it here without `any`. */
function documentMeta(document: unknown): { hash?: string } {
  if (
    typeof document === "object" &&
    document !== null &&
    "__meta__" in document
  ) {
    return (document as { __meta__: { hash?: string } }).__meta__;
  }
  return {};
}

function operationName(document: unknown): string {
  const doc = document as {
    definitions?: { name?: { value?: string } }[];
  };
  return doc.definitions?.[0]?.name?.value ?? "unknown";
}

async function idToken(): Promise<string | null> {
  if (!isFirebaseConfigured) return null;
  const auth = await getFirebaseAuth();
  const user = auth.currentUser;
  return user ? user.getIdToken() : null;
}

/**
 * Executes one persisted GraphQL operation and returns its typed data.
 * Sends the APQ extension (`extensions.persistedQuery.sha256Hash`, hex without
 * the manifest's "sha256:" prefix) — the format the backend's store expects.
 */
export async function gqlRequest<TData, TVariables>(
  document: TypedDocumentNode<TData, TVariables>,
  variables?: TVariables,
): Promise<TData> {
  const op = operationName(document);
  // manifest keys carry a "sha256:" prefix; APQ wants bare hex
  const hash = documentMeta(document).hash?.replace(/^sha256:/, "");
  if (!hash) throw new GqlError(op, "Operation has no persisted hash.");
  const url = apiUrl();
  if (!url) throw new GqlError(op, "NEXT_PUBLIC_API_URL is not set.");

  const token = await idToken();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      ...(variables === undefined ? {} : { variables }),
      extensions: { persistedQuery: { version: 1, sha256Hash: hash } },
    }),
  });

  if (!res.ok) {
    throw new GqlError(op, `API responded ${String(res.status)}.`);
  }
  const envelope = (await res.json()) as {
    data?: TData;
    errors?: GraphQLErrorShape[];
  };
  if (envelope.errors && envelope.errors.length > 0) {
    // GraphQL can fail inside an HTTP 200 — log by operation name (ADR-0017).
    console.error(`GraphQL errors in ${op}:`, envelope.errors);
    throw new GqlError(op, envelope.errors[0]?.message ?? "Request failed.");
  }
  if (envelope.data === undefined) {
    throw new GqlError(op, "Empty response.");
  }
  return envelope.data;
}
