"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";

const packageNames = [
  "core",
  "dom",
  "react",
  "ai-sdk",
  "assistant-ui",
  "ag-ui",
] as const;

type PackageName = (typeof packageNames)[number];

const subscribeToHydration = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function InstallCommand() {
  const menuId = useId();
  const rootRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [packageName, setPackageName] = useState<PackageName>("core");
  const [menuOpen, setMenuOpen] = useState(false);
  const [status, setStatus] = useState("");
  const interactive = useSyncExternalStore(
    subscribeToHydration,
    getClientSnapshot,
    getServerSnapshot,
  );
  const command = `npm install @generative-a11y/${packageName}`;

  useEffect(() => {
    if (!menuOpen) return;

    optionRefs.current[packageNames.indexOf(packageName)]?.focus({
      preventScroll: true,
    });
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [menuOpen, packageName]);

  function selectPackage(name: PackageName) {
    setPackageName(name);
    setMenuOpen(false);
    setStatus("");
    triggerRef.current?.focus();
  }

  function moveOption(currentIndex: number, direction: number) {
    const nextIndex =
      (currentIndex + direction + packageNames.length) % packageNames.length;
    optionRefs.current[nextIndex]?.focus({ preventScroll: true });
  }

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
        <span className="install-package-select" ref={rootRef}>
          <button
            ref={triggerRef}
            className="install-package-trigger"
            type="button"
            role="combobox"
            disabled={!interactive}
            aria-label="Package"
            aria-controls={menuId}
            aria-expanded={menuOpen}
            aria-haspopup="listbox"
            onClick={() => setMenuOpen((current) => !current)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                setMenuOpen(true);
              }
              if (event.key === "Escape") setMenuOpen(false);
            }}
          >
            <span>{packageName}</span>
            <svg aria-hidden="true" viewBox="0 0 12 8" width="10" height="7">
              <path d="m1 1 5 5 5-5" />
            </svg>
          </button>
          {menuOpen ? (
            <div
              className="install-package-menu"
              id={menuId}
              role="listbox"
              aria-label="Package"
            >
              <p>Choose a package</p>
              {packageNames.map((name, index) => (
                <button
                  key={name}
                  ref={(element) => {
                    optionRefs.current[index] = element;
                  }}
                  type="button"
                  role="option"
                  aria-selected={name === packageName}
                  onClick={() => selectPackage(name)}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      moveOption(index, 1);
                    } else if (event.key === "ArrowUp") {
                      event.preventDefault();
                      moveOption(index, -1);
                    } else if (event.key === "Home") {
                      event.preventDefault();
                      optionRefs.current[0]?.focus();
                    } else if (event.key === "End") {
                      event.preventDefault();
                      optionRefs.current[packageNames.length - 1]?.focus();
                    } else if (event.key === "Escape") {
                      event.preventDefault();
                      setMenuOpen(false);
                      triggerRef.current?.focus();
                    }
                  }}
                >
                  <span>@generative-a11y/{name}</span>
                  <span aria-hidden="true">
                    {name === packageName ? "✓" : ""}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
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
