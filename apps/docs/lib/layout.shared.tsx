import type { ComponentProps, Ref } from "react";
import type { HomeLayoutProps } from "fumadocs-ui/layouts/home";
import type { DocsLayoutProps } from "fumadocs-ui/layouts/docs";
import { BookOpen, Braces, FlaskConical } from "lucide-react";

import { SiteLogo } from "../components/layout/site-logo";
import { REPOSITORY_URL } from "./site";

function HomeShellContainer({
  className,
  children,
  ref,
  ...props
}: ComponentProps<"main">) {
  return (
    <div
      {...props}
      ref={ref as Ref<HTMLDivElement>}
      className={["home-layout-shell", className].filter(Boolean).join(" ")}
    >
      {children}
    </div>
  );
}

export const homeLayoutOptions = {
  nav: {
    title: SiteLogo,
    url: "/",
    transparentMode: "none",
    enableHoverToOpen: false,
  },
  links: [
    { text: "Docs", url: "/docs/getting-started" },
    { text: "API", url: "/api" },
    { text: "Examples", url: "/examples/lifecycle-lab" },
    { text: "GitHub", url: REPOSITORY_URL, external: true },
  ],
  searchToggle: { enabled: true },
  themeSwitch: { enabled: true, mode: "light-dark-system" },
  slots: { container: HomeShellContainer },
} satisfies HomeLayoutProps;

export const docsLayoutOptions = {
  nav: {
    title: SiteLogo,
    url: "/",
    transparentMode: "none",
  },
  tabs: [
    {
      title: "Guides",
      description: "Learn how to add accessible behavior to AI interfaces.",
      url: "/docs/getting-started",
      icon: <BookOpen aria-hidden="true" />,
    },
    {
      title: "API Reference",
      description: "Explore every package and public API.",
      url: "/api",
      icon: <Braces aria-hidden="true" />,
    },
    {
      title: "Examples",
      description: "Explore the lifecycle in interactive examples.",
      url: "/examples/lifecycle-lab",
      icon: <FlaskConical aria-hidden="true" />,
    },
  ],
  links: [
    {
      text: "GitHub",
      url: REPOSITORY_URL,
      external: true,
    },
  ],
  searchToggle: { enabled: true },
  themeSwitch: { enabled: true, mode: "light-dark-system" },
  sidebar: {
    collapsible: true,
    defaultOpenLevel: 1,
  },
} satisfies Omit<DocsLayoutProps, "children" | "tree">;
