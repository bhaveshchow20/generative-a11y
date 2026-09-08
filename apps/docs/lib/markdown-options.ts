import type { LLMsOptions } from "fumadocs-core/mdx-plugins/remark-llms";

/** Process content, leaving component props available to Markdown renderers. */
export const markdownOptions: LLMsOptions = {
  output: "function",
  headingIds: false,
  stringify(node, _parent, state, info) {
    if (
      node.type === "mdxFlowExpression" ||
      node.type === "mdxTextExpression"
    ) {
      if (/^\s*\/\*/.test(node.value)) return "\n";
    }
    if (node.type !== "mdxJsxFlowElement" && node.type !== "mdxJsxTextElement")
      return;
    const children = () =>
      node.type === "mdxJsxFlowElement"
        ? state.containerFlow(node, info)
        : state.containerPhrasing(node, info);
    switch (node.name) {
      case "a": {
        const href = node.attributes.find(
          (attribute) =>
            attribute.type === "mdxJsxAttribute" && attribute.name === "href",
        );
        if (
          href?.type === "mdxJsxAttribute" &&
          typeof href.value === "string"
        ) {
          return `[${children().trim()}](${href.value})`;
        }
        return children();
      }
      case "span":
        return children() || "\n";
      case "div":
        return children() || "\n";
      case "table":
        return children().replaceAll(/\n{2,}(?=\|)/g, "\n");
      case "tbody":
        return children();
      case "thead": {
        const header = children().trim();
        const count = node.children.flatMap((child) =>
          child.type === "mdxJsxFlowElement" && child.name === "tr"
            ? child.children.filter(
                (cell) =>
                  cell.type === "mdxJsxFlowElement" && cell.name === "th",
              )
            : [],
        ).length;
        return `${header}\n| ${Array.from({ length: count }, () => "---").join(" | ")} |`;
      }
      case "tr":
        return `| ${children().trim().replaceAll(/\n+/g, " ")} |`;
      case "td":
      case "th": {
        const value = children().trim().replaceAll("|", "\\|");
        const siblings =
          _parent && "children" in _parent ? _parent.children : [];
        return `${siblings.indexOf(node) > 0 ? "| " : ""}${value}`;
      }
    }
  },
};
