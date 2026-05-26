import { forwardRef } from "react";
import { cx } from "../../../../lib/utils";
import type { PanelProps } from "./panel.types";
import { getPanelRecipe } from "./panel.variants";
import { PanelBody } from "./PanelBody";
import { PanelFooter } from "./PanelFooter";
import { PanelHeader } from "./PanelHeader";

export const Panel = forwardRef<HTMLElement, PanelProps>(function Panel(
  {
    variant = "workspace",
    surface,
    state = "default",
    density = "default",
    padding = "default",
    scrollable = false,
    stickyHeader = false,
    stickyFooter = false,
    header,
    footer,
    className,
    children,
    role,
    ...props
  },
  ref
) {
  const recipe = getPanelRecipe({
    variant,
    surface,
    state,
    density,
    padding,
    scrollable,
  });

  const defaultRole = variant === "ai" ? "complementary" : "region";

  return (
    <section
      ref={ref}
      role={role ?? defaultRole}
      className={cx(recipe.root, className)}
      {...props}
    >
      {header ? (
        <PanelHeader className={cx(recipe.header, stickyHeader && "sticky top-0")}>
          {header}
        </PanelHeader>
      ) : null}
      <PanelBody className={recipe.body} padding="none" scrollable={false}>
        {children}
      </PanelBody>
      {footer ? (
        <PanelFooter className={cx(recipe.footer, stickyFooter && "sticky bottom-0")}>
          {footer}
        </PanelFooter>
      ) : null}
    </section>
  );
});
