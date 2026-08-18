"use client";

import * as React from "react";
import { Command as CommandPrimitive } from "cmdk";

import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InputGroup, InputGroupAddon } from "@/components/ui/input-group";
import { SearchIcon } from "lucide-react";

function Command({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      data-slot="command"
      className={cn(
        "ga-:flex ga-:size-full ga-:flex-col ga-:overflow-hidden ga-:rounded-xl! ga-:bg-popover ga-:p-1 ga-:text-popover-foreground",
        className,
      )}
      {...props}
    />
  );
}

function CommandDialog({
  title = "Command Palette",
  description = "Search for a command to run...",
  children,
  className,
  showCloseButton = false,
  ...props
}: React.ComponentProps<typeof Dialog> & {
  title?: string;
  description?: string;
  className?: string;
  showCloseButton?: boolean;
}) {
  return (
    <Dialog {...props}>
      <DialogContent
        className={cn(
          "ga-:top-1/3 ga-:translate-y-0 ga-:overflow-hidden ga-:rounded-xl! ga-:p-0",
          className,
        )}
        showCloseButton={showCloseButton}
      >
        <DialogHeader className="ga-:sr-only">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

function CommandInput({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div data-slot="command-input-wrapper" className="ga-:p-1 ga-:pb-0">
      <InputGroup className="ga-:h-8! ga-:rounded-lg! ga-:border-input/30 ga-:bg-input/30 ga-:shadow-none! ga-:*:data-[slot=input-group-addon]:pl-2!">
        <CommandPrimitive.Input
          data-slot="command-input"
          className={cn(
            "ga-:w-full ga-:text-sm ga-:outline-hidden ga-:disabled:cursor-not-allowed ga-:disabled:opacity-50",
            className,
          )}
          {...props}
        />
        <InputGroupAddon>
          <SearchIcon className="ga-:size-4 ga-:shrink-0 ga-:opacity-50" />
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}

function CommandList({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      data-slot="command-list"
      className={cn(
        "ga-:no-scrollbar ga-:max-h-72 ga-:scroll-py-1 ga-:overflow-x-hidden ga-:overflow-y-auto ga-:outline-none",
        className,
      )}
      {...props}
    />
  );
}

function CommandEmpty({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return (
    <CommandPrimitive.Empty
      data-slot="command-empty"
      className={cn("ga-:py-6 ga-:text-center ga-:text-sm", className)}
      {...props}
    />
  );
}

function CommandGroup({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      data-slot="command-group"
      className={cn(
        "ga-:overflow-hidden ga-:p-1 ga-:text-foreground ga-:**:[[cmdk-group-heading]]:px-2 ga-:**:[[cmdk-group-heading]]:py-1.5 ga-:**:[[cmdk-group-heading]]:text-xs ga-:**:[[cmdk-group-heading]]:font-medium ga-:**:[[cmdk-group-heading]]:text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

function CommandSeparator({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Separator>) {
  return (
    <CommandPrimitive.Separator
      data-slot="command-separator"
      className={cn("ga-:-mx-1 ga-:h-px ga-:bg-border", className)}
      {...props}
    />
  );
}

function CommandItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      data-slot="command-item"
      className={cn(
        "ga-:group/command-item ga-:relative ga-:flex ga-:cursor-default ga-:items-center ga-:gap-2 ga-:rounded-sm ga-:px-2 ga-:py-1.5 ga-:text-sm ga-:outline-hidden ga-:select-none ga-:in-data-[slot=dialog-content]:rounded-lg! ga-:data-[disabled=true]:pointer-events-none ga-:data-[disabled=true]:opacity-50 ga-:data-selected:bg-muted ga-:data-selected:text-foreground ga-:[&_svg]:pointer-events-none ga-:[&_svg]:shrink-0 ga-:[&_svg:not([class*=size-])]:size-4 ga-:data-selected:*:[svg]:text-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </CommandPrimitive.Item>
  );
}

function CommandShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="command-shortcut"
      className={cn(
        "ga-:ml-auto ga-:text-xs ga-:tracking-widest ga-:text-muted-foreground ga-:group-data-selected/command-item:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
};
