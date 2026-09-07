import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import inventory from "../../../docs/api-inventory.json";
import { ApiReference } from "../components/api-reference";

describe("complete public declaration reference", () => {
  it.each(Object.keys(inventory) as (keyof typeof inventory)[])("renders every exported name and signature in %s", (entry) => {
    const html = renderToStaticMarkup(<ApiReference entry={entry} />);
    for (const { name, signature } of inventory[entry]) {
      expect(html).toContain(`<code>${name}</code>`);
      expect(signature.length).toBeGreaterThan(name.length);
    }
    expect((html.match(/<details>/g) ?? []).length).toBe(inventory[entry].length);
  });
});
