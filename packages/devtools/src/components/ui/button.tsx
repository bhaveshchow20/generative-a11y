import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "ga-:group/button ga-:inline-flex ga-:shrink-0 ga-:items-center ga-:justify-center ga-:rounded-lg ga-:border ga-:border-transparent ga-:bg-clip-padding ga-:text-sm ga-:font-medium ga-:whitespace-nowrap ga-:transition-all ga-:outline-none ga-:select-none ga-:focus-visible:border-ring ga-:focus-visible:ring-3 ga-:focus-visible:ring-ring/50 ga-:active:not-aria-[haspopup]:translate-y-px ga-:disabled:pointer-events-none ga-:disabled:opacity-50 ga-:aria-invalid:border-destructive ga-:aria-invalid:ring-3 ga-:aria-invalid:ring-destructive/20 ga-:dark:aria-invalid:border-destructive/50 ga-:dark:aria-invalid:ring-destructive/40 ga-:[&_svg]:pointer-events-none ga-:[&_svg]:shrink-0 ga-:[&_svg:not([class*=size-])]:size-4",
  {
    variants: {
      variant: {
        default:
          "ga-:bg-primary ga-:text-primary-foreground ga-:hover:bg-primary/80",
        outline:
          "ga-:border-border ga-:bg-background ga-:hover:bg-muted ga-:hover:text-foreground ga-:aria-expanded:bg-muted ga-:aria-expanded:text-foreground ga-:dark:border-input ga-:dark:bg-input/30 ga-:dark:hover:bg-input/50",
        secondary:
          "ga-:bg-secondary ga-:text-secondary-foreground ga-:hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] ga-:aria-expanded:bg-secondary ga-:aria-expanded:text-secondary-foreground",
        ghost:
          "ga-:hover:bg-muted ga-:hover:text-foreground ga-:aria-expanded:bg-muted ga-:aria-expanded:text-foreground ga-:dark:hover:bg-muted/50",
        destructive:
          "ga-:bg-destructive/10 ga-:text-destructive ga-:hover:bg-destructive/20 ga-:focus-visible:border-destructive/40 ga-:focus-visible:ring-destructive/20 ga-:dark:bg-destructive/20 ga-:dark:hover:bg-destructive/30 ga-:dark:focus-visible:ring-destructive/40",
        link: "ga-:text-primary ga-:underline-offset-4 ga-:hover:underline",
      },
      size: {
        default:
          "ga-:h-8 ga-:gap-1.5 ga-:px-2.5 ga-:has-data-[icon=inline-end]:pr-2 ga-:has-data-[icon=inline-start]:pl-2",
        xs: "ga-:h-6 ga-:gap-1 ga-:rounded-[min(var(--radius-md),10px)] ga-:px-2 ga-:text-xs ga-:in-data-[slot=button-group]:rounded-lg ga-:has-data-[icon=inline-end]:pr-1.5 ga-:has-data-[icon=inline-start]:pl-1.5 ga-:[&_svg:not([class*=size-])]:size-3",
        sm: "ga-:h-7 ga-:gap-1 ga-:rounded-[min(var(--radius-md),12px)] ga-:px-2.5 ga-:text-[0.8rem] ga-:in-data-[slot=button-group]:rounded-lg ga-:has-data-[icon=inline-end]:pr-1.5 ga-:has-data-[icon=inline-start]:pl-1.5 ga-:[&_svg:not([class*=size-])]:size-3.5",
        lg: "ga-:h-9 ga-:gap-1.5 ga-:px-2.5 ga-:has-data-[icon=inline-end]:pr-2 ga-:has-data-[icon=inline-start]:pl-2",
        icon: "ga-:size-8",
        "icon-xs":
          "ga-:size-6 ga-:rounded-[min(var(--radius-md),10px)] ga-:in-data-[slot=button-group]:rounded-lg ga-:[&_svg:not([class*=size-])]:size-3",
        "icon-sm":
          "ga-:size-7 ga-:rounded-[min(var(--radius-md),12px)] ga-:in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "ga-:size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
