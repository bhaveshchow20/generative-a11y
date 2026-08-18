import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Tabs as TabsPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      orientation={orientation}
      className={cn(
        "ga-:group/tabs ga-:flex ga-:gap-2 ga-:data-horizontal:flex-col",
        className,
      )}
      {...props}
    />
  );
}

const tabsListVariants = cva(
  "ga-:group/tabs-list ga-:inline-flex ga-:w-fit ga-:items-center ga-:justify-center ga-:rounded-lg ga-:p-[3px] ga-:text-muted-foreground ga-:group-data-horizontal/tabs:h-8 ga-:group-data-vertical/tabs:h-fit ga-:group-data-vertical/tabs:flex-col ga-:data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "ga-:bg-muted",
        line: "ga-:gap-1 ga-:bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function TabsList({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  );
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "ga-:relative ga-:inline-flex ga-:h-[calc(100%-1px)] ga-:flex-1 ga-:items-center ga-:justify-center ga-:gap-1.5 ga-:rounded-md ga-:border ga-:border-transparent ga-:px-1.5 ga-:py-0.5 ga-:text-sm ga-:font-medium ga-:whitespace-nowrap ga-:text-foreground/60 ga-:transition-all ga-:group-data-vertical/tabs:w-full ga-:group-data-vertical/tabs:justify-start ga-:hover:text-foreground ga-:focus-visible:border-ring ga-:focus-visible:ring-[3px] ga-:focus-visible:ring-ring/50 ga-:focus-visible:outline-1 ga-:focus-visible:outline-ring ga-:disabled:pointer-events-none ga-:disabled:opacity-50 ga-:has-data-[icon=inline-end]:pr-1 ga-:has-data-[icon=inline-start]:pl-1 ga-:dark:text-muted-foreground ga-:dark:hover:text-foreground ga-:group-data-[variant=default]/tabs-list:data-active:shadow-sm ga-:group-data-[variant=line]/tabs-list:data-active:shadow-none ga-:[&_svg]:pointer-events-none ga-:[&_svg]:shrink-0 ga-:[&_svg:not([class*=size-])]:size-4",
        "ga-:group-data-[variant=line]/tabs-list:bg-transparent ga-:group-data-[variant=line]/tabs-list:data-active:bg-transparent ga-:dark:group-data-[variant=line]/tabs-list:data-active:border-transparent ga-:dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent",
        "ga-:data-active:bg-background ga-:data-active:text-foreground ga-:dark:data-active:border-input ga-:dark:data-active:bg-input/30 ga-:dark:data-active:text-foreground",
        "ga-:after:absolute ga-:after:bg-foreground ga-:after:opacity-0 ga-:after:transition-opacity ga-:group-data-horizontal/tabs:after:inset-x-0 ga-:group-data-horizontal/tabs:after:bottom-[-5px] ga-:group-data-horizontal/tabs:after:h-0.5 ga-:group-data-vertical/tabs:after:inset-y-0 ga-:group-data-vertical/tabs:after:-right-1 ga-:group-data-vertical/tabs:after:w-0.5 ga-:group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("ga-:flex-1 ga-:text-sm ga-:outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants };
