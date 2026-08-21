"use client";

import { useState } from "react";

export function CodeBlock({ language, value }: { language: string; value: string }) {
  const [status, setStatus] = useState("Copy");

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setStatus("Copied");
    } catch {
      setStatus("Select code to copy");
    }
    window.setTimeout(() => setStatus("Copy"), 1_800);
  }

  return (
    <div className="doc-code">
      <div className="doc-code-header">
        <span>{language}</span>
        <button type="button" onClick={copy} aria-label={`Copy ${language} code`}>
          {status}
        </button>
      </div>
      <pre role="region" aria-label={`${language} code sample`} tabIndex={0}>
        <code>{value}</code>
      </pre>
    </div>
  );
}
