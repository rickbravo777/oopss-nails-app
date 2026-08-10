import type { ConfirmedService } from "./confirmedServices";
import type { ToolCallLogEntry } from "./toolLoop";

// The model doesn't reliably call offer_service_selection every time it should — verified
// live: the same "asks which service, no service chosen yet" situation sometimes gets the
// tool call, sometimes doesn't (LLM sampling, not a bug in the prompt or a regression). Rather
// than trust prompt-following alone, this is a deterministic backend safety net with six
// triggers, any one of which is enough: (1) `options.force` — set by chat.ts on a
// conversation's very first assistant reply, so a brand-new conversation is guaranteed the
// picker; (2) the reply text matches the branded greeting ("Bienvenida a Oopss Nails...", per
// the SALUDO INICIAL rule in systemPrompt.ts) — this is what actually matters for a RESUMED
// conversation (same browser, old sessionToken) where the client says "hola" again days later:
// `history` already has old assistant messages from earlier sessions, so trigger (1) alone
// never fires there, even though from the client's point of view she's starting fresh; (3) the
// reply text asks which service in prose ("qué servicio...") without having called the tool;
// (4) the reply text uses the standard "elige el/la que prefieras" phrasing this app's own
// prompt trains the model to say specifically when it's ABOUT to show a picker; (5) the reply
// text asks for booking details in prose ("día y hora... tu nombre... tu número de teléfono")
// instead of using the visual flow at all — a real, observed failure where the model didn't
// even attempt a picker-inviting sentence, just reverted straight to the numbered-list pattern
// the prompt explicitly calls out as wrong; (6) the reply text says "elige entre X o Y" — a
// real, observed failure where the model narrows to specific categories in prose ("Elige entre
// Manos o Pies 👇") without ever calling the tool, so the client sees an invitation to choose
// with no buttons under it. Trigger (5) is special: since the client already confirmed a
// specific service in this case, it tries to identify WHICH one by matching a **bolded** name
// in the reply against the real, already-validated services from this conversation
// (`confirmedServices`, from confirmedServices.ts) — if found, the fallback jumps straight to
// that service's especialista step, same as a correct tool call would have; if no match is
// found, it falls back to the generic full picker rather than nothing. Separately, whenever any
// trigger falls back to a generic (non-service-specific) picker, it also scans the reply text
// for mentions of real category names (`options.validCategoryNames`, e.g. "Manos"/"Pies") and
// narrows the picker to those if found — same principle as trigger (5)'s bolded-name matching,
// applied to categories instead of a single service. All six triggers are purely additive —
// never remove a real tool call, never touch what was sent to the model, only shape what the
// client sees.
const IS_GREETING = /\bbienvenid[ao]s?\s+a\s+oopss\s+nails\b/i;
const ASKS_WHICH_SERVICE = /\b(qu[eé]|cu[aá]l)\s+(tipo de\s+)?(sub[- ]?)?servicio\b/i;
const IMPLIES_A_PICKER = /elige\b[^.!?\n]{0,25}\bprefieras\b/i;
const ASKS_TO_CHOOSE_ENTRE = /\belige\s+entre\b/i;
const ASKS_FOR_DAY_TIME = /\bd[ií]a\s+y\s+hora\b/i;
const ASKS_FOR_PHONE = /\btel[eé]fono\b/i;

function extractBoldedSegments(text: string): string[] {
  return [...text.matchAll(/\*\*(.+?)\*\*/g)].map((m) => m[1].trim());
}

function findMentionedConfirmedService(
  text: string,
  confirmedServices: ConfirmedService[],
): ConfirmedService | undefined {
  const bolded = new Set(extractBoldedSegments(text).map((b) => b.toLowerCase()));
  return confirmedServices.find((s) => bolded.has(s.name.toLowerCase()));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findMentionedCategories(text: string, validCategoryNames: string[]): string[] {
  return validCategoryNames.filter((name) => new RegExp(`\\b${escapeRegExp(name)}\\b`, "i").test(text));
}

export function withServiceSelectionFallback(
  toolCallLog: ToolCallLogEntry[],
  finalMessageContent: string,
  options: { force?: boolean; confirmedServices?: ConfirmedService[]; validCategoryNames?: string[] } = {},
): ToolCallLogEntry[] {
  const alreadyOffered = toolCallLog.some((entry) => entry.tool === "offer_service_selection");
  if (alreadyOffered) return toolCallLog;

  const asksForBookingDetailsInProse =
    ASKS_FOR_DAY_TIME.test(finalMessageContent) && ASKS_FOR_PHONE.test(finalMessageContent);

  if (asksForBookingDetailsInProse) {
    const matched = findMentionedConfirmedService(finalMessageContent, options.confirmedServices ?? []);
    if (matched) {
      return [
        ...toolCallLog,
        {
          tool: "offer_service_selection",
          arguments: { serviceName: matched.name },
          result: { shown: true, serviceId: matched.id, serviceName: matched.name, fallback: true },
        },
      ];
    }
  }

  const shouldOffer =
    options.force ||
    IS_GREETING.test(finalMessageContent) ||
    ASKS_WHICH_SERVICE.test(finalMessageContent) ||
    IMPLIES_A_PICKER.test(finalMessageContent) ||
    ASKS_TO_CHOOSE_ENTRE.test(finalMessageContent) ||
    asksForBookingDetailsInProse;
  if (!shouldOffer) return toolCallLog;

  const mentionedCategories = findMentionedCategories(finalMessageContent, options.validCategoryNames ?? []);
  if (mentionedCategories.length > 0) {
    return [
      ...toolCallLog,
      {
        tool: "offer_service_selection",
        arguments: { categories: mentionedCategories },
        result: { shown: true, categories: mentionedCategories, fallback: true },
      },
    ];
  }

  return [...toolCallLog, { tool: "offer_service_selection", arguments: {}, result: { shown: true, fallback: true } }];
}
