import { describe, expect, it } from "vitest";

import { offerServiceSelectionTool } from "./offerServiceSelection";

describe("offerServiceSelectionTool", () => {
  it("is a no-argument, no-side-effect signal tool — its only purpose is to appear in " +
    "toolCallMeta so the frontend renders the inline picker", async () => {
    expect(offerServiceSelectionTool.name).toBe("offer_service_selection");
    expect(offerServiceSelectionTool.parameters).toEqual({ type: "object", properties: {} });

    const result = await offerServiceSelectionTool.handler({});

    expect(result).toEqual({ shown: true });
  });
});
