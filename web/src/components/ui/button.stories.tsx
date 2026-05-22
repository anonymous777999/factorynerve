import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Button } from "@/components/ui/button";

const meta = {
  title: "UI/Button",
  component: Button,
  tags: ["autodocs"],
  args: {
    children: "Save draft",
    variant: "primary",
    size: "default",
    disabled: false,
    isBusy: false,
  },
  argTypes: {
    variant: {
      control: "inline-radio",
      options: ["primary", "secondary", "outline", "ghost", "destructive"],
    },
    size: {
      control: "inline-radio",
      options: ["default", "compact", "icon"],
    },
  },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PrimaryAction: Story = {};

export const BusyAction: Story = {
  args: {
    children: "Queue export",
    isBusy: true,
    busyLabel: "Queueing",
  },
};

export const CompactSecondary: Story = {
  args: {
    children: "Retry sync",
    size: "compact",
    variant: "secondary",
  },
};

export const Destructive: Story = {
  args: {
    children: "Void batch",
    variant: "destructive",
  },
};
