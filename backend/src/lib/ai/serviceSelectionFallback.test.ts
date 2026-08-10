import { describe, expect, it } from "vitest";

import { withServiceSelectionFallback } from "./serviceSelectionFallback";

describe("withServiceSelectionFallback", () => {
  it("leaves the log untouched when offer_service_selection was already called", () => {
    const log = [{ tool: "offer_service_selection", arguments: {}, result: { shown: true } }];
    const result = withServiceSelectionFallback(log, "¡Claro! Aquí tienes nuestros servicios 👇");
    expect(result).toBe(log);
  });

  it("collapses two conflicting offer_service_selection calls (one per service) into a single generic picker instead of silently honoring the first one", () => {
    // Real reported bug: after pricing both "Manicure Gel" and "Pedicure Gel", a generic "quiero
    // agendar" got the model calling offer_service_selection TWICE in the same reply, once per
    // service — the frontend only ever honors the FIRST offer_service_selection entry, so this
    // silently jumped straight to Manicure Gel even though the client hadn't chosen between them.
    const log = [
      {
        tool: "offer_service_selection",
        arguments: { serviceName: "Manicure Gel" },
        result: { shown: true, serviceId: "svc-manicure", serviceName: "Manicure Gel" },
      },
      {
        tool: "offer_service_selection",
        arguments: { serviceName: "Pedicure Gel" },
        result: { shown: true, serviceId: "svc-pedicure", serviceName: "Pedicure Gel" },
      },
    ];
    const result = withServiceSelectionFallback(log, "Elige el que prefieras 👇");
    expect(result).toEqual([{ tool: "offer_service_selection", arguments: {}, result: { shown: true, fallback: true } }]);
  });

  it("does not collapse when the two offer_service_selection calls agree on the same service (not actually conflicting)", () => {
    const log = [
      {
        tool: "offer_service_selection",
        arguments: { serviceName: "Manicure Gel" },
        result: { shown: true, serviceId: "svc-manicure", serviceName: "Manicure Gel" },
      },
      {
        tool: "offer_service_selection",
        arguments: { serviceName: "Manicure Gel" },
        result: { shown: true, serviceId: "svc-manicure", serviceName: "Manicure Gel" },
      },
    ];
    const result = withServiceSelectionFallback(log, "Elige a tu especialista 👇");
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

  it("injects the picker when the reply uses the standard 'elige el que prefieras' phrasing but never actually called the tool", () => {
    // Real reported bug: the model wrote this exact accompanying sentence (the one the prompt
    // trains it to pair with a real tool call) without making the call — client saw text
    // inviting her to choose and zero buttons.
    const result = withServiceSelectionFallback(
      [],
      "Aquí tienes nuestras opciones de servicios para uñas. Elige el que prefieras 👇",
    );
    expect(result).toEqual([{ tool: "offer_service_selection", arguments: {}, result: { shown: true, fallback: true } }]);
  });

  it("also matches the specialist-choosing variant of the same phrasing", () => {
    const result = withServiceSelectionFallback([], "Ahora elige la especialista que prefieras para tu cita.");
    expect(result).toEqual([{ tool: "offer_service_selection", arguments: {}, result: { shown: true, fallback: true } }]);
  });

  it("does not fire on unrelated uses of 'elige' or 'prefieras' far apart in the same message", () => {
    const log = [{ tool: "get_service_info", arguments: {}, result: { found: true } }];
    const result = withServiceSelectionFallback(
      log,
      "Elige con calma, no hay prisa — cuando sepas qué día prefieres para tu cita, dímelo y seguimos.",
    );
    expect(result).toBe(log);
  });

  it("with a matching confirmed service, injects a TARGETED fallback (real serviceId) when the model asks for booking details in prose instead of using the picker", () => {
    // Real reported bug: the model didn't even attempt a picker-inviting sentence — it reverted
    // straight to the numbered-list pattern the prompt explicitly says never to use, for a
    // service ("Relleno Acrílico") already confirmed earlier via get_service_info.
    const result = withServiceSelectionFallback(
      [],
      "¡Perfecto! Para agendar tu cita de **Relleno Acrílico**, necesito que me indiques lo siguiente: " +
        "1. **Día y hora** en que te gustaría venir. 2. **Tu nombre**. 3. **Tu número de teléfono**. " +
        "Una vez que tenga esa información, puedo confirmar tu cita. 😊",
      { confirmedServices: [{ id: "svc-relleno-acrilico", name: "Relleno Acrílico" }] },
    );

    expect(result).toEqual([
      {
        tool: "offer_service_selection",
        arguments: { serviceName: "Relleno Acrílico" },
        result: { shown: true, serviceId: "svc-relleno-acrilico", serviceName: "Relleno Acrílico", fallback: true },
      },
    ]);
  });

  it("without a matching confirmed service, still shows the generic picker rather than nothing", () => {
    const result = withServiceSelectionFallback(
      [],
      "Necesito tu **día y hora** de preferencia y tu **número de teléfono** para agendar.",
      { confirmedServices: [] },
    );
    expect(result).toEqual([{ tool: "offer_service_selection", arguments: {}, result: { shown: true, fallback: true } }]);
  });

  it("booking-details trigger requires BOTH día y hora AND teléfono — day alone isn't enough to assume it's asking for full booking details", () => {
    const log = [{ tool: "get_service_info", arguments: {}, result: { found: true } }];
    const result = withServiceSelectionFallback(log, "¿Qué día y hora te gustaría venir?");
    expect(result).toBe(log);
  });

  it("resolves the single confirmed service when the client's own message expresses booking intent, even with no bolded name and no numbered-list pattern", () => {
    // Real reported bug: client asked "que es el rubber gel" (get_service_info ran and
    // confirmed the real "Rubber Gel" service), then said "si agendemos" — the model replied
    // asking about day/specialist preference in ordinary prose, matching NONE of the text-based
    // triggers (no "elige", no "teléfono" mention at all) — the client's own message is the only
    // reliable signal left that a picker was owed here.
    const result = withServiceSelectionFallback(
      [],
      "¡Perfecto! 😊 Ahora, necesito que me indiques qué día te gustaría agendar tu cita para el Rubber Gel. " +
        "También, si tienes preferencia por alguna de nuestras especialistas: Tania, Mariangely o Yez.",
      {
        confirmedServices: [{ id: "svc-rubber-gel", name: "Rubber Gel" }],
        lastUserMessage: "si agendemos",
      },
    );
    expect(result).toEqual([
      {
        tool: "offer_service_selection",
        arguments: { serviceName: "Rubber Gel" },
        result: { shown: true, serviceId: "svc-rubber-gel", serviceName: "Rubber Gel", fallback: true },
      },
    ]);
  });

  it("also matches other booking-intent phrasings in the client's message (agendar, agéndame, reservar)", () => {
    for (const lastUserMessage of ["quiero agendar por favor", "agéndame eso", "sí, resérvame ese horario"]) {
      const result = withServiceSelectionFallback([], "Claro, ¿qué día prefieres?", {
        confirmedServices: [{ id: "svc-x", name: "Servicio X" }],
        lastUserMessage,
      });
      expect(result).toEqual([
        {
          tool: "offer_service_selection",
          arguments: { serviceName: "Servicio X" },
          result: { shown: true, serviceId: "svc-x", serviceName: "Servicio X", fallback: true },
        },
      ]);
    }
  });

  it("with two or more confirmed services and no bolded match, booking intent falls back to the generic picker instead of guessing which service", () => {
    const result = withServiceSelectionFallback([], "Claro, ¿qué día prefieres?", {
      confirmedServices: [
        { id: "svc-a", name: "Servicio A" },
        { id: "svc-b", name: "Servicio B" },
      ],
      lastUserMessage: "si agendemos",
    });
    expect(result).toEqual([{ tool: "offer_service_selection", arguments: {}, result: { shown: true, fallback: true } }]);
  });

  it("with TWO bolded confirmed-service names in the same reply (the model is presenting a choice), falls back to the generic picker instead of silently picking the first one", () => {
    // Real reported bug: "cuanto cuesta el manicure gel y el pedicure gel" then "quiero agendar"
    // got "Aquí tienes los servicios: 1. **Manicure Gel** 2. **Pedicure Gel**, elige el que
    // prefieras" — both names are bolded and both are confirmed services, so the old
    // `.find()`-based bold match silently jumped straight to Manicure Gel (the first one) even
    // though the client hadn't chosen between them yet.
    const result = withServiceSelectionFallback(
      [],
      "Aquí tienes los servicios disponibles: 1. **Manicure Gel** 2. **Pedicure Gel**. Por favor, elige el que prefieras 😊",
      {
        confirmedServices: [
          { id: "svc-manicure-gel", name: "Manicure Gel" },
          { id: "svc-pedicure-gel", name: "Pedicure Gel" },
        ],
        lastUserMessage: "quiero agendar",
      },
    );
    expect(result).toEqual([{ tool: "offer_service_selection", arguments: {}, result: { shown: true, fallback: true } }]);
  });

  it("bolded name in the reply still wins over the single-confirmed-service fallback when it identifies a specific service", () => {
    const result = withServiceSelectionFallback([], "Perfecto, para tu **Servicio B** ¿qué día prefieres?", {
      confirmedServices: [
        { id: "svc-a", name: "Servicio A" },
        { id: "svc-b", name: "Servicio B" },
      ],
      lastUserMessage: "si agendemos",
    });
    expect(result).toEqual([
      {
        tool: "offer_service_selection",
        arguments: { serviceName: "Servicio B" },
        result: { shown: true, serviceId: "svc-b", serviceName: "Servicio B", fallback: true },
      },
    ]);
  });

  it("booking intent with zero confirmed services still shows the generic picker rather than nothing", () => {
    const result = withServiceSelectionFallback([], "Claro, ¿qué día prefieres?", {
      confirmedServices: [],
      lastUserMessage: "si, agendemos ya",
    });
    expect(result).toEqual([{ tool: "offer_service_selection", arguments: {}, result: { shown: true, fallback: true } }]);
  });

  it("does not fire when neither the client's message nor the reply text carries any booking/picker signal", () => {
    const log = [{ tool: "get_service_info", arguments: {}, result: { found: true } }];
    const result = withServiceSelectionFallback(log, "El precio es $40 e incluye limado y esmaltado.", {
      confirmedServices: [{ id: "svc-x", name: "Servicio X" }],
      lastUserMessage: "cuanto cuesta",
    });
    expect(result).toBe(log);
  });

  it("injects a category-narrowed fallback when the model says 'elige entre X o Y' without calling the tool", () => {
    // Real reported bug: "quiero hacerme las uñas" got "¡Claro! Aquí tienes las opciones para
    // hacerte las uñas. Elige entre Manos o Pies 👇" with zero buttons underneath — the model
    // never called offer_service_selection at all, and this phrasing doesn't contain
    // "prefieras" so trigger (4) didn't catch it either.
    const result = withServiceSelectionFallback(
      [],
      "¡Claro! Aquí tienes las opciones para hacerte las uñas. Elige entre Manos o Pies 👇",
      { validCategoryNames: ["Manos", "Pies", "Cabello", "Cejas", "Pestañas"] },
    );
    expect(result).toEqual([
      {
        tool: "offer_service_selection",
        arguments: { categories: ["Manos", "Pies"] },
        result: { shown: true, categories: ["Manos", "Pies"], fallback: true },
      },
    ]);
  });

  it("falls back to the generic picker when 'elige entre' fires but no known category is mentioned", () => {
    const result = withServiceSelectionFallback([], "Elige entre las opciones que te muestro 👇", {
      validCategoryNames: ["Manos", "Pies"],
    });
    expect(result).toEqual([{ tool: "offer_service_selection", arguments: {}, result: { shown: true, fallback: true } }]);
  });

  it("also narrows by mentioned category on the generic 'which service' trigger, not just 'elige entre'", () => {
    const result = withServiceSelectionFallback([], "¿Qué servicio te gustaría? Tenemos opciones de Cabello y Cejas.", {
      validCategoryNames: ["Manos", "Pies", "Cabello", "Cejas"],
    });
    expect(result).toEqual([
      {
        tool: "offer_service_selection",
        arguments: { categories: ["Cabello", "Cejas"] },
        result: { shown: true, categories: ["Cabello", "Cejas"], fallback: true },
      },
    ]);
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
