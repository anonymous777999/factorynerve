// components/ui/professional-button.tsx
// Enhanced button component with professional styling

import { cva, type VariantProps } from "class-variance-authority";
import React from "react";

const buttonVariants = cva(
    [
        // Base styles - core button appearance
        "inline-flex items-center justify-center gap-2",
        "rounded-md font-medium",
        "transition-all duration-200",
        "cursor-pointer",
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none",
        // Focus states for keyboard navigation
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        // Min height for mobile touch targets
        "min-h-[40px]",
    ],
    {
        variants: {
            variant: {
                primary: [
                    "bg-action-primary text-action-primary-text",
                    "hover:bg-action-primary-hover shadow-sm hover:shadow-md",
                    "active:bg-action-primary-active active:shadow-sm",
                    "focus-visible:ring-action-primary focus-visible:ring-offset-background",
                ],
                secondary: [
                    "bg-surface-panel text-text-primary",
                    "border border-border-default",
                    "hover:bg-surface-hover hover:border-border-default",
                    "active:bg-surface-active",
                    "focus-visible:ring-action-primary",
                ],
                ghost: [
                    "text-text-primary",
                    "hover:bg-surface-hover",
                    "active:bg-surface-active",
                    "focus-visible:ring-action-primary",
                ],
                destructive: [
                    "bg-status-danger-bg text-status-danger-fg",
                    "hover:opacity-90 hover:shadow-sm",
                    "active:opacity-75",
                    "focus-visible:ring-status-danger-fg",
                ],
            },
            size: {
                sm: "h-8 px-3 text-sm gap-1",
                md: "h-10 px-4 text-base gap-2",
                lg: "h-12 px-6 text-lg gap-2",
            },
        },
        defaultVariants: {
            variant: "primary",
            size: "md",
        },
    }
);

interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
    isLoading?: boolean;
    icon?: React.ReactNode;
}

export const ProfessionalButton = React.forwardRef<
    HTMLButtonElement,
    ButtonProps
>(({ className, variant, size, isLoading, icon, children, ...props }, ref) => (
    <button
        ref={ref}
        className={buttonVariants({ variant, size, className })}
        {...props}
    >
        {isLoading ? (
            <span className="inline-block animate-spin">⟳</span>
        ) : (
            icon && <span className="flex-shrink-0">{icon}</span>
        )}
        {children}
    </button>
));

ProfessionalButton.displayName = "ProfessionalButton";
