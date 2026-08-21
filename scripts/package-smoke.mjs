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
import { dirname, join, relative } from "node:path";
import { execPath, stderr } from "node:process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import ts from "typescript";

import {
  assertRuntimeExportParity,
  createCommandRunner,
  createConsumerManifest,
  createPnpmWorkspaceConfig,
  createRuntimeConsumerSource,
  createTypeScriptConsumerSource,
  isKnownUpstreamDeclarationDiagnostic,
  packageInstallArguments,
  packageScenarios,
  toPackedFileDependency,
  typescriptConsumerModes,
} from "./package-smoke-manifest.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const runCommand = createCommandRunner(promisify(execFile));
const require = createRequire(import.meta.url);

for (const { specifier, expectedExport } of packageScenarios) {
  const esm = await import(specifier);
  const cjs = require(specifier);
  assertRuntimeExportParity({ specifier, expectedExport, esm, cjs });
}

const tempRoot = await mkdtemp(
  join(tmpdir(), "generative-a11y-package-smoke-"),
);

try {
  const archiveRoot = join(tempRoot, "archives");
  const projectsRoot = join(tempRoot, "projects");
  await Promise.all([mkdir(archiveRoot), mkdir(projectsRoot)]);

  const packageNames = [
    ...new Set(packageScenarios.map(({ packageName }) => packageName)),
  ];
  for (const packageName of packageNames) {
    await runCommand(
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
  const rootPackage = JSON.parse(
    await readFile(join(root, "package.json"), "utf8"),
  );
  const reportedUpstreamDeclarationIssues = new Set();

  for (const scenario of packageScenarios) {
    const projectRoot = join(projectsRoot, scenario.id);
    await mkdir(projectRoot);
    const packedDependencyFor = (packageName) =>
      toPackedFileDependency(relative(projectRoot, archiveFor(packageName)));
    const internalOverrides = Object.fromEntries(
      scenario.internalPackages.map((packageName) => [
        packageName,
        packedDependencyFor(packageName),
      ]),
    );
    const targetPackageDirectory = scenario.packageName.split("/").at(-1);
    const targetManifest = JSON.parse(
      await readFile(
        join(root, "packages", targetPackageDirectory, "package.json"),
        "utf8",
      ),
    );
    const consumerManifest = createConsumerManifest({
      rootPackage,
      scenario,
      targetDependency: packedDependencyFor(scenario.packageName),
      internalOverrides,
      targetManifest,
    });
    await writeFile(
      join(projectRoot, "package.json"),
      JSON.stringify(consumerManifest, null, 2),
    );
    await writeFile(
      join(projectRoot, "pnpm-workspace.yaml"),
      createPnpmWorkspaceConfig(internalOverrides),
    );

    await runCommand("pnpm", packageInstallArguments, { cwd: projectRoot });

    for (const fixtureName of scenario.fixtures) {
      const installedManifestPath = join(
        projectRoot,
        "node_modules",
        ...fixtureName.split("/"),
        "package.json",
      );
      const installedManifest = JSON.parse(
        await readFile(installedManifestPath, "utf8"),
      );
      const expectedVersion = rootPackage.devDependencies[fixtureName];
      assert.equal(
        installedManifest.version,
        expectedVersion,
        `${scenario.id}: expected ${fixtureName}@${expectedVersion}, observed ${installedManifest.version}`,
      );
    }

    const runtimeConsumerPath = join(projectRoot, "runtime.mjs");
    await writeFile(runtimeConsumerPath, createRuntimeConsumerSource(scenario));
    await runCommand(execPath, [runtimeConsumerPath], { cwd: projectRoot });

    const typeScriptSource = createTypeScriptConsumerSource(scenario);
    for (const mode of typescriptConsumerModes) {
      const consumerPath = join(projectRoot, mode.fileName);
      await writeFile(consumerPath, typeScriptSource);
      const compilerOptions = {
        module: ts.ModuleKind[mode.module],
        moduleResolution: ts.ModuleResolutionKind[mode.moduleResolution],
        noEmit: true,
        skipLibCheck: false,
        strict: true,
        target: ts.ScriptTarget.ES2022,
        types: scenario.fixtures
          .filter((packageName) => packageName.startsWith("@types/"))
          .map((packageName) => packageName.slice("@types/".length)),
      };
      const program = ts.createProgram([consumerPath], compilerOptions);
      const diagnostics = ts.getPreEmitDiagnostics(program);
      const knownUpstreamDiagnostics = diagnostics.filter((diagnostic) =>
        isKnownUpstreamDeclarationDiagnostic(scenario, diagnostic),
      );
      if (
        knownUpstreamDiagnostics.length > 0 &&
        !reportedUpstreamDeclarationIssues.has(scenario.id)
      ) {
        stderr.write(
          `[package-smoke] ${scenario.id}: isolated upstream @ai-sdk/provider declaration defect (TS7016): json-schema has no declaration file; strict checking continues for all other diagnostics.\n`,
        );
        reportedUpstreamDeclarationIssues.add(scenario.id);
      }
      const unexpectedDiagnostics = diagnostics.filter(
        (diagnostic) =>
          !isKnownUpstreamDeclarationDiagnostic(scenario, diagnostic),
      );
      if (unexpectedDiagnostics.length > 0) {
        const formatted = ts.formatDiagnosticsWithColorAndContext(
          unexpectedDiagnostics,
          {
            getCanonicalFileName: (fileName) => fileName,
            getCurrentDirectory: () => projectRoot,
            getNewLine: () => "\n",
          },
        );
        throw new Error(
          `${scenario.id}: TypeScript packed consumer failed in ${mode.name}:\n${formatted}`,
        );
      }
    }
  }
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
