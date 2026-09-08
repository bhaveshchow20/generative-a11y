import { asMarkdown, renderToMarkdown } from "fumadocs-core/server";
import type { MDXComponents } from "mdx/types";
import type { ReactNode } from "react";
import inventory from "../../../docs/api-inventory.json";

function Container({ children }: { children?: ReactNode }) {
  asMarkdown();
  return children;
}

async function Callout({
  title,
  children,
}: {
  title?: ReactNode;
  children?: ReactNode;
}) {
  asMarkdown();
  const text = await renderToMarkdown(children);
  return `${title ? `**${await renderToMarkdown(title)}**\n\n` : ""}${text}`;
}

async function TypeTable({
  type,
}: {
  type: Record<
    string,
    {
      type: ReactNode;
      description?: ReactNode;
      default?: ReactNode;
      required?: boolean;
    }
  >;
}) {
  asMarkdown();
  const cell = async (value: ReactNode) =>
    (await renderToMarkdown(value))
      .trim()
      .replaceAll(/\s+/g, " ")
      .replaceAll("|", "\\|");
  const codeCell = async (value: ReactNode) => {
    const text = await cell(value);
    if (!text) return "";
    const fence = "`".repeat(
      Math.max(
        0,
        ...[...text.matchAll(/`+/g)].map((match) => match[0].length),
      ) + 1,
    );
    return `${fence} ${text} ${fence}`;
  };
  const rows = await Promise.all(
    Object.entries(type).map(
      async ([name, value]) =>
        `| ${await cell(name)} | ${await codeCell(value.type)} | ${value.required ? "yes" : "no"} | ${await codeCell(value.default)} | ${await cell(value.description)} |`,
    ),
  );
  return [
    "| Property | Type | Required | Default | Description |",
    "| --- | --- | --- | --- | --- |",
    ...rows,
  ].join("\n");
}

function ApiReference({ entry }: { entry: keyof typeof inventory }) {
  asMarkdown();
  return `## Public declarations: ${entry}\n\nImport from \`${entry}\`. Direct declarations from the source checkout; transitive upstream types and behavioral contracts require the linked guides and upstream documentation.\n\n${inventory[entry].map(({ name, kind, signature }) => `### ${name} (${kind})\n\n\`\`\`typescript\n${signature}\n\`\`\``).join("\n\n")}`;
}

/** Server-only equivalents of custom content, without visual/navigation markup. */
export const markdownComponents = {
  Steps: Container,
  Step: Container,
  Callout,
  TypeTable,
  ApiReference,
} satisfies MDXComponents;
