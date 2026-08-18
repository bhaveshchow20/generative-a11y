"use client";

import * as ResizablePrimitive from "react-resizable-panels";

import { cn } from "@/lib/utils";

function ResizablePanelGroup({
  className,
  ...props
}: ResizablePrimitive.GroupProps) {
  return (
    <ResizablePrimitive.Group
      data-slot="resizable-panel-group"
      className={cn(
        "ga-:flex ga-:h-full ga-:w-full ga-:aria-[orientation=vertical]:flex-col",
        className,
      )}
      {...props}
    />
  );
}

function ResizablePanel({ ...props }: ResizablePrimitive.PanelProps) {
  return <ResizablePrimitive.Panel data-slot="resizable-panel" {...props} />;
}

function ResizableHandle({
  withHandle,
  className,
  ...props
}: ResizablePrimitive.SeparatorProps & {
  withHandle?: boolean;
}) {
  return (
    <ResizablePrimitive.Separator
      data-slot="resizable-handle"
      className={cn(
        "ga-:relative ga-:flex ga-:w-px ga-:items-center ga-:justify-center ga-:bg-border ga-:ring-offset-background ga-:after:absolute ga-:after:inset-y-0 ga-:after:left-1/2 ga-:after:w-1 ga-:after:-translate-x-1/2 ga-:focus-visible:ring-1 ga-:focus-visible:ring-ring ga-:focus-visible:outline-hidden ga-:aria-[orientation=horizontal]:h-px ga-:aria-[orientation=horizontal]:w-full ga-:aria-[orientation=horizontal]:after:left-0 ga-:aria-[orientation=horizontal]:after:h-1 ga-:aria-[orientation=horizontal]:after:w-full ga-:aria-[orientation=horizontal]:after:translate-x-0 ga-:aria-[orientation=horizontal]:after:-translate-y-1/2 ga-:[&[aria-orientation=horizontal]>div]:rotate-90",
        className,
      )}
      {...props}
    >
      {withHandle && (
        <div className="ga-:z-10 ga-:flex ga-:h-6 ga-:w-1 ga-:shrink-0 ga-:rounded-lg ga-:bg-border" />
      )}
    </ResizablePrimitive.Separator>
  );
}

export { ResizableHandle, ResizablePanel, ResizablePanelGroup };
