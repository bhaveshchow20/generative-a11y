import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "ga-:flex ga-:field-sizing-content ga-:min-h-16 ga-:w-full ga-:rounded-lg ga-:border ga-:border-input ga-:bg-transparent ga-:px-2.5 ga-:py-2 ga-:text-base ga-:transition-colors ga-:outline-none ga-:placeholder:text-muted-foreground ga-:focus-visible:border-ring ga-:focus-visible:ring-3 ga-:focus-visible:ring-ring/50 ga-:disabled:cursor-not-allowed ga-:disabled:bg-input/50 ga-:disabled:opacity-50 ga-:aria-invalid:border-destructive ga-:aria-invalid:ring-3 ga-:aria-invalid:ring-destructive/20 ga-:md:text-sm ga-:dark:bg-input/30 ga-:dark:disabled:bg-input/80 ga-:dark:aria-invalid:border-destructive/50 ga-:dark:aria-invalid:ring-destructive/40",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
