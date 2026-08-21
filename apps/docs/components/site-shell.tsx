"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { NAV_GROUPS, searchDocumentation } from "../lib/content";

const subscribeToHydration = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function SiteShell({
  currentPath,
  children,
}: {
  currentPath: string;
  children: React.ReactNode;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const interactive = useSyncExternalStore(
    subscribeToHydration,
    getClientSnapshot,
    getServerSnapshot,
  );
  const [query, setQuery] = useState("");
  const searchInput = useRef<HTMLInputElement>(null);
  const results = searchDocumentation(query);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
        setNavigationOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (searchOpen) searchInput.current?.focus();
  }, [searchOpen]);

  return (
    <div className="docs-app" data-theme={dark ? "dark" : "light"}>
      <header className="docs-header">
        <Link className="brand" href="/" aria-label="generative-a11y home">
          generative-a11y
        </Link>
        <button
          className="search-trigger"
          type="button"
          disabled={!interactive}
          onClick={() => setSearchOpen(true)}
          aria-haspopup="dialog"
        >
          <span>Search documentation</span><kbd>⌘ K</kbd>
        </button>
        <div className="docs-actions">
          <button
            className="icon-button"
            type="button"
            disabled={!interactive}
            onClick={() => setDark((value) => !value)}
            aria-label={dark ? "Use light theme" : "Use dark theme"}
          >
            <span aria-hidden="true">{dark ? "☼" : "◐"}</span>
          </button>
          <a className="github-link" href="https://github.com/bhaveshchow20/generative-a11y">
            GitHub <span aria-hidden="true">↗</span>
          </a>
          <button
            className="menu-button"
            type="button"
            disabled={!interactive}
            onClick={() => setNavigationOpen((value) => !value)}
            aria-expanded={navigationOpen}
            aria-controls="docs-navigation"
          >
            {navigationOpen ? "Close" : "Menu"}
          </button>
        </div>
      </header>

      <div className="docs-layout">
        <aside
          id="docs-navigation"
          aria-label="Documentation sidebar"
          className={`docs-sidebar${navigationOpen ? " is-open" : ""}`}
        >
          <nav aria-label="Documentation">
            {NAV_GROUPS.map(({ group, pages }) => (
              <div className="nav-group" key={group}>
                <p>{group}</p>
                {pages.map((page) => (
                  <Link
                    key={page.path}
                    href={page.path}
                    aria-current={page.path === currentPath ? "page" : undefined}
                    onClick={() => setNavigationOpen(false)}
                  >
                    {page.title}
                  </Link>
                ))}
              </div>
            ))}
          </nav>
          <div className="sidebar-foot">
            <Link href="/examples/lifecycle-lab">Open lifecycle lab <span aria-hidden="true">→</span></Link>
            <span>Documentation · API reference</span>
          </div>
        </aside>
        {children}
      </div>

      {searchOpen ? (
        <div className="dialog-backdrop">
          <section
            className="search-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="search-title"
          >
            <div className="search-field">
              <label id="search-title" htmlFor="docs-search">Search documentation</label>
              <input
                ref={searchInput}
                id="docs-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Try “stale response” or “bindAgent”"
              />
              <button type="button" onClick={() => setSearchOpen(false)} aria-label="Close search">Esc</button>
            </div>
            <div className="search-results" aria-live="polite">
              {results.length ? results.slice(0, 8).map((result) => (
                <Link key={result.path} href={result.path} onClick={() => setSearchOpen(false)}>
                  <span><b>{result.title}</b><small>{result.group}</small></span>
                  <p>{result.description}</p>
                </Link>
              )) : (
                <p className="empty-search">No matching page. Try “streaming”, “React”, or “limitations”.</p>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
