"use client";

import { Select } from "@base-ui/react/select";
import { useState, useSyncExternalStore } from "react";

const packageNames = [
  "core",
  "dom",
  "react",
  "ai-sdk",
  "assistant-ui",
  "ag-ui",
] as const;

type PackageName = (typeof packageNames)[number];

const packageItems = packageNames.map((name) => ({
  label: name,
  value: name,
}));

const subscribeToHydration = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function InstallCommand() {
  const [packageName, setPackageName] = useState<PackageName>("core");
  const [status, setStatus] = useState("");
  const interactive = useSyncExternalStore(
    subscribeToHydration,
    getClientSnapshot,
    getServerSnapshot,
  );
  const command = `npm install @generative-a11y/${packageName}`;

  async function copyCommand() {
    try {
      await navigator.clipboard.writeText(command);
      setStatus(`Copied ${command}`);
    } catch {
      setStatus("Copy failed. Select the command and copy it manually.");
    }
  }

  return (
    <div
      className="install-command"
      role="group"
      aria-label="Install a package"
      data-command={command}
    >
      <div className="install-command-shell">
        <span className="install-prompt" aria-hidden="true">
          $
        </span>
        <code className="install-prefix">npm install @generative-a11y/</code>
        <span className="install-package-select">
          <Select.Root
            items={packageItems}
            value={packageName}
            onValueChange={(value) => {
              if (!value) return;
              setPackageName(value as PackageName);
              setStatus("");
            }}
          >
            <Select.Trigger className="install-package-trigger" aria-label="Package">
              <Select.Value />
              <Select.Icon>
                <svg aria-hidden="true" viewBox="0 0 12 8" width="10" height="7">
                  <path d="m1 1 5 5 5-5" />
                </svg>
              </Select.Icon>
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner
                className="install-package-positioner"
                side="right"
                sideOffset={10}
                alignItemWithTrigger={false}
              >
                <Select.Popup className="install-package-menu">
                  <p>Choose a package</p>
                  <Select.List aria-label="Package">
                    {packageNames.map((name) => (
                      <Select.Item key={name} value={name}>
                        <Select.ItemText>@generative-a11y/{name}</Select.ItemText>
                        <Select.ItemIndicator aria-hidden="true">✓</Select.ItemIndicator>
                      </Select.Item>
                    ))}
                  </Select.List>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        </span>
        <button
          className="install-copy"
          type="button"
          aria-label="Copy install command"
          disabled={!interactive}
          onClick={copyCommand}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" width="17" height="17">
            <rect x="8" y="8" width="11" height="11" rx="1.5" />
            <path d="M5 16H4.5A1.5 1.5 0 0 1 3 14.5v-10A1.5 1.5 0 0 1 4.5 3h10A1.5 1.5 0 0 1 16 4.5V5" />
          </svg>
          <span>{status.startsWith("Copied") ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <span className="sr-only" role="status" aria-live="polite">
        {status}
      </span>
    </div>
  );
}
