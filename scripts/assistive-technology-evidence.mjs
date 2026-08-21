/* global process */

import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export const REQUIRED_AT_MATRIX = Object.freeze([
  Object.freeze({
    platform: "macos",
    browser: "safari",
    assistiveTechnology: "voiceover",
  }),
  Object.freeze({
    platform: "macos",
    browser: "chrome",
    assistiveTechnology: "voiceover",
  }),
  Object.freeze({
    platform: "windows",
    browser: "chrome",
    assistiveTechnology: "nvda",
  }),
  Object.freeze({
    platform: "windows",
    browser: "firefox",
    assistiveTechnology: "nvda",
  }),
]);

export const REQUIRED_AT_SCENARIOS = Object.freeze([
  "polite-and-repeated-text",
  "assertive",
  "locale",
  "progressive-fallback",
  "focus-preservation",
  "realistic-stream",
]);

const REQUIRED_PATHS = ["auto", "live-region"];
const METADATA_FIELDS = [
  "tester",
  "hardware",
  "osVersion",
  "browserVersion",
  "assistiveTechnologyVersion",
  "settings",
];
const PLACEHOLDER = /^(?:tbd|todo|unknown|n\/a|none|placeholder|exact .+)$/iu;

function combinationKey(value) {
  return `${String(value?.platform)}/${String(value?.browser)}/${String(value?.assistiveTechnology)}`;
}

function isTimestamp(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)
  ) {
    return false;
  }
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}

function isRealValue(value, minimumLength = 3) {
  return (
    typeof value === "string" &&
    value.trim().length >= minimumLength &&
    !PLACEHOLDER.test(value.trim())
  );
}

function validateFreshTimestamp(errors, label, value, now) {
  if (!isTimestamp(value)) {
    errors.push(`${label} must be a canonical UTC ISO timestamp`);
    return undefined;
  }
  const timestamp = Date.parse(value);
  const age = now.getTime() - timestamp;
  if (age < -5 * 60 * 1000) errors.push(`${label} must not be in the future`);
  if (age > 30 * 24 * 60 * 60 * 1000) {
    errors.push(`${label} must be no more than 30 days old`);
  }
  return timestamp;
}

export function validateAssistiveTechnologyEvidence(
  evidence,
  { sourceCommit, now = new Date() } = {},
) {
  const errors = [];

  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) {
    return ["evidence must be a JSON object"];
  }

  if (evidence.schemaVersion !== 1) errors.push("schemaVersion must be 1");
  if (!/^[a-f\d]{40}$/u.test(evidence.sourceCommit ?? "")) {
    errors.push("sourceCommit must be a full 40-character lowercase Git SHA");
  }
  if (sourceCommit && evidence.sourceCommit !== sourceCommit.toLowerCase()) {
    errors.push(`sourceCommit must match ${sourceCommit.toLowerCase()}`);
  }
  const completedAt = validateFreshTimestamp(
    errors,
    "completedAt",
    evidence.completedAt,
    now,
  );
  if (!Array.isArray(evidence.results)) {
    errors.push("results must be an array");
    return errors;
  }

  const resultsByKey = new Map();
  for (const result of evidence.results) {
    const key = combinationKey(result);
    if (resultsByKey.has(key)) errors.push(`duplicate result: ${key}`);
    else resultsByKey.set(key, result);
  }

  for (const required of REQUIRED_AT_MATRIX) {
    const key = combinationKey(required);
    const result = resultsByKey.get(key);
    if (!result) {
      errors.push(`missing required result: ${key}`);
      continue;
    }

    const testedAt = validateFreshTimestamp(
      errors,
      `${key}: testedAt`,
      result.testedAt,
      now,
    );
    if (
      completedAt !== undefined &&
      testedAt !== undefined &&
      testedAt > completedAt
    ) {
      errors.push(`${key}: testedAt must not be after completedAt`);
    }
    for (const field of METADATA_FIELDS) {
      const minimumLength = field === "tester" ? 3 : 8;
      const hasVersion =
        !field.endsWith("Version") || /\d/u.test(result[field] ?? "");
      if (!isRealValue(result[field], minimumLength) || !hasVersion) {
        errors.push(`${key}: ${field} must be a real, non-placeholder value`);
      }
    }

    if (!Array.isArray(result.paths)) {
      errors.push(`${key}: paths must be an array`);
      continue;
    }

    const pathsByName = new Map();
    for (const path of result.paths) {
      if (pathsByName.has(path?.deliveryPath)) {
        errors.push(
          `${key}: duplicate delivery path ${String(path?.deliveryPath)}`,
        );
      } else {
        pathsByName.set(path?.deliveryPath, path);
      }
    }

    for (const requiredPath of REQUIRED_PATHS) {
      const path = pathsByName.get(requiredPath);
      if (!path) {
        errors.push(`${key}: missing delivery path ${requiredPath}`);
        continue;
      }
      if (!Array.isArray(path.scenarios)) {
        errors.push(`${key} ${requiredPath}: scenarios must be an array`);
        continue;
      }

      const scenariosByName = new Map();
      for (const scenario of path.scenarios) {
        if (scenariosByName.has(scenario?.scenario)) {
          errors.push(
            `${key} ${requiredPath}: duplicate scenario ${String(scenario?.scenario)}`,
          );
        } else {
          scenariosByName.set(scenario?.scenario, scenario);
        }
      }

      for (const requiredScenario of REQUIRED_AT_SCENARIOS) {
        const scenario = scenariosByName.get(requiredScenario);
        const prefix = `${key} ${requiredPath} ${requiredScenario}`;
        if (!scenario) {
          errors.push(`${prefix}: missing scenario`);
          continue;
        }
        if (scenario.status !== "pass")
          errors.push(`${prefix}: status must be pass`);
        if (!isRealValue(scenario.notes, 20)) {
          errors.push(
            `${prefix}: notes must be a real, non-placeholder observation`,
          );
        }
      }
    }
  }

  return errors;
}

async function main(argv) {
  const fileIndex = argv.indexOf("--file");
  const commitIndex = argv.indexOf("--source-commit");
  const file = fileIndex >= 0 ? argv[fileIndex + 1] : undefined;
  const sourceCommit = commitIndex >= 0 ? argv[commitIndex + 1] : undefined;
  if (!file || !sourceCommit) {
    throw new Error(
      "Usage: node scripts/assistive-technology-evidence.mjs --file <path> --source-commit <sha>",
    );
  }

  const evidence = JSON.parse(await readFile(file, "utf8"));
  const errors = validateAssistiveTechnologyEvidence(evidence, {
    sourceCommit,
  });
  if (errors.length > 0) {
    throw new Error(
      `Assistive-technology release evidence is invalid:\n- ${errors.join("\n- ")}`,
    );
  }
  process.stdout.write(
    `Validated required assistive-technology evidence for ${sourceCommit}.\n`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
