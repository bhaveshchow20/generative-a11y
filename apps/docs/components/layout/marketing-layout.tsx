"use client";

import { HomeLayout } from "fumadocs-ui/layouts/home";

import { homeLayoutOptions } from "../../lib/layout.shared";

export function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="home-site">
      <HomeLayout {...homeLayoutOptions}>{children}</HomeLayout>
    </div>
  );
}
