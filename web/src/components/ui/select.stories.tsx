import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Field, HelperText, Label } from "@/components/ui/field";
import { Select } from "@/components/ui/select";

const meta = {
    title: "UI/Select",
    component: Select,
    tags: ["autodocs"],
    args: {
        id: "factory",
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
                Factory
            </Label>
            <Select {...args}>
                <option value="">Select a factory</option>
                <option value="factory-1">Factory 1 - Steel Production</option>
                <option value="factory-2">Factory 2 - Aluminum Processing</option>
                <option value="factory-3">Factory 3 - Quality Control</option>
            </Select>
            <HelperText validationState={args.validationState}>
                Choose the factory for this operation.
            </HelperText>
        </Field>
    ),
} satisfies Meta<typeof Select>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Invalid: Story = {
    args: {
        validationState: "invalid",
    },
    render: (args) => (
        <Field className="max-w-2xl">
            <Label htmlFor={args.id} required validationState={args.validationState}>
                Factory
            </Label>
            <Select {...args} aria-describedby="factory-error">
                <option value="">Select a factory</option>
                <option value="factory-1">Factory 1 - Steel Production</option>
                <option value="factory-2">Factory 2 - Aluminum Processing</option>
                <option value="factory-3">Factory 3 - Quality Control</option>
            </Select>
            <HelperText id="factory-error" validationState={args.validationState}>
                Factory selection is required.
            </HelperText>
        </Field>
    ),
};

export const Disabled: Story = {
    args: {
        disabled: true,
    },
    render: (args) => (
        <Field className="max-w-2xl">
            <Label htmlFor={args.id}>
                Factory
            </Label>
            <Select {...args}>
                <option value="factory-1">Factory 1 - Steel Production</option>
            </Select>
            <HelperText>
                Factory is locked for this operation.
            </HelperText>
        </Field>
    ),
};

export const FocusState: Story = {
    render: (args) => (
        <Field className="max-w-2xl">
            <Label htmlFor={args.id}>
                Focus State Test
            </Label>
            <Select {...args}>
                <option value="">Select a factory</option>
                <option value="factory-1">Factory 1 - Steel Production</option>
                <option value="factory-2">Factory 2 - Aluminum Processing</option>
                <option value="factory-3">Factory 3 - Quality Control</option>
            </Select>
            <HelperText>
                Use Tab key to navigate and observe the indigo focus ring.
            </HelperText>
        </Field>
    ),
};
