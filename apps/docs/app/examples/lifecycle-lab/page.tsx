import type { Metadata } from "next";
import Link from "next/link";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "fumadocs-ui/page";

import { LifecycleLab } from "../../../components/lifecycle-lab";
import { FrameworkShowcaseLoader } from "../../../components/framework-showcase-loader";
import { JsonLd } from "../../../components/json-ld";
import { createArticleJsonLd, createPageMetadata } from "../../../lib/seo";

export const metadata: Metadata = createPageMetadata({
  path: "/examples/lifecycle-lab",
  title: "Interactive examples",
  description:
    "Run streaming response, tool, approval, failure, and retry scenarios through the real generative-a11y runtime and browser DOM delivery package.",
});

export default function LifecycleLabPage() {
  return (
    <>
      <JsonLd
        data={createArticleJsonLd({
          path: "/examples/lifecycle-lab",
          title: "Interactive examples",
          description:
            "Interactive examples of paced screen-reader announcements for streaming responses, tool execution, approval, failure, and retry states.",
        })}
      />
      <DocsPage toc={[]} full>
        <DocsTitle>See the library at work</DocsTitle>
        <DocsDescription>
          Run response, tool, retry, and approval scenarios through the real
          runtime and DOM packages.
        </DocsDescription>
        <DocsBody>
          <p>
            Follow each app event, runtime update, and browser result. The
            transcript confirms what the library added to the page. Test with a
            real screen reader to confirm what it speaks.
          </p>
          <h2 id="lab-guide-title">What the lifecycle lab demonstrates</h2>
          <ul>
            <li>
              <strong>Streaming response:</strong> paced updates instead of
              token-by-token announcements.
            </li>
            <li>
              <strong>Tool execution:</strong> concise progress and result
              updates tied to one tool identity.
            </li>
            <li>
              <strong>Approval request:</strong> higher-priority requests for
              input without moving focus.
            </li>
            <li>
              <strong>Failure and retry:</strong> terminal and retry events
              remain attached to the response that produced them.
            </li>
          </ul>
          <p>
            <Link href="/docs/getting-started">Set up the packages</Link>
            {" · "}
            <Link href="/api/core">Read the core API</Link>
            {" · "}
            <a href="https://github.com/bhaveshchow20/generative-a11y/tree/main/apps/docs">
              View source on GitHub
            </a>
          </p>
        </DocsBody>
        <div className="examples-content">
          <LifecycleLab />
          <FrameworkShowcaseLoader />
        </div>
      </DocsPage>
    </>
  );
}
