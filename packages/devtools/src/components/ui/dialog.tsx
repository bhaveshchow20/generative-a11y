"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { XIcon } from "lucide-react";

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "ga-:fixed ga-:inset-0 ga-:isolate ga-:z-50 ga-:bg-black/10 ga-:duration-100 ga-:supports-backdrop-filter:backdrop-blur-xs ga-:data-open:animate-in ga-:data-open:fade-in-0 ga-:data-closed:animate-out ga-:data-closed:fade-out-0",
        className,
      )}
      {...props}
    />
  );
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean;
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "ga-:fixed ga-:top-1/2 ga-:left-1/2 ga-:z-50 ga-:grid ga-:w-full ga-:max-w-[calc(100%-2rem)] ga-:-translate-x-1/2 ga-:-translate-y-1/2 ga-:gap-4 ga-:rounded-xl ga-:bg-popover ga-:p-4 ga-:text-sm ga-:text-popover-foreground ga-:ring-1 ga-:ring-foreground/10 ga-:duration-100 ga-:outline-none ga-:sm:max-w-sm ga-:data-open:animate-in ga-:data-open:fade-in-0 ga-:data-open:zoom-in-95 ga-:data-closed:animate-out ga-:data-closed:fade-out-0 ga-:data-closed:zoom-out-95",
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close data-slot="dialog-close" asChild>
            <Button
              variant="ghost"
              className="ga-:absolute ga-:top-2 ga-:right-2"
              size="icon-sm"
            >
              <XIcon />
              <span className="ga-:sr-only">Close</span>
            </Button>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("ga-:flex ga-:flex-col ga-:gap-2", className)}
      {...props}
    />
  );
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean;
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "ga-:-mx-4 ga-:-mb-4 ga-:flex ga-:flex-col-reverse ga-:gap-2 ga-:rounded-b-xl ga-:border-t ga-:bg-muted/50 ga-:p-4 ga-:sm:flex-row ga-:sm:justify-end",
        className,
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">Close</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  );
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "ga-: ga-:text-base ga-:leading-none ga-:font-medium",
        className,
      )}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "ga-:text-sm ga-:text-muted-foreground ga-:*:[a]:underline ga-:*:[a]:underline-offset-3 ga-:*:[a]:hover:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
