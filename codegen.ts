/** GraphQL Code Generator (ADR-0016; foundation spec §6.2): client-preset types
 * for the operations in graphql/, plus the persisted-documents manifest the
 * backend's trusted-documents store loads (copied by scripts/persisted-copy.mjs). */
import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  schema: "schema.graphql",
  documents: ["graphql/**/*.graphql"],
  generates: {
    "generated/": {
      preset: "client",
      presetConfig: {
        persistedDocuments: true,
      },
    },
  },
};

export default config;
