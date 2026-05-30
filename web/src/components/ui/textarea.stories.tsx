import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Field, HelperText, Label } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

const meta = {
    title: "UI/Textarea",
    component: Textarea,
    tags: ["autodocs"],
    args: {
        id: "notes",
        placeholder: "Enter additional notes or observations",
        disabled: false,
        validationState: "default",
        rows: 3,
    },
    argTypes: {
        validationState: {
            control: "inline-radio",
            options: ["default", "invalid", "valid"],
        },
    },
    render: (args) => (
        <Field className="max-w-2xl" validationState={args.validationState}>
            <Label htmlFor={args.id} validationState={args.validationState}>
                Notes
            </Label>
            <Textarea {...args} />
            <HelperText validationState={args.validationState}>
                Provide any additional context or observations.
            </HelperText>
        </Field>
    ),
} satisfies Meta<typeof Textarea>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Invalid: Story = {
    args: {
        validationState: "invalid",
        value: "Too short",
    },
    render: (args) => (
        <Field className="max-w-2xl" validationState={args.validationState}>
            <Label htmlFor={args.id} required validationState={args.validationState}>
                Notes
            </Label>
            <Textarea {...args} />
            <HelperText>
                Notes must be at least 20 characters long.
            </HelperText>
        </Field>
    ),
};

export const Disabled: Story = {
    args: {
        disabled: true,
        value: "This field is locked by the system.",
    },
};

export const FocusState: Story = {
    args: {
        value: "Click or tab to this field to see the indigo focus ring with 2px offset.",
    },
    render: (args) => (
        <Field className="max-w-2xl">
            <Label htmlFor={args.id}>
                Focus State Test
            </Label>
            <Textarea {...args} />
            <HelperText>
                Use Tab key to navigate and observe the indigo focus ring.
            </HelperText>
        </Field>
    ),
};
