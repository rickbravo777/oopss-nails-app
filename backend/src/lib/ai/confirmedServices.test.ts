import { describe, expect, it } from "vitest";

import { buildConfirmedServicesNote, extractConfirmedServiceNames, extractConfirmedServices } from "./confirmedServices";

describe("extractConfirmedServices", () => {
  it("pulls real, found services (id + name) out of a get_service_info result buried in toolCallMeta", () => {
    const history = [
      { toolCallMeta: null },
      {
        toolCallMeta: [
          {
            tool: "get_service_info",
            result: { found: true, services: [{ id: "svc-1", name: "Mani Spa (regular)" }] },
          },
        ],
      },
    ];

    expect(extractConfirmedServices(history)).toEqual([{ id: "svc-1", name: "Mani Spa (regular)" }]);
  });

  it("ignores a not-found get_service_info result — nothing was actually validated", () => {
    const history = [{ toolCallMeta: [{ tool: "get_service_info", result: { found: false } }] }];

    expect(extractConfirmedServices(history)).toEqual([]);
  });

  it("ignores tool calls other than get_service_info (e.g. offer_service_selection's own result shape)", () => {
    const history = [
      {
        toolCallMeta: [
          { tool: "offer_service_selection", result: { shown: true, serviceId: "x", serviceName: "Balayage" } },
        ],
      },
    ];

    expect(extractConfirmedServices(history)).toEqual([]);
  });

  it("de-duplicates the same service (by id) confirmed across multiple turns", () => {
    const history = [
      { toolCallMeta: [{ tool: "get_service_info", result: { found: true, services: [{ id: "svc-1", name: "Balayage" }] } }] },
      { toolCallMeta: [{ tool: "get_service_info", result: { found: true, services: [{ id: "svc-1", name: "Balayage" }] } }] },
    ];

    expect(extractConfirmedServices(history)).toEqual([{ id: "svc-1", name: "Balayage" }]);
  });

  it("skips a service entry missing an id — can't be cross-referenced safely", () => {
    const history = [{ toolCallMeta: [{ tool: "get_service_info", result: { found: true, services: [{ name: "Balayage" }] } }] }];

    expect(extractConfirmedServices(history)).toEqual([]);
  });

  it("tolerates messages with no toolCallMeta at all", () => {
    expect(extractConfirmedServices([{ toolCallMeta: undefined }, { toolCallMeta: null }])).toEqual([]);
  });
});

describe("extractConfirmedServiceNames", () => {
  it("returns just the names from extractConfirmedServices", () => {
    const history = [
      { toolCallMeta: [{ tool: "get_service_info", result: { found: true, services: [{ id: "svc-1", name: "Balayage" }] } }] },
    ];

    expect(extractConfirmedServiceNames(history)).toEqual(["Balayage"]);
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
