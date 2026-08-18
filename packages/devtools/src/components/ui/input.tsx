import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "ga-:h-8 ga-:w-full ga-:min-w-0 ga-:rounded-lg ga-:border ga-:border-input ga-:bg-transparent ga-:px-2.5 ga-:py-1 ga-:text-base ga-:transition-colors ga-:outline-none ga-:file:inline-flex ga-:file:h-6 ga-:file:border-0 ga-:file:bg-transparent ga-:file:text-sm ga-:file:font-medium ga-:file:text-foreground ga-:placeholder:text-muted-foreground ga-:focus-visible:border-ring ga-:focus-visible:ring-3 ga-:focus-visible:ring-ring/50 ga-:disabled:pointer-events-none ga-:disabled:cursor-not-allowed ga-:disabled:bg-input/50 ga-:disabled:opacity-50 ga-:aria-invalid:border-destructive ga-:aria-invalid:ring-3 ga-:aria-invalid:ring-destructive/20 ga-:md:text-sm ga-:dark:bg-input/30 ga-:dark:disabled:bg-input/80 ga-:dark:aria-invalid:border-destructive/50 ga-:dark:aria-invalid:ring-destructive/40",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
