import process from "node:process";
import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

/** Inventory public declarations from the built package export maps. */
export function collectPublicApi(root = process.cwd()) {
  const entries = [];
  for (const directory of readdirSync(resolve(root, "packages")).sort()) {
    const manifest = JSON.parse(
      readFileSync(
        resolve(root, "packages", directory, "package.json"),
        "utf8",
      ),
    );
    for (const [subpath, target] of Object.entries(manifest.exports)) {
      const source = resolve(root, "packages", directory, target.import.types);
      if (!existsSync(source))
        throw new Error(`Build packages before inspecting ${manifest.name}`);
      entries.push({
        entry: manifest.name + (subpath === "." ? "" : subpath.slice(1)),
        source,
      });
    }
  }
  const program = ts.createProgram(
    entries.map(({ source }) => source),
    {
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      skipLibCheck: true,
    },
  );
  const checker = program.getTypeChecker();
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  return Object.fromEntries(
    entries.map(({ entry, source }) => {
      const file = program.getSourceFile(source);
      const symbol = file && checker.getSymbolAtLocation(file);
      if (!symbol) throw new Error(`No module symbol for ${entry}`);
      const names = checker
        .getExportsOfModule(symbol)
        .map((item) => {
          const target =
            item.flags & ts.SymbolFlags.Alias
              ? checker.getAliasedSymbol(item)
              : item;
          const declaration = target.declarations?.[0];
          if (!declaration)
            throw new Error(`Missing declaration for ${entry}:${item.name}`);
          const printed = printer
            .printNode(
              ts.EmitHint.Unspecified,
              declaration,
              declaration.getSourceFile(),
            )
            .trim();
          const signature = ts.isVariableDeclaration(declaration)
            ? `declare const ${printed};`
            : printed;
          return {
            signature,
            name: item.name,
            kind: target.flags & ts.SymbolFlags.Value ? "value" : "type",
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name, "en"));
      return [entry, names];
    }),
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  writeFileSync(
    "docs/api-inventory.json",
    JSON.stringify(collectPublicApi(), null, 2) + "\n",
  );
}
