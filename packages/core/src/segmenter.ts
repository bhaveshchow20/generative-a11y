import type { TextStrategy } from "./types.js";

export interface SegmentationResult {
  complete: string[];
  remainder: string;
}

const TERMINAL_PUNCTUATION = /[.!?。！？…]["'”’»）)\]}]*\s*$/u;
const TRAILING_ABBREVIATION =
  /(?:\b(?:dr|mr|mrs|ms|prof|sr|jr|st|vs|etc|e\.g|i\.e)\.|(?:\b[A-Z]\.){1,3})\s*$/iu;

function clean(text: string): string {
  return text.replace(/[ \t\f\v]+/gu, " ").trim();
}

function isCompleteSentence(segment: string): boolean {
  const trimmed = segment.trim();
  return (
    TERMINAL_PUNCTUATION.test(trimmed) && !TRAILING_ABBREVIATION.test(trimmed)
  );
}

function sentenceSegments(text: string, locale?: string): string[] {
  if (typeof Intl.Segmenter === "function") {
    let segmenter: Intl.Segmenter;
    try {
      segmenter = new Intl.Segmenter(locale, { granularity: "sentence" });
    } catch {
      segmenter = new Intl.Segmenter(undefined, { granularity: "sentence" });
    }
    return [...segmenter.segment(text)].map(({ segment }) => segment);
  }
  const segments: string[] = [];
  const boundary = /[.!?。！？…]["'”’»）)\]}]?\s+/gu;
  let start = 0;
  for (const match of text.matchAll(boundary)) {
    const end = (match.index ?? 0) + match[0].length;
    segments.push(text.slice(start, end));
    start = end;
  }
  if (start < text.length) segments.push(text.slice(start));
  return segments;
}

export function segmentText(
  text: string,
  strategy: Exclude<TextStrategy, "silent" | "completion">,
  locale?: string,
): SegmentationResult {
  if (strategy === "paragraph") {
    const pieces = text.split(/\n\s*\n/u);
    const endsAtBoundary = /\n\s*\n$/u.test(text);
    const remainder = endsAtBoundary ? "" : (pieces.pop() ?? "");
    return { complete: pieces.map(clean).filter(Boolean), remainder };
  }

  const pieces = sentenceSegments(text, locale);
  const complete: string[] = [];
  let remainder = "";
  for (const [index, piece] of pieces.entries()) {
    const candidate = remainder + piece;
    const hasBoundaryEvidence = index < pieces.length - 1 || /\s$/u.test(piece);
    if (hasBoundaryEvidence && isCompleteSentence(candidate)) {
      complete.push(clean(candidate));
      remainder = "";
    } else {
      remainder = candidate;
    }
  }
  return { complete, remainder };
}

export function normalizeAnnouncementText(text: string): string {
  return text.replace(/\s+/gu, " ").trim();
}
