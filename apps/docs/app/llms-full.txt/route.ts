import { getMarkdownCorpus, markdownResponse } from "../../lib/markdown";

export async function GET() {
  return markdownResponse(
    `# generative-a11y full documentation\n\n${await getMarkdownCorpus()}`,
    "text/plain",
  );
}
