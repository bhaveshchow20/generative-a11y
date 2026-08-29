"use client";

import { RootProvider } from "fumadocs-ui/provider/next";
import DefaultSearchDialog from "fumadocs-ui/components/dialog/search-default";

export function AppProvider({ children }: { children: React.ReactNode }) {
  return (
    <RootProvider
      search={{
        enabled: true,
        SearchDialog: DefaultSearchDialog,
        options: { api: "/api/search" },
      }}
      theme={{
        attribute: "class",
        defaultTheme: "system",
        disableTransitionOnChange: true,
        enableSystem: true,
      }}
    >
      {children}
    </RootProvider>
  );
}
