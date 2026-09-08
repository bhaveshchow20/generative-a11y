// Run after pnpm build: node tests/consumer/packed-onboarding.mjs
import { URL } from "node:url";
import process from "node:process";
import console from "node:console";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  writeFile,
  rm,
  access,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";
import { isKnownUpstreamDeclarationDiagnostic } from "../../scripts/package-smoke-manifest.mjs";

const require = createRequire(import.meta.url);
const aiRequire = createRequire(require.resolve("ai"));
const zodVersion = aiRequire("zod/package.json").version;
const root = new URL("../../", import.meta.url);
const temporary = await mkdtemp(join(tmpdir(), "generative-a11y-onboarding-"));
const run = (args, cwd = temporary) =>
  execFileSync("pnpm", args, {
    cwd,
    encoding: "utf8",
    timeout: 120_000,
    stdio: "pipe",
  });
try {
  const archives = join(temporary, "archives");
  await mkdir(archives);
  const packed = {};
  for (const name of ["core", "dom", "react", "ai-sdk"]) {
    run(
      [
        "--filter",
        `@generative-a11y/${name}`,
        "pack",
        "--pack-destination",
        archives,
      ],
      root,
    );
    const archive = (await readdir(archives)).find((file) =>
      file.startsWith(`generative-a11y-${name}-`),
    );
    assert.ok(archive);
    packed[`@generative-a11y/${name}`] = `file:./archives/${archive}`;
  }
  const manifest = JSON.parse(
    await readFile(new URL("package.json", root), "utf8"),
  );
  await writeFile(
    join(temporary, "package.json"),
    JSON.stringify(
      {
        name: "onboarding-consumer",
        private: true,
        type: "module",
        packageManager: manifest.packageManager,
        dependencies: {
          zod: zodVersion,
          "@generative-a11y/react": packed["@generative-a11y/react"],
          "@generative-a11y/ai-sdk": packed["@generative-a11y/ai-sdk"],
          ...Object.fromEntries(
            ["ai", "@ai-sdk/react", "react", "react-dom"].map((name) => [
              name,
              manifest.devDependencies[name],
            ]),
          ),
        },
        devDependencies: Object.fromEntries(
          ["@types/react", "@types/react-dom", "@types/node"].map((name) => [
            name,
            manifest.devDependencies[name],
          ]),
        ),
      },
      null,
      2,
    ),
  );
  await writeFile(
    join(temporary, "pnpm-workspace.yaml"),
    JSON.stringify({
      overrides: packed,
      hoist: false,
      publicHoistPattern: [],
      autoInstallPeers: false,
    }),
  );
  run([
    "install",
    "--strict-peer-dependencies",
    "--ignore-scripts",
    "--prefer-offline",
    "--lockfile=false",
  ]);
  for (const name of ["core", "dom"]) {
    await assert.rejects(
      access(join(temporary, "node_modules/@generative-a11y", name)),
      { code: "ENOENT" },
    );
  }
  const source = await readFile(
    new URL("examples/consumer-journeys/chat.tsx", root),
    "utf8",
  );
  assert.ok(source.startsWith('"use client";'));
  const filename = join(temporary, "chat.tsx");
  await writeFile(filename, source);
  for (const [module, moduleResolution] of [
    [ts.ModuleKind.NodeNext, ts.ModuleResolutionKind.NodeNext],
    [ts.ModuleKind.ESNext, ts.ModuleResolutionKind.Bundler],
  ]) {
    const program = ts.createProgram([filename], {
      module,
      moduleResolution,
      strict: true,
      exactOptionalPropertyTypes: false,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
      noEmit: true,
      skipLibCheck: false,
      types: ["node", "react", "react-dom"],
      typeRoots: [join(temporary, "node_modules/@types")],
    });
    const diagnostics = ts.getPreEmitDiagnostics(program);
    const unexpected = diagnostics.filter(
      (diagnostic) =>
        !isKnownUpstreamDeclarationDiagnostic(
          { id: "ai-sdk-onboarding" },
          diagnostic,
        ),
    );
    if (diagnostics.length !== unexpected.length)
      process.stderr.write(
        "Known upstream @ai-sdk/provider TS7016 json-schema declaration defect; all other declarations checked.\n",
      );
    assert.equal(
      unexpected.length,
      0,
      ts.formatDiagnosticsWithColorAndContext(unexpected, {
        getCanonicalFileName: (file) => file,
        getCurrentDirectory: () => temporary,
        getNewLine: () => "\n",
      }),
    );
  }
  await writeFile(
    join(temporary, "chat.mjs"),
    ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
  );
  await writeFile(
    join(temporary, "ssr.mjs"),
    `import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToString} from 'react-dom/server';
import {App} from './chat.mjs';
const html = renderToString(createElement(App));
assert.equal((html.match(/aria-live=/g) ?? []).length, 2);
assert.ok(html.includes('Message'));
assert.equal(typeof (await import('@generative-a11y/ai-sdk')).createChatObserver, 'function');
`,
  );
  execFileSync(process.execPath, [join(temporary, "ssr.mjs")], {
    cwd: temporary,
    stdio: "pipe",
  });
  console.log(
    "Packed onboarding passed: two direct library dependencies, no root core/DOM resolution, strict NodeNext/Bundler types, client directive and SSR.",
  );
} catch (error) {
  if (error.stdout) process.stderr.write(String(error.stdout));
  if (error.stderr) process.stderr.write(String(error.stderr));
  throw error;
} finally {
  await rm(temporary, { recursive: true, force: true });
}
