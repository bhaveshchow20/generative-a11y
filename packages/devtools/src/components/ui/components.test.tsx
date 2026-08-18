// @vitest-environment jsdom

import { fireEvent, render, waitFor } from "@testing-library/react";
import { expect, test } from "vitest";

import { CommandDialog } from "./command.js";
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

test("keeps command dialog labelling inside the dialog content", () => {
  render(
    <CommandDialog description="Choose a local action" open title="Commands">
      <p>Actions</p>
    </CommandDialog>,
  );
  const content = document.querySelector('[data-slot="dialog-content"]');
  const header = document.querySelector('[data-slot="dialog-header"]');

  expect(content?.contains(header)).toBe(true);
  expect(document.body.textContent).toContain("Commands");
  expect(document.body.textContent).toContain("Choose a local action");
});
