"use client";

import * as React from "react";
import { Separator as SeparatorPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      data-slot="separator"
      decorative={decorative}
      orientation={orientation}
      className={cn(
        "ga-:shrink-0 ga-:bg-border ga-:data-horizontal:h-px ga-:data-horizontal:w-full ga-:data-vertical:w-px ga-:data-vertical:self-stretch",
        className,
      )}
      {...props}
    />
  );
}

export { Separator };
