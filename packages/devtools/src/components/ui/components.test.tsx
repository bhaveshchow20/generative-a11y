// @vitest-environment jsdom

import { fireEvent, render, waitFor } from "@testing-library/react";
import { expect, test } from "vitest";

import { Tabs, TabsList, TabsTrigger } from "./tabs.js";

test("forwards vertical tab orientation and uses vertical arrow navigation", async () => {
  const view = render(
    <Tabs defaultValue="first" orientation="vertical">
      <TabsList>
        <TabsTrigger value="first">First</TabsTrigger>
        <TabsTrigger value="second">Second</TabsTrigger>
      </TabsList>
    </Tabs>,
  );
  const root = view.container.querySelector('[data-slot="tabs"]');
  const [first, second] = view.getAllByRole("tab");

  expect(root?.getAttribute("data-orientation")).toBe("vertical");
  expect(root?.getAttribute("dir")).toBe("ltr");
  first?.focus();
  fireEvent.keyDown(first as HTMLElement, { key: "ArrowDown" });
  await waitFor(() => expect(document.activeElement).toBe(second));
});
