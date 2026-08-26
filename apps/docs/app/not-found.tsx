import Link from "next/link";

export default function NotFound() {
  return (
    <main className="not-found">
      <p className="eyebrow">404 · generative-a11y</p>
      <h1>Page not found</h1>
      <p>
        The address may have changed, or the page may never have existed. Start
        with the setup guide, browse the API, or return home.
      </p>
      <nav aria-label="Not found navigation">
        <Link className="button button-primary" href="/docs/getting-started">
          Read the setup guide
        </Link>
        <Link className="button button-secondary" href="/api">
          Browse the API
        </Link>
        <Link className="text-link" href="/">
          Return home
        </Link>
      </nav>
    </main>
  );
}
