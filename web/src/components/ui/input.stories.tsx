import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Field, HelperText, Label } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const meta = {
  title: "UI/Input",
  component: Input,
  tags: ["autodocs"],
  args: {
    id: "purchase-order",
    placeholder: "Search by PO, supplier, or lot",
    disabled: false,
    validationState: "default",
  },
  argTypes: {
    validationState: {
      control: "inline-radio",
      options: ["default", "invalid", "valid"],
    },
  },
  render: (args) => (
    <Field className="max-w-2xl">
      <Label htmlFor={args.id} validationState={args.validationState}>
        Purchase Order
      </Label>
      <Input {...args} />
      <HelperText validationState={args.validationState}>
        Keep operator search terms short so workflows remain keyboard-first.
      </HelperText>
    </Field>
  ),
} satisfies Meta<typeof Input>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Invalid: Story = {
  args: {
    validationState: "invalid",
    value: "PO-",
  },
  render: (args) => (
    <Field className="max-w-2xl">
      <Label htmlFor={args.id} required validationState={args.validationState}>
        Purchase Order
      </Label>
      <Input {...args} aria-invalid="true" />
      <HelperText validationState={args.validationState}>
        Enter a full purchase order reference before continuing.
      </HelperText>
    </Field>
  ),
};

export const Disabled: Story = {
  args: {
    disabled: true,
    value: "Locked by workflow",
  },
};
