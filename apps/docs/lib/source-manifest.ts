import type { StructuredData } from "fumadocs-core/mdx-plugins";

import { apiSource, docsSource } from "./source";

export interface SourceManifestEntry {
  readonly publicPath: string;
  readonly section: string;
  readonly title: string;
  readonly description: string;
  readonly related: readonly string[];
  readonly structured: {
    readonly headings: readonly {
      readonly id: string;
      readonly content: string;
    }[];
    readonly contents: readonly {
      readonly heading: string | undefined;
      readonly content: string;
    }[];
  };
  readonly searchableText: string;
}

interface MigratedFrontmatter {
  readonly title?: unknown;
  readonly description?: unknown;
  readonly publicPath?: unknown;
  readonly section?: unknown;
  readonly related?: unknown;
  readonly order?: unknown;
  readonly sourceMetadata?: {
    readonly publicPath?: unknown;
    readonly section?: unknown;
    readonly related?: unknown;
    readonly order?: unknown;
  };
  readonly _exports?: {
    readonly sourceMetadata?: MigratedFrontmatter["sourceMetadata"];
    readonly searchableText?: unknown;
  };
  readonly structuredData?:
    StructuredData | (() => StructuredData | Promise<StructuredData>);
}

function requiredString(
  value: unknown,
  field: string,
  sourcePath: string,
): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Missing ${field} in migrated source ${sourcePath}`);
  }
  return value;
}

async function resolveStructuredData(
  data: MigratedFrontmatter,
  sourcePath: string,
): Promise<StructuredData> {
  const structured =
    typeof data.structuredData === "function"
      ? await data.structuredData()
      : data.structuredData;
  if (!structured) {
    throw new Error(`Missing structuredData in migrated source ${sourcePath}`);
  }
  return structured;
}

/** Build serializable search and navigation data from server-only MDX sources. */
export async function getSourceManifest(): Promise<
  readonly SourceManifestEntry[]
> {
  const pages = [
    ...docsSource.getPages().map((page) => ({ collection: 0, page })),
    ...apiSource.getPages().map((page) => ({ collection: 1, page })),
  ];

  const entries = await Promise.all(
    pages.map(async ({ collection, page }) => {
      const data = page.data as MigratedFrontmatter;
      const sourceMetadata =
        data.sourceMetadata ?? data._exports?.sourceMetadata;
      const searchableText = requiredString(
        data._exports?.searchableText,
        "searchableText",
        page.path,
      );
      const title = requiredString(data.title, "title", page.path);
      const description = requiredString(
        data.description,
        "description",
        page.path,
      );
      const publicPath = requiredString(
        sourceMetadata?.publicPath ?? data.publicPath,
        "publicPath",
        page.path,
      );
      const section = requiredString(
        sourceMetadata?.section ?? data.section,
        "section",
        page.path,
      );
      const related = sourceMetadata?.related ?? data.related;
      if (
        !Array.isArray(related) ||
        !related.every((value) => typeof value === "string")
      ) {
        throw new Error(
          `Invalid related links in migrated source ${page.path}`,
        );
      }
      const structured = await resolveStructuredData(data, page.path);
      return {
        collection,
        order:
          typeof (sourceMetadata?.order ?? data.order) === "number"
            ? ((sourceMetadata?.order ?? data.order) as number)
            : Number.MAX_SAFE_INTEGER,
        entry: {
          publicPath,
          section,
          title,
          description,
          related: [...related],
          structured: {
            headings: structured.headings.map(({ id, content }) => ({
              id,
              content,
            })),
            contents: structured.contents.map(({ heading, content }) => ({
              heading,
              content,
            })),
          },
          searchableText,
        } satisfies SourceManifestEntry,
      };
    }),
  );

  return entries
    .sort(
      (left, right) =>
        left.collection - right.collection || left.order - right.order,
    )
    .map(({ entry }) => entry);
}
