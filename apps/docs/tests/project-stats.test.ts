import { readdir, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("project download stats", () => {
  it("includes every published workspace package", async () => {
    const packagesDirectory = new URL("../../../packages/", import.meta.url);
    const packageDirectories = await readdir(packagesDirectory, {
      withFileTypes: true,
    });
    const expectedPackages = (
      await Promise.all(
        packageDirectories
          .filter((entry) => entry.isDirectory())
          .map(async (entry) => {
            const manifest = JSON.parse(
              await readFile(
                new URL(`${entry.name}/package.json`, packagesDirectory),
                "utf8",
              ),
            ) as { name: string; private?: boolean };

            return manifest.private ? undefined : manifest.name.split("/").at(-1);
          }),
      )
    )
      .filter((name): name is string => name !== undefined)
      .sort();

    const component = await readFile(
      new URL("../components/project-stats.tsx", import.meta.url),
      "utf8",
    );
    const configuredPackages = component
      .match(/const packages = \[([^\]]+)\]/u)?.[1]
      .match(/"([^"]+)"/gu)
      ?.map((name) => name.slice(1, -1))
      .sort();

    expect(configuredPackages).toEqual(expectedPackages);
  });
});
