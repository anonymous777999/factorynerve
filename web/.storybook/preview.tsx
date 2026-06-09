import * as React from "react";

import type { Preview } from "@storybook/nextjs-vite";
import { MINIMAL_VIEWPORTS } from "storybook/viewport";

import "@/app/globals.css";
import {
  APP_DENSITIES,
  APP_THEMES,
  type AppDensity,
  type AppTheme,
} from "@/providers/ui-preferences-provider";

const previewSurfaceClassName = "min-h-screen bg-surface-app p-lg text-text-primary";

function StorybookPreviewSurface({
  children,
  density,
  theme,
}: {
  children: React.ReactNode;
  density: AppDensity;
  theme: AppTheme;
}) {
  React.useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.dataset.density = density;
    root.style.colorScheme = theme;
  }, [density, theme]);

  return <div className={previewSurfaceClassName}>{children}</div>;
}

const preview: Preview = {
  parameters: {
    layout: "fullscreen",

    controls: {
      expanded: true,
    },

    nextjs: {
      appDirectory: true,
    },

    viewport: {
      options: MINIMAL_VIEWPORTS,
    },

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: "todo"
    }
  },
  globalTypes: {
    theme: {
      name: "Theme",
      description: "Preview DPR theme tokens",
      toolbar: {
        icon: "mirror",
        items: APP_THEMES.map((theme) => ({
          title: theme === "dark" ? "Dark" : "Light",
          value: theme,
        })),
      },
    },
    density: {
      name: "Density",
      description: "Preview DPR density tokens",
      toolbar: {
        icon: "stacked",
        items: APP_DENSITIES.map((density) => ({
          title:
            density === "default"
              ? "Default"
              : density === "compact"
                ? "Compact"
                : "Comfortable",
          value: density,
        })),
      },
    },
  },
  initialGlobals: {
    theme: "dark",
    density: "default",
    viewport: {
      value: "desktop",
      isRotated: false,
    },
  },
  decorators: [
    (Story, context) => {
      const theme = context.globals.theme as AppTheme;
      const density = context.globals.density as AppDensity;

      return (
        <StorybookPreviewSurface density={density} theme={theme}>
          <Story />
        </StorybookPreviewSurface>
      );
    },
  ],
};

export default preview;
