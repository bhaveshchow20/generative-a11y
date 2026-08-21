"use client";

import dynamic from "next/dynamic";

export const FrameworkShowcaseLoader = dynamic(
  () => import("./real-framework-showcase").then((module) => module.RealFrameworkShowcase),
  {
    ssr: false,
    loading: () => <div className="framework-loading" role="status">Preparing installed framework examples...</div>,
  },
);
