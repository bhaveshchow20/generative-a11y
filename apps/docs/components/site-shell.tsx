"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

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
  const menuButton = useRef<HTMLButtonElement>(null);
  const navigation = useRef<HTMLDivElement>(null);
  const searchDialog = useRef<HTMLElement>(null);
  const searchReturnTarget = useRef<HTMLElement | null>(null);
  const results = searchDocumentation(query);
  const apiSection = currentPath.startsWith("/api");
  const navigationGroups = apiSection ? API_NAV_GROUPS : DOC_NAV_GROUPS;

  const openSearch = useCallback((returnTarget?: HTMLElement) => {
    searchReturnTarget.current =
      returnTarget ?? (document.activeElement as HTMLElement | null);
    setNavigationOpen(false);
    setSearchOpen(true);
  }, []);

  const closeSearch = useCallback((restoreFocus = true) => {
    setSearchOpen(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => searchReturnTarget.current?.focus());
    }
  }, []);

  const closeNavigation = useCallback((restoreFocus = true) => {
    setNavigationOpen(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => menuButton.current?.focus());
    }
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openSearch();
      }
      if (event.key === "Escape") {
        if (searchOpen) closeSearch();
        else if (navigationOpen) closeNavigation();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeNavigation, closeSearch, navigationOpen, openSearch, searchOpen]);

  useEffect(() => {
    if (searchOpen) searchInput.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    if (!navigationOpen && !searchOpen) return;

    const container = navigationOpen ? navigation.current : searchDialog.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    if (navigationOpen) {
      window.requestAnimationFrame(() => {
        navigation.current
          ?.querySelector<HTMLElement>('[aria-current="page"]')
          ?.focus({ preventScroll: true });
      });
    }

    function keepFocusInside(event: KeyboardEvent) {
      if (event.key !== "Tab" || !container) return;
      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(
          'a[href], button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hidden);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }

    document.addEventListener("keydown", keepFocusInside);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", keepFocusInside);
    };
  }, [navigationOpen, searchOpen]);

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
          onClick={(event) => openSearch(event.currentTarget)}
          aria-haspopup="dialog"
        >
          <span>Search documentation</span><kbd>⌘ K</kbd>
        </button>
        <div className="docs-actions">
          <button
            className="icon-button mobile-search-button"
            type="button"
            disabled={!interactive}
            onClick={(event) => openSearch(event.currentTarget)}
            aria-label="Search documentation"
            aria-haspopup="dialog"
          >
            <span aria-hidden="true">⌕</span>
          </button>
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
            ref={menuButton}
            className="menu-button"
            type="button"
            disabled={!interactive}
            onClick={() =>
              navigationOpen ? closeNavigation() : setNavigationOpen(true)
            }
            aria-expanded={navigationOpen}
            aria-controls="docs-navigation"
            aria-label={`${navigationOpen ? "Close" : "Open"} documentation navigation. Current page: ${
              navigationGroups
                .flatMap(({ pages }) => pages)
                .find((page) => page.path === currentPath)?.title ?? "Interactive examples"
            }`}
          >
            {navigationOpen ? "Close" : "Menu"}
          </button>
        </div>
      </header>

      <div className="docs-layout">
        {navigationOpen ? (
          <button
            className="docs-navigation-backdrop"
            type="button"
            aria-label="Close documentation navigation"
            onClick={() => closeNavigation()}
          />
        ) : null}
        <div
          ref={navigation}
          id="docs-navigation"
          aria-label={
            navigationOpen
              ? "Documentation navigation"
              : apiSection
                ? "API reference sidebar"
                : "Documentation sidebar"
          }
          aria-modal={navigationOpen ? "true" : undefined}
          role={navigationOpen ? "dialog" : "complementary"}
          className={`docs-sidebar${navigationOpen ? " is-open" : ""}`}
        >
          <nav className="mobile-section-nav" aria-label="Documentation sections">
            <Link href="/docs/getting-started" aria-current={!apiSection ? "page" : undefined}>Docs</Link>
            <Link href="/api" aria-current={apiSection ? "page" : undefined}>API</Link>
          </nav>
          <nav aria-label={apiSection ? "API reference" : "Documentation"}>
            {navigationGroups.map(({ group, pages }) => (
              <div className="nav-group" key={group}>
                <p>{group}</p>
                {pages.map((page) => (
                  <Link
                    key={page.path}
                    href={page.path}
                    aria-current={page.path === currentPath ? "page" : undefined}
                    onClick={() => closeNavigation(false)}
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
        </div>
        {children}
      </div>

      {searchOpen ? (
        <div className="dialog-backdrop">
          <section
            ref={searchDialog}
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
              <button type="button" onClick={() => closeSearch()} aria-label="Close search">Esc</button>
            </div>
            <div className="search-results" aria-live="polite">
              {results.length ? results.slice(0, 8).map((result) => (
                <Link key={result.path} href={result.path} onClick={() => closeSearch(false)}>
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
