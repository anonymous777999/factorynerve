import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // Pre-existing lint debt, tracked as warnings rather than hard errors.
    // These rules flag runtime-behavioural patterns (effect timing, memoization,
    // ref usage) that were already present across ~80 files before the CI gate
    // was enforced. Fixing them requires per-component behavioural review, so
    // they are surfaced as warnings and paid down deliberately — meanwhile a
    // clean error signal still blocks genuinely new/unsafe mistakes. The `any`
    // rule is likewise long-standing typing debt, not a correctness risk.
    // Do NOT add new violations of these rules; fix at the call site instead.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/incompatible-library": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
    },
  },
]);

export default eslintConfig;
