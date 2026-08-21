import { HttpAgent } from "@ag-ui/client";
import type { GenerativeA11yEvent } from "@generative-a11y/core";
import { describe, expect, it } from "vitest";

import { bindAgent } from "./index.js";

describe("AG-UI public agent integration", () => {
  it("binds and unbinds the installed public HttpAgent subscription", () => {
    const agent = new HttpAgent({ url: "http://127.0.0.1:9/ag-ui" });
    const events: GenerativeA11yEvent[] = [];
    const binding = bindAgent({
      runtime: {
        dispatch(event) {
          events.push(event);
          return true;
        },
      },
      scopeId: "real-agent",
      agent,
    });
    binding.dispose();
    expect(events).toEqual([]);
  });
});
