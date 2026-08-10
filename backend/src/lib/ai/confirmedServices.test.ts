import { describe, expect, it } from "vitest";

import { buildConfirmedServicesNote, extractConfirmedServiceNames } from "./confirmedServices";

describe("extractConfirmedServiceNames", () => {
  it("pulls real, found service names out of a get_service_info result buried in toolCallMeta", () => {
    const history = [
      { toolCallMeta: null },
      {
        toolCallMeta: [
          {
            tool: "get_service_info",
            result: { found: true, services: [{ name: "Mani Spa (regular)" }] },
          },
        ],
      },
    ];

    expect(extractConfirmedServiceNames(history)).toEqual(["Mani Spa (regular)"]);
  });

  it("ignores a not-found get_service_info result — nothing was actually validated", () => {
    const history = [
      { toolCallMeta: [{ tool: "get_service_info", result: { found: false } }] },
    ];

    expect(extractConfirmedServiceNames(history)).toEqual([]);
  });

  it("ignores tool calls other than get_service_info (e.g. offer_service_selection's own result shape)", () => {
    const history = [
      {
        toolCallMeta: [
          { tool: "offer_service_selection", result: { shown: true, serviceId: "x", serviceName: "Balayage" } },
        ],
      },
    ];

    expect(extractConfirmedServiceNames(history)).toEqual([]);
  });

  it("de-duplicates the same service confirmed across multiple turns", () => {
    const history = [
      { toolCallMeta: [{ tool: "get_service_info", result: { found: true, services: [{ name: "Balayage" }] } }] },
      { toolCallMeta: [{ tool: "get_service_info", result: { found: true, services: [{ name: "Balayage" }] } }] },
    ];

    expect(extractConfirmedServiceNames(history)).toEqual(["Balayage"]);
  });

  it("tolerates messages with no toolCallMeta at all", () => {
    expect(extractConfirmedServiceNames([{ toolCallMeta: undefined }, { toolCallMeta: null }])).toEqual([]);
  });
});

describe("buildConfirmedServicesNote", () => {
  it("returns null when there are no confirmed services — no note injected", () => {
    expect(buildConfirmedServicesNote([])).toBeNull();
  });

  it("lists every confirmed name so the model can use the exact catalog spelling instead of its own prior wording", () => {
    const note = buildConfirmedServicesNote(["Mani Spa (regular)", "Balayage"]);
    expect(note).toContain("Mani Spa (regular)");
    expect(note).toContain("Balayage");
    expect(note).toContain("SERVICIOS YA VALIDADOS");
  });
});
