import type { ComponentProps } from "react";

export function SiteLogo({ className, ...props }: ComponentProps<"a">) {
  return (
    <a
      {...props}
      className={["home-wordmark", className].filter(Boolean).join(" ")}
      aria-label="generative-a11y home"
    >
      {/* Vinext currently bundles next/image with a second React runtime. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="home-wordmark-mark"
        src="/favicon.svg"
        width="24"
        height="24"
        alt=""
        aria-hidden="true"
      />
      <span>generative-a11y</span>
    </a>
  );
}
