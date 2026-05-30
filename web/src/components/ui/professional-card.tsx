// components/ui/professional-card.tsx
// Enhanced card component with proper elevation and spacing

import React from "react";
import { cva, type VariantProps } from "class-variance-authority";

const cardVariants = cva("rounded-lg overflow-hidden", {
    variants: {
        elevation: {
            none: "bg-surface-card border border-border-subtle",
            sm: "bg-surface-card shadow-sm border border-border-subtle",
            md: "bg-surface-elevated shadow-md border border-border-default",
            lg: "bg-surface-elevated shadow-lg border border-border-default",
            xl: "bg-surface-elevated shadow-xl border border-border-default",
        },
        padding: {
            none: "p-0",
            sm: "p-3",
            md: "p-4",
            lg: "p-6",
            xl: "p-8",
        },
        interactive: {
            true: "hover:shadow-md transition-shadow cursor-pointer",
            false: "",
        },
    },
    defaultVariants: {
        elevation: "md",
        padding: "lg",
        interactive: false,
    },
});

interface CardProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> { }

export const ProfessionalCard = React.forwardRef<HTMLDivElement, CardProps>(
    ({ className, elevation, padding, interactive, ...props }, ref) => (
        <div
            ref={ref}
            className={cardVariants({ elevation, padding, interactive, className })}
            {...props}
        />
    )
);

ProfessionalCard.displayName = "ProfessionalCard";

// Header component
export const CardHeader = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className = "", ...props }, ref) => (
    <div
        ref={ref}
        className={`flex flex-col space-y-1.5 border-b border-border-subtle pb-4 ${className}`}
        {...props}
    />
));
CardHeader.displayName = "CardHeader";

// Title component
export const CardTitle = React.forwardRef<
    HTMLHeadingElement,
    React.HTMLAttributes<HTMLHeadingElement>
>(({ className = "", ...props }, ref) => (
    <h2
        ref={ref}
        className={`text-lg font-semibold leading-none tracking-tight text-text-primary ${className}`}
        {...props}
    />
));
CardTitle.displayName = "CardTitle";

// Description component
export const CardDescription = React.forwardRef<
    HTMLParagraphElement,
    React.HTMLAttributes<HTMLParagraphElement>
>(({ className = "", ...props }, ref) => (
    <p
        ref={ref}
        className={`text-sm text-text-secondary ${className}`}
        {...props}
    />
));
CardDescription.displayName = "CardDescription";

// Content component
export const CardContent = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className = "", ...props }, ref) => (
    <div ref={ref} className={`pt-4 ${className}`} {...props} />
));
CardContent.displayName = "CardContent";

// Footer component
export const CardFooter = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className = "", ...props }, ref) => (
    <div
        ref={ref}
        className={`flex items-center space-x-2 border-t border-border-subtle pt-4 ${className}`}
        {...props}
    />
));
CardFooter.displayName = "CardFooter";
