// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Architecture rules — see web/src/ARCHITECTURE.md.
 *
 * These import boundaries enforce the layer model:
 *   1. shared/* must not import from features/*
 *   2. features/* must not reach into another feature's internals
 *   3. shared/* must not import from app/*
 *
 * To bypass an architectural rule for a specific file, the ESLint
 * disable comment must include a justification.
 */
const ARCH_BOUNDARIES = {
  // shared/ is reusable presentation. It cannot know about features.
  "shared-cannot-import-features": {
    files: ["src/shared/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/features/*"],
              message:
                "shared/* cannot import from features/*. Move the dependency to shared/ or invert the relationship.",
            },
            {
              group: ["@/app/*"],
              message: "shared/* cannot import from app/*.",
            },
          ],
        },
      ],
    },
  },

  // core/ is infrastructure. It cannot know about features or app routes.
  "core-cannot-import-features-or-app": {
    files: ["src/core/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/features/*"],
              message: "core/* cannot import from features/*.",
            },
            {
              group: ["@/app/*"],
              message: "core/* cannot import from app/*.",
            },
            {
              group: ["@/components/*"],
              message:
                "core/* cannot import from components/*. Use shared/ primitives instead.",
            },
          ],
        },
      ],
    },
  },

  // Features may not reach into another feature's internals — only the public index.
  "features-public-api-only": {
    files: ["src/features/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              // @/features/<other>/anything-but-the-root
              // Allow @/features/<self>/... because we can't easily check
              // which feature this file belongs to via patterns alone;
              // we rely on code review to catch self-deep-imports for now.
              group: ["@/features/*/*/*", "@/features/*/components/*", "@/features/*/api/*", "@/features/*/hooks/*", "@/features/*/state/*", "@/features/*/workspaces/*"],
              message:
                "Cross-feature imports must go through the feature's public index.ts (e.g. import from '@/features/attendance', not '@/features/attendance/api/...').",
            },
          ],
        },
      ],
    },
  },
};

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
  ...storybook.configs["flat/recommended"],
  ARCH_BOUNDARIES["shared-cannot-import-features"],
  ARCH_BOUNDARIES["core-cannot-import-features-or-app"],
  ARCH_BOUNDARIES["features-public-api-only"],
]);

export default eslintConfig;
