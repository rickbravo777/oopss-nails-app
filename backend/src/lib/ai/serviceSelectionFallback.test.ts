import { describe, expect, it } from "vitest";

import { withServiceSelectionFallback } from "./serviceSelectionFallback";

describe("withServiceSelectionFallback", () => {
  it("leaves the log untouched when offer_service_selection was already called", () => {
    const log = [{ tool: "offer_service_selection", arguments: {}, result: { shown: true } }];
    const result = withServiceSelectionFallback(log, "¡Claro! Aquí tienes nuestros servicios 👇");
    expect(result).toBe(log);
  });

  it("leaves the log untouched when the reply doesn't ask which service", () => {
    const log = [{ tool: "get_service_info", arguments: { query: "manicure gel" }, result: { found: true } }];
    const result = withServiceSelectionFallback(log, "El Manicure Gel cuesta $24 con Tania o Mariangely.");
    expect(result).toBe(log);
  });

  it("injects a fallback offer_service_selection entry when the model asks which service in text without calling the tool", () => {
    const result = withServiceSelectionFallback(
      [],
      "¡Genial! 😊 Para agendar tu cita, necesito que me digas qué servicio te gustaría.",
    );
    expect(result).toEqual([{ tool: "offer_service_selection", arguments: {}, result: { shown: true, fallback: true } }]);
  });

  it("matches other common phrasings of the same question", () => {
    const phrasings = [
      "¿Cuál servicio deseas agendar?",
      "¿Qué tipo de servicio te gustaría?",
      "Cuéntame qué sub servicio prefieres dentro de uñas.",
    ];
    for (const content of phrasings) {
      expect(withServiceSelectionFallback([], content)).toEqual([
        { tool: "offer_service_selection", arguments: {}, result: { shown: true, fallback: true } },
      ]);
    }
  });

  it("injects the picker whenever the reply is the branded greeting, even with no force flag and no prior assistant history", () => {
    // Reproduces the real bug: a RESUMED conversation (old sessionToken, already has prior
    // assistant messages) says "hola" again — force:true never applies there (it's not the
    // conversation's first-ever reply), so the greeting text itself must be enough to trigger it.
    const result = withServiceSelectionFallback(
      [],
      "¡Bienvenida a Oopss Nails! 😊 Aquí te comparto nuestros servicios y te ayudo a agendar tu cita de la manera más rápida y sencilla. Si tienes cualquier duda, no dudes en preguntarme.",
    );
    expect(result).toEqual([{ tool: "offer_service_selection", arguments: {}, result: { shown: true, fallback: true } }]);
  });

  it("force:true injects the picker even when the reply doesn't match any text heuristic at all", () => {
    const result = withServiceSelectionFallback([], "¡Perfecto! Tu cita ha sido confirmada. 🎉", {
      force: true,
    });
    expect(result).toEqual([{ tool: "offer_service_selection", arguments: {}, result: { shown: true, fallback: true } }]);
  });

  it("force:true is a no-op when the tool was already called", () => {
    const log = [{ tool: "offer_service_selection", arguments: {}, result: { shown: true } }];
    const result = withServiceSelectionFallback(log, "¡Bienvenida! 😊", { force: true });
    expect(result).toBe(log);
  });

  it("preserves existing tool calls when appending the fallback", () => {
    const log = [{ tool: "get_service_info", arguments: { query: "uñas" }, result: { found: false } }];
    const result = withServiceSelectionFallback(log, "¿Qué servicio específico deseas?");
    expect(result).toEqual([
      ...log,
      { tool: "offer_service_selection", arguments: {}, result: { shown: true, fallback: true } },
    ]);
  });
});
