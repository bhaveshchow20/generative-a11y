import { getMarkdownCorpus, markdownResponse } from "../../lib/markdown";

export async function GET() {
  return markdownResponse(await getMarkdownCorpus("docs"), "text/plain");
}
