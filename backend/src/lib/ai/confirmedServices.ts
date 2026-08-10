// The message history rebuilt for each new tool-loop run only carries role+content (see
// chat.ts's processAssistantReply) — the actual tool_call/tool-result exchange from earlier
// turns is never replayed to the model, only the assistant's own final prose. If that prose
// ever paraphrased a service name instead of the exact one get_service_info returned (a real,
// observed failure mode — the tool call itself succeeds and finds the right service, but the
// human-readable reply drifts from it, e.g. "Manicure Spa" in prose vs. the real "Mani Spa
// (regular)"), a later turn confirming "sí, agendemos" has nothing but that imprecise prose to
// work from, and repeats the same wrong name into offer_service_selection — which then fails
// to resolve and silently falls back to the generic picker.
//
// Re-deriving the real, validated names directly from each turn's already-stored
// `toolCallMeta` (ground truth from get_service_info, not a recap the model might have
// paraphrased) and handing them back to the model fresh on every call closes that gap without
// depending on the model's own memory of its prior wording being exact — same principle as
// DEC-14's fresh-date-injection, applied to service names instead of dates.
interface StoredMessageWithToolMeta {
  toolCallMeta: unknown;
}

interface StoredToolCallEntry {
  tool?: string;
  result?: { found?: boolean; services?: { name?: string }[] };
}

export function extractConfirmedServiceNames(history: StoredMessageWithToolMeta[]): string[] {
  const names = new Set<string>();
  for (const message of history) {
    const meta = message.toolCallMeta;
    if (!Array.isArray(meta)) continue;
    for (const entry of meta as StoredToolCallEntry[]) {
      if (entry?.tool !== "get_service_info" || !entry.result?.found) continue;
      for (const service of entry.result.services ?? []) {
        if (service?.name) names.add(service.name);
      }
    }
  }
  return [...names];
}

export function buildConfirmedServicesNote(confirmedServiceNames: string[]): string | null {
  if (confirmedServiceNames.length === 0) return null;
  return (
    "SERVICIOS YA VALIDADOS EN ESTA CONVERSACIÓN (nombres EXACTOS del catálogo real, ya confirmados " +
    "previamente por get_service_info): " +
    confirmedServiceNames.join(", ") +
    ". Si la clienta se refiere a alguno de estos (aunque en un mensaje tuyo anterior lo hayas escrito de otra " +
    "forma), usa el nombre EXACTO de esta lista al llamar a offer_service_selection o cualquier otra función — " +
    "no hace falta volver a llamar get_service_info para ellos."
  );
}
