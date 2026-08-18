import * as React from "react";
import { ScrollArea as ScrollAreaPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

function ScrollArea({
  className,
  children,
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.Root>) {
  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className={cn("ga-:relative", className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        data-slot="scroll-area-viewport"
        className="ga-:size-full ga-:rounded-[inherit] ga-:transition-[color,box-shadow] ga-:outline-none ga-:focus-visible:ring-[3px] ga-:focus-visible:ring-ring/50 ga-:focus-visible:outline-1"
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
}

function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>) {
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      data-slot="scroll-area-scrollbar"
      data-orientation={orientation}
      orientation={orientation}
      className={cn(
        "ga-:flex ga-:touch-none ga-:p-px ga-:transition-colors ga-:select-none ga-:data-horizontal:h-2.5 ga-:data-horizontal:flex-col ga-:data-horizontal:border-t ga-:data-horizontal:border-t-transparent ga-:data-vertical:h-full ga-:data-vertical:w-2.5 ga-:data-vertical:border-l ga-:data-vertical:border-l-transparent",
        className,
      )}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb
        data-slot="scroll-area-thumb"
        className="ga-:relative ga-:flex-1 ga-:rounded-full ga-:bg-border"
      />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  );
}

export { ScrollArea, ScrollBar };
