import path from "node:path";
import { fileURLToPath } from "node:url";

import type { StorybookConfig } from "@storybook/nextjs-vite";

const storybookDirectory = path.dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
  stories: ["../src/components/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-a11y"],
  framework: {
    name: "@storybook/nextjs-vite",
    options: {
      nextConfigPath: path.resolve(storybookDirectory, "../next.config.ts"),
    },
  },
  staticDirs: ["../public"],
  features: {
    backgrounds: false,
  },
  docs: {
    autodocs: "tag",
  },
};

export default config;
