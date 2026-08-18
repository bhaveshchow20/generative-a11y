import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "ga-:group/badge ga-:inline-flex ga-:h-5 ga-:w-fit ga-:shrink-0 ga-:items-center ga-:justify-center ga-:gap-1 ga-:overflow-hidden ga-:rounded-4xl ga-:border ga-:border-transparent ga-:px-2 ga-:py-0.5 ga-:text-xs ga-:font-medium ga-:whitespace-nowrap ga-:transition-all ga-:focus-visible:border-ring ga-:focus-visible:ring-[3px] ga-:focus-visible:ring-ring/50 ga-:has-data-[icon=inline-end]:pr-1.5 ga-:has-data-[icon=inline-start]:pl-1.5 ga-:aria-invalid:border-destructive ga-:aria-invalid:ring-destructive/20 ga-:dark:aria-invalid:ring-destructive/40 ga-:[&>svg]:pointer-events-none ga-:[&>svg]:size-3!",
  {
    variants: {
      variant: {
        default:
          "ga-:bg-primary ga-:text-primary-foreground ga-:[a]:hover:bg-primary/80",
        secondary:
          "ga-:bg-secondary ga-:text-secondary-foreground ga-:[a]:hover:bg-secondary/80",
        destructive:
          "ga-:bg-destructive/10 ga-:text-destructive ga-:focus-visible:ring-destructive/20 ga-:dark:bg-destructive/20 ga-:dark:focus-visible:ring-destructive/40 ga-:[a]:hover:bg-destructive/20",
        outline:
          "ga-:border-border ga-:text-foreground ga-:[a]:hover:bg-muted ga-:[a]:hover:text-muted-foreground",
        ghost:
          "ga-:hover:bg-muted ga-:hover:text-muted-foreground ga-:dark:hover:bg-muted/50",
        link: "ga-:text-primary ga-:underline-offset-4 ga-:hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span";

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
