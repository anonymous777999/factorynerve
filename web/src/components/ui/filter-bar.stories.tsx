import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Button } from "@/components/ui/button";
import { FilterBar } from "@/components/ui/filter-bar";
import { activeFilters, filterFields } from "@/stories/operational-fixtures";

const meta = {
  title: "Operational/FilterBar",
  component: FilterBar,
  tags: ["autodocs"],
  args: {
    title: "Queue filters",
    resultCount: "128 routed records",
    fields: filterFields,
    activeFilters,
    onClearAll: () => undefined,
    actions: (
      <Button size="compact" variant="outline">
        Save preset
      </Button>
    ),
    footer: "Presets should remain URL-safe so mobile back navigation restores the same queue slice.",
  },
} satisfies Meta<typeof FilterBar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Dense: Story = {};

export const Mobile: Story = {
  parameters: {
    viewport: { value: "mobile1" },
  },
};

export const Loading: Story = {
  args: {
    resultCount: "Refreshing filters",
    activeFilters: [],
    footer: "Waiting for latest queue totals from backend routing.",
  },
};

export const Empty: Story = {
  args: {
    resultCount: "0 records",
    activeFilters: [],
    footer: "No filters are currently narrowing this queue.",
  },
};

export const Error: Story = {
  args: {
    resultCount: "Filter state unavailable",
    footer: "Last saved filter preset could not be restored from route state.",
  },
};
