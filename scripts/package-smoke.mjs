import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { execPath } from "node:process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const packageExports = [
  ["@generative-a11y/core", "", "createGenerativeA11y"],
  ["@generative-a11y/dom", "", "createDOMAnnouncer"],
  ["@generative-a11y/react", "", "GenerativeA11yProvider"],
  ["@generative-a11y/ai-sdk", "", "createObserver"],
  ["@generative-a11y/ai-sdk", "/react", "useChatAccessibility"],
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
  await writeFile(
    join(projectRoot, "package.json"),
    JSON.stringify(
      {
        name: "generative-a11y-package-smoke",
        version: "0.0.0",
        private: true,
        type: "module",
        packageManager: "pnpm@11.21.0",
        dependencies,
      },
      null,
      2,
    ),
  );
  // Workspace dependencies in the archives are rewritten to 0.0.0. Point
  // those dependencies at local archives without consulting a registry.
  const overrides = [
    "@generative-a11y/core",
    "@generative-a11y/dom",
    "@generative-a11y/ai-sdk",
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
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
