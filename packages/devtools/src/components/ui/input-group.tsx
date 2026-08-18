import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

function InputGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-group"
      role="group"
      className={cn(
        "ga-:group/input-group ga-:relative ga-:flex ga-:h-8 ga-:w-full ga-:min-w-0 ga-:items-center ga-:rounded-lg ga-:border ga-:border-input ga-:transition-colors ga-:outline-none ga-:in-data-[slot=combobox-content]:focus-within:border-inherit ga-:in-data-[slot=combobox-content]:focus-within:ring-0 ga-:has-disabled:bg-input/50 ga-:has-disabled:opacity-50 ga-:has-[[data-slot=input-group-control]:focus-visible]:border-ring ga-:has-[[data-slot=input-group-control]:focus-visible]:ring-3 ga-:has-[[data-slot=input-group-control]:focus-visible]:ring-ring/50 ga-:has-[[data-slot][aria-invalid=true]]:border-destructive ga-:has-[[data-slot][aria-invalid=true]]:ring-3 ga-:has-[[data-slot][aria-invalid=true]]:ring-destructive/20 ga-:has-[>[data-align=block-end]]:h-auto ga-:has-[>[data-align=block-end]]:flex-col ga-:has-[>[data-align=block-start]]:h-auto ga-:has-[>[data-align=block-start]]:flex-col ga-:has-[>textarea]:h-auto ga-:dark:bg-input/30 ga-:dark:has-disabled:bg-input/80 ga-:dark:has-[[data-slot][aria-invalid=true]]:ring-destructive/40 ga-:has-[>[data-align=block-end]]:[&>input]:pt-3 ga-:has-[>[data-align=block-start]]:[&>input]:pb-3 ga-:has-[>[data-align=inline-end]]:[&>input]:pr-1.5 ga-:has-[>[data-align=inline-start]]:[&>input]:pl-1.5",
        className,
      )}
      {...props}
    />
  );
}

const inputGroupAddonVariants = cva(
  "ga-:flex ga-:h-auto ga-:cursor-text ga-:items-center ga-:justify-center ga-:gap-2 ga-:py-1.5 ga-:text-sm ga-:font-medium ga-:text-muted-foreground ga-:select-none ga-:group-data-[disabled=true]/input-group:opacity-50 ga-:[&>kbd]:rounded-[calc(var(--radius)-5px)] ga-:[&>svg:not([class*=size-])]:size-4",
  {
    variants: {
      align: {
        "inline-start":
          "ga-:order-first ga-:pl-2 ga-:has-[>button]:ml-[-0.3rem] ga-:has-[>kbd]:ml-[-0.15rem]",
        "inline-end":
          "ga-:order-last ga-:pr-2 ga-:has-[>button]:mr-[-0.3rem] ga-:has-[>kbd]:mr-[-0.15rem]",
        "block-start":
          "ga-:order-first ga-:w-full ga-:justify-start ga-:px-2.5 ga-:pt-2 ga-:group-has-[>input]/input-group:pt-2 ga-:[.border-b]:pb-2",
        "block-end":
          "ga-:order-last ga-:w-full ga-:justify-start ga-:px-2.5 ga-:pb-2 ga-:group-has-[>input]/input-group:pb-2 ga-:[.border-t]:pt-2",
      },
    },
    defaultVariants: {
      align: "inline-start",
    },
  },
);

function InputGroupAddon({
  className,
  align = "inline-start",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof inputGroupAddonVariants>) {
  return (
    <div
      role="group"
      data-slot="input-group-addon"
      data-align={align}
      className={cn(inputGroupAddonVariants({ align }), className)}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button")) {
          return;
        }
        e.currentTarget.parentElement?.querySelector("input")?.focus();
      }}
      {...props}
    />
  );
}

const inputGroupButtonVariants = cva(
  "ga-:flex ga-:items-center ga-:gap-2 ga-:text-sm ga-:shadow-none",
  {
    variants: {
      size: {
        xs: "ga-:h-6 ga-:gap-1 ga-:rounded-[calc(var(--radius)-3px)] ga-:px-1.5 ga-:[&>svg:not([class*=size-])]:size-3.5",
        sm: "ga-:",
        "icon-xs":
          "ga-:size-6 ga-:rounded-[calc(var(--radius)-3px)] ga-:p-0 ga-:has-[>svg]:p-0",
        "icon-sm": "ga-:size-8 ga-:p-0 ga-:has-[>svg]:p-0",
      },
    },
    defaultVariants: {
      size: "xs",
    },
  },
);

function InputGroupButton({
  className,
  type = "button",
  variant = "ghost",
  size = "xs",
  ...props
}: Omit<React.ComponentProps<typeof Button>, "size"> &
  VariantProps<typeof inputGroupButtonVariants>) {
  return (
    <Button
      type={type}
      data-size={size}
      variant={variant}
      className={cn(inputGroupButtonVariants({ size }), className)}
      {...props}
    />
  );
}

function InputGroupText({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "ga-:flex ga-:items-center ga-:gap-2 ga-:text-sm ga-:text-muted-foreground ga-:[&_svg]:pointer-events-none ga-:[&_svg:not([class*=size-])]:size-4",
        className,
      )}
      {...props}
    />
  );
}

function InputGroupInput({
  className,
  ...props
}: React.ComponentProps<"input">) {
  return (
    <Input
      data-slot="input-group-control"
      className={cn(
        "ga-:flex-1 ga-:rounded-none ga-:border-0 ga-:bg-transparent ga-:shadow-none ga-:ring-0 ga-:focus-visible:ring-0 ga-:disabled:bg-transparent ga-:aria-invalid:ring-0 ga-:dark:bg-transparent ga-:dark:disabled:bg-transparent",
        className,
      )}
      {...props}
    />
  );
}

function InputGroupTextarea({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <Textarea
      data-slot="input-group-control"
      className={cn(
        "ga-:flex-1 ga-:resize-none ga-:rounded-none ga-:border-0 ga-:bg-transparent ga-:py-2 ga-:shadow-none ga-:ring-0 ga-:focus-visible:ring-0 ga-:disabled:bg-transparent ga-:aria-invalid:ring-0 ga-:dark:bg-transparent ga-:dark:disabled:bg-transparent",
        className,
      )}
      {...props}
    />
  );
}

export {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupInput,
  InputGroupTextarea,
};
