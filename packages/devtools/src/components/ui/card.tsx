import * as React from "react";

import { cn } from "@/lib/utils";

function Card({
  className,
  size = "default",
  ...props
}: React.ComponentProps<"div"> & { size?: "default" | "sm" }) {
  return (
    <div
      data-slot="card"
      data-size={size}
      className={cn(
        "ga-:group/card ga-:flex ga-:flex-col ga-:gap-(--card-spacing) ga-:overflow-hidden ga-:rounded-xl ga-:bg-card ga-:py-(--card-spacing) ga-:text-sm ga-:text-card-foreground ga-:ring-1 ga-:ring-foreground/10 ga-:[--card-spacing:--spacing(4)] ga-:has-data-[slot=card-footer]:pb-0 ga-:has-[>img:first-child]:pt-0 ga-:data-[size=sm]:[--card-spacing:--spacing(3)] ga-:data-[size=sm]:has-data-[slot=card-footer]:pb-0 ga-:*:[img:first-child]:rounded-t-xl ga-:*:[img:last-child]:rounded-b-xl",
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "ga-:group/card-header ga-:@container/card-header ga-:grid ga-:auto-rows-min ga-:items-start ga-:gap-1 ga-:rounded-t-xl ga-:px-(--card-spacing) ga-:has-data-[slot=card-action]:grid-cols-[1fr_auto] ga-:has-data-[slot=card-description]:grid-rows-[auto_auto] ga-:[.border-b]:pb-(--card-spacing)",
        className,
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "ga-: ga-:text-base ga-:leading-snug ga-:font-medium ga-:group-data-[size=sm]/card:text-sm",
        className,
      )}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("ga-:text-sm ga-:text-muted-foreground", className)}
      {...props}
    />
  );
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "ga-:col-start-2 ga-:row-span-2 ga-:row-start-1 ga-:self-start ga-:justify-self-end",
        className,
      )}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("ga-:px-(--card-spacing)", className)}
      {...props}
    />
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "ga-:flex ga-:items-center ga-:rounded-b-xl ga-:border-t ga-:bg-muted/50 ga-:p-(--card-spacing)",
        className,
      )}
      {...props}
    />
  );
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
};
