"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { API_NAV_GROUPS, DOC_NAV_GROUPS, searchDocumentation } from "../lib/content";
import { ProjectStats } from "./project-stats";

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
  const apiSection = currentPath.startsWith("/api");
  const navigationGroups = apiSection ? API_NAV_GROUPS : DOC_NAV_GROUPS;

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
        <div className="docs-primary">
          <Link className="brand" href="/" aria-label="generative-a11y home">
            generative-a11y
          </Link>
          <nav className="section-nav" aria-label="Documentation sections">
            <Link href="/docs/getting-started" aria-current={!apiSection ? "page" : undefined}>Docs</Link>
            <Link href="/api" aria-current={apiSection ? "page" : undefined}>API</Link>
          </nav>
        </div>
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
          <ProjectStats className="project-stats-docs" />
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
          aria-label={apiSection ? "API reference sidebar" : "Documentation sidebar"}
          className={`docs-sidebar${navigationOpen ? " is-open" : ""}`}
        >
          <nav aria-label={apiSection ? "API reference" : "Documentation"}>
            {navigationGroups.map(({ group, pages }) => (
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
            <Link href="/examples/lifecycle-lab">Try interactive examples <span aria-hidden="true">→</span></Link>
            <span>{apiSection ? "Packages and API symbols" : "Setup and integration guides"}</span>
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
