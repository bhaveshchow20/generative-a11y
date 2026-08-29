import { readFile } from "node:fs/promises";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const viteConfigUrl = new URL("../vite.config.ts", import.meta.url);

describe("Fumadocs compatibility configuration", () => {
  it("pins the compatible Fumadocs package versions", async () => {
    const packageJson = JSON.parse(
      await readFile(new URL("../package.json", import.meta.url), "utf8"),
    ) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const declaredPackages = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    expect(declaredPackages).toMatchObject({
      "fumadocs-core": "16.15.4",
      "fumadocs-mdx": "15.4.0",
      "fumadocs-ui": "npm:@fumadocs/base-ui@16.15.4",
    });
  });

  it("runs Fumadocs MDX before the existing hosting plugins", async () => {
    const viteConfig = await readFile(viteConfigUrl, "utf8");
    const sourceFile = ts.createSourceFile(
      "vite.config.ts",
      viteConfig,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const pluginArrays: ts.ArrayLiteralExpression[] = [];

    const visit = (node: ts.Node) => {
      if (
        ts.isReturnStatement(node) &&
        node.expression &&
        ts.isObjectLiteralExpression(node.expression)
      ) {
        const pluginsProperty = node.expression.properties.find(
          (property): property is ts.PropertyAssignment =>
            ts.isPropertyAssignment(property) &&
            ((ts.isIdentifier(property.name) && property.name.text === "plugins") ||
              (ts.isStringLiteral(property.name) && property.name.text === "plugins")),
        );
        if (
          pluginsProperty &&
          ts.isArrayLiteralExpression(pluginsProperty.initializer)
        ) {
          pluginArrays.push(pluginsProperty.initializer);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);

    expect(pluginArrays).toHaveLength(1);
    const pluginNames = pluginArrays[0].elements.flatMap((element) => {
      if (!ts.isCallExpression(element)) return [];
      return ts.isIdentifier(element.expression)
        ? [element.expression.text]
        : [];
    });
    const expectedOrder = ["fumadocsMdx", "vinext", "sites", "cloudflare"];

    expect(pluginNames.filter((name) => expectedOrder.includes(name))).toEqual(
      expectedOrder,
    );
  });
});
