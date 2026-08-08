import type { ToolCallLogEntry } from "./toolLoop";

// The model doesn't reliably call offer_service_selection every time it should — verified
// live: the same "asks which service, no service chosen yet" situation sometimes gets the
// tool call, sometimes doesn't (LLM sampling, not a bug in the prompt or a regression). Rather
// than trust prompt-following alone, this is a deterministic backend safety net with three
// triggers, any one of which is enough: (1) `options.force` — set by chat.ts on a
// conversation's very first assistant reply, so a brand-new conversation is guaranteed the
// picker; (2) the reply text matches the branded greeting ("Bienvenida a Oopss Nails...", per
// the SALUDO INICIAL rule in systemPrompt.ts) — this is what actually matters for a RESUMED
// conversation (same browser, old sessionToken) where the client says "hola" again days later:
// `history` already has old assistant messages from earlier sessions, so trigger (1) alone
// never fires there, even though from the client's point of view she's starting fresh; (3) the
// reply text asks which service in prose ("qué servicio...") without having called the tool.
// All three are purely additive — never remove a real tool call, never touch what was sent to
// the model, only shape what the client sees.
const IS_GREETING = /\bbienvenid[ao]s?\s+a\s+oopss\s+nails\b/i;
const ASKS_WHICH_SERVICE = /\b(qu[eé]|cu[aá]l)\s+(tipo de\s+)?(sub[- ]?)?servicio\b/i;

export function withServiceSelectionFallback(
  toolCallLog: ToolCallLogEntry[],
  finalMessageContent: string,
  options: { force?: boolean } = {},
): ToolCallLogEntry[] {
  const alreadyOffered = toolCallLog.some((entry) => entry.tool === "offer_service_selection");
  if (alreadyOffered) return toolCallLog;

  const shouldOffer =
    options.force || IS_GREETING.test(finalMessageContent) || ASKS_WHICH_SERVICE.test(finalMessageContent);
  if (!shouldOffer) return toolCallLog;

  return [...toolCallLog, { tool: "offer_service_selection", arguments: {}, result: { shown: true, fallback: true } }];
}
