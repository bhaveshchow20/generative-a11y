import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { execPath } from "node:process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import ts from "typescript";

import {
  createConsumerManifest,
  createTypeScriptConsumerSource,
  typescriptConsumerModes,
} from "./package-smoke-manifest.mjs";

const execFileAsync = promisify(execFile);
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const packageExports = [
  ["@generative-a11y/core", "", "createGenerativeA11y"],
  ["@generative-a11y/dom", "", "createDOMAnnouncer"],
  ["@generative-a11y/react", "", "GenerativeA11yProvider"],
  ["@generative-a11y/ai-sdk", "", "createObserver"],
  ["@generative-a11y/ai-sdk", "/react", "useChatAccessibility"],
  ["@generative-a11y/assistant-ui", "", "bindThreadRuntime"],
  ["@generative-a11y/ag-ui", "", "bindAgent"],
];

const packageNames = [
  ...new Set(packageExports.map(([packageName]) => packageName)),
];
for (const [packageName, subpath, expectedExport] of packageExports) {
  const specifier = `${packageName}${subpath}`;
  const esm = await import(specifier);
  const cjs = createRequire(import.meta.url)(specifier);
  assert.equal(typeof esm[expectedExport], "function");
  assert.equal(typeof cjs[expectedExport], "function");
  assert.deepEqual(Object.keys(esm).sort(), Object.keys(cjs).sort());
}

const tempRoot = await mkdtemp(
  join(tmpdir(), "generative-a11y-package-smoke-"),
);
const archiveRoot = join(tempRoot, "archives");
const projectRoot = join(tempRoot, "project");
await Promise.all([mkdir(archiveRoot), mkdir(projectRoot)]);

try {
  for (const packageName of packageNames) {
    await execFileAsync(
      "pnpm",
      ["--filter", packageName, "pack", "--pack-destination", archiveRoot],
      { cwd: root },
    );
  }

  const archives = await readdir(archiveRoot);
  const archiveFor = (packageName) => {
    const packageStem = packageName.replace(/^@/, "").replace("/", "-");
    const archive = archives.find(
      (name) => name.startsWith(`${packageStem}-`) && name.endsWith(".tgz"),
    );
    assert.ok(archive, `packed archive missing for ${packageName}`);
    return join(archiveRoot, archive);
  };

  const dependencies = Object.fromEntries(
    packageNames.map((packageName) => [
      packageName,
      `file:${archiveFor(packageName)}`,
    ]),
  );
  const rootPackage = JSON.parse(
    await readFile(join(root, "package.json"), "utf8"),
  );
  await writeFile(
    join(projectRoot, "package.json"),
    JSON.stringify(createConsumerManifest(rootPackage, dependencies), null, 2),
  );
  // Workspace dependencies in the archives are rewritten to 0.0.0. Point
  // those dependencies at local archives without consulting a registry.
  const overrides = [
    "@generative-a11y/core",
    "@generative-a11y/dom",
    "@generative-a11y/ai-sdk",
    "@generative-a11y/assistant-ui",
    "@generative-a11y/ag-ui",
  ]
    .map(
      (packageName) => `  "${packageName}": "file:${archiveFor(packageName)}"`,
    )
    .join("\n");
  await writeFile(
    join(projectRoot, "pnpm-workspace.yaml"),
    `overrides:\n${overrides}\n`,
  );

  await execFileAsync("pnpm", ["install", "--lockfile=false", "--offline"], {
    cwd: projectRoot,
  });
  await writeFile(
    join(projectRoot, "smoke.mjs"),
    `import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
for (const [packageName, subpath, expectedExport] of ${JSON.stringify(packageExports)}) {
  const specifier = \`${"${packageName}"}\${subpath}\`;
  const esm = await import(specifier);
  const cjs = require(specifier);
  assert.equal(typeof esm[expectedExport], "function");
  assert.equal(typeof cjs[expectedExport], "function");
  assert.deepEqual(Object.keys(esm).sort(), Object.keys(cjs).sort());
}
`,
  );
  await execFileAsync(execPath, [join(projectRoot, "smoke.mjs")], {
    cwd: projectRoot,
  });

  const typeScriptSource = createTypeScriptConsumerSource();
  for (const mode of typescriptConsumerModes) {
    const consumerPath = join(projectRoot, mode.fileName);
    await writeFile(consumerPath, typeScriptSource);
    const compilerOptions = {
      module: ts.ModuleKind[mode.module],
      moduleResolution: ts.ModuleResolutionKind[mode.moduleResolution],
      noEmit: true,
      skipLibCheck: true,
      strict: true,
      target: ts.ScriptTarget.ES2022,
      types: [],
    };
    const program = ts.createProgram([consumerPath], compilerOptions);
    const diagnostics = ts.getPreEmitDiagnostics(program);
    if (diagnostics.length > 0) {
      const formatted = ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getCanonicalFileName: (fileName) => fileName,
        getCurrentDirectory: () => projectRoot,
        getNewLine: () => "\n",
      });
      throw new Error(
        `TypeScript packed consumer failed in ${mode.name}:\n${formatted}`,
      );
    }
  }
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
