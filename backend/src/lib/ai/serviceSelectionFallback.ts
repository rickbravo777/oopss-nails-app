import type { ConfirmedService } from "./confirmedServices";
import type { ToolCallLogEntry } from "./toolLoop";

// The model doesn't reliably call offer_service_selection every time it should — verified
// live: the same "asks which service, no service chosen yet" situation sometimes gets the
// tool call, sometimes doesn't (LLM sampling, not a bug in the prompt or a regression). Rather
// than trust prompt-following alone, this is a deterministic backend safety net. Six of its
// triggers pattern-match the ASSISTANT's own reply text for specific phrasings observed live:
// (1) `options.force` — set by chat.ts on a conversation's very first assistant reply; (2) the
// branded greeting ("Bienvenida a Oopss Nails...", per SALUDO INICIAL) — matters for a RESUMED
// conversation where trigger (1) doesn't apply; (3) asks which service in prose ("qué
// servicio..."); (4) the standard "elige el/la que prefieras" phrasing without a real call; (5)
// asks for booking details in prose ("día y hora... teléfono") — the "mal ejemplo" numbered
// list the prompt explicitly forbids; (6) "elige entre X o Y" category-narrowing in prose.
//
// A 7th, more foundational trigger works differently: instead of guessing how the assistant's
// prose might read (an endlessly-growing list of specific phrasings, since the model can phrase
// "let me ask you about day and specialist instead of using the picker" in unlimited ways), it
// checks whether the CLIENT's own last message expressed clear booking intent ("si agendemos",
// "quiero agendar", "resérvame") — a client saying this is, by itself, cause enough to expect a
// picker in the very next reply, no matter what the assistant's reply text ends up saying.
// Real example this closes: client asks "qué es el rubber gel" (get_service_info now runs for
// this too, see DISPONIBILIDAD Y PRECIOS in systemPrompt.ts), then says "si agendemos" — the
// model asked "¿qué día te gustaría? ¿tienes preferencia de especialista?" in prose, matching
// NONE of triggers (3)-(6) (no "elige", no "teléfono" mention at all) — the assistant wasn't
// even attempting the forbidden numbered-list pattern, just drifting into an ordinary
// back-and-forth instead of using the tool.
//
// Both this trigger and (5) try to identify WHICH service is meant, in order: (a) a **bolded**
// name in the reply matched against this conversation's already-validated services
// (`confirmedServices`, from confirmedServices.ts); (b) if that finds nothing but exactly one
// service has been confirmed so far in the conversation, assume that's the one — a client who
// just discussed a single service and then says "sí, agendemos" is almost certainly confirming
// THAT one, even if this particular reply didn't happen to bold its name. Two or more confirmed
// services with no bolded match is genuinely ambiguous, so that case (and no confirmed services
// at all) falls back to the generic full picker rather than guessing wrong.
//
// Separately, whenever any trigger falls back to a generic (non-service-specific) picker, it
// also scans the reply text for mentions of real category names (`options.validCategoryNames`,
// e.g. "Manos"/"Pies") and narrows the picker to those if found. All triggers are purely
// additive — never remove a real tool call, never touch what was sent to the model, only shape
// what the client sees.
const IS_GREETING = /\bbienvenid[ao]s?\s+a\s+oopss\s+nails\b/i;
const ASKS_WHICH_SERVICE = /\b(qu[eé]|cu[aá]l)\s+(tipo de\s+)?(sub[- ]?)?servicio\b/i;
const IMPLIES_A_PICKER = /elige\b[^.!?\n]{0,25}\bprefieras\b/i;
const ASKS_TO_CHOOSE_ENTRE = /\belige\s+entre\b/i;
const ASKS_FOR_DAY_TIME = /\bd[ií]a\s+y\s+hora\b/i;
const ASKS_FOR_PHONE = /\btel[eé]fono\b/i;
const USER_EXPRESSES_BOOKING_INTENT = /\bagend\w*|\breserv\w*/i;

// Accent-insensitive, same principle as getServiceInfo.ts's own normalize() — a client typing
// "agéndame" shouldn't silently miss the plain-ASCII "agend" pattern above (the é isn't a plain
// "e", so the regex alone wouldn't match it).
function normalizeAccents(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function extractBoldedSegments(text: string): string[] {
  return [...text.matchAll(/\*\*(.+?)\*\*/g)].map((m) => m[1].trim());
}

function resolveTargetService(
  text: string,
  confirmedServices: ConfirmedService[],
): ConfirmedService | undefined {
  const bolded = new Set(extractBoldedSegments(text).map((b) => b.toLowerCase()));
  const boldMatches = confirmedServices.filter((s) => bolded.has(s.name.toLowerCase()));
  // Exactly one bolded match is a real signal (e.g. "para tu **Relleno Acrílico**..."). Two or
  // more means the reply is presenting a CHOICE between them (e.g. "1. **Manicure Gel** 2.
  // **Pedicure Gel**, elige el que prefieras") — picking the first one would silently book the
  // wrong service, so that's genuinely ambiguous, same as zero matches.
  if (boldMatches.length === 1) return boldMatches[0];
  if (boldMatches.length >= 2) return undefined;
  // No bolded match at all — if exactly one service has been confirmed so far in the whole
  // conversation, a "sí, agendemos" (or equivalent) almost certainly refers to it even though
  // this reply didn't happen to bold its name. Two or more confirmed is genuinely ambiguous.
  return confirmedServices.length === 1 ? confirmedServices[0] : undefined;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findMentionedCategories(text: string, validCategoryNames: string[]): string[] {
  return validCategoryNames.filter((name) => new RegExp(`\\b${escapeRegExp(name)}\\b`, "i").test(text));
}

function isServiceNameArgs(value: unknown): value is { serviceName: string } {
  return typeof value === "object" && value !== null && typeof (value as { serviceName?: unknown }).serviceName === "string";
}

// Real, observed failure: after discussing TWO specific services in the same conversation (e.g.
// comparing prices), a generic "quiero agendar" got the model calling offer_service_selection
// TWICE in the same reply — once per service — instead of once. The frontend only ever honors
// the first offer_service_selection entry for a given message (ChatPage.tsx's `.find()`), so
// this silently jumped straight to whichever service happened to be mentioned first, even though
// the client hadn't actually chosen between them. The tool has no way to represent "let her pick
// among these N specific already-confirmed services" (only ONE serviceName, or a category list),
// so when the model tries to solve that by calling it multiple times, this collapses every
// offer_service_selection entry in the reply down to a single generic picker instead of letting
// the frontend arbitrarily honor just the first one — the client explicitly chooses instead of
// the app silently guessing.
function collapseConflictingServiceOffers(toolCallLog: ToolCallLogEntry[]): ToolCallLogEntry[] {
  const serviceOffers = toolCallLog.filter((e) => e.tool === "offer_service_selection" && isServiceNameArgs(e.arguments));
  const distinctNames = new Set(serviceOffers.map((e) => (e.arguments as { serviceName: string }).serviceName));
  if (distinctNames.size <= 1) return toolCallLog;
  const withoutServiceOffers = toolCallLog.filter((e) => e.tool !== "offer_service_selection");
  return [...withoutServiceOffers, { tool: "offer_service_selection", arguments: {}, result: { shown: true, fallback: true } }];
}

export function withServiceSelectionFallback(
  toolCallLog: ToolCallLogEntry[],
  finalMessageContent: string,
  options: {
    force?: boolean;
    confirmedServices?: ConfirmedService[];
    validCategoryNames?: string[];
    lastUserMessage?: string;
  } = {},
): ToolCallLogEntry[] {
  const dedupedLog = collapseConflictingServiceOffers(toolCallLog);
  const alreadyOffered = dedupedLog.some((entry) => entry.tool === "offer_service_selection");
  if (alreadyOffered) return dedupedLog;

  const asksForBookingDetailsInProse =
    ASKS_FOR_DAY_TIME.test(finalMessageContent) && ASKS_FOR_PHONE.test(finalMessageContent);
  const userExpressedBookingIntent =
    !!options.lastUserMessage && USER_EXPRESSES_BOOKING_INTENT.test(normalizeAccents(options.lastUserMessage));

  if (asksForBookingDetailsInProse || userExpressedBookingIntent) {
    const matched = resolveTargetService(finalMessageContent, options.confirmedServices ?? []);
    if (matched) {
      return [
        ...dedupedLog,
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
    asksForBookingDetailsInProse ||
    userExpressedBookingIntent;
  if (!shouldOffer) return dedupedLog;

  const mentionedCategories = findMentionedCategories(finalMessageContent, options.validCategoryNames ?? []);
  if (mentionedCategories.length > 0) {
    return [
      ...dedupedLog,
      {
        tool: "offer_service_selection",
        arguments: { categories: mentionedCategories },
        result: { shown: true, categories: mentionedCategories, fallback: true },
      },
    ];
  }

  return [...dedupedLog, { tool: "offer_service_selection", arguments: {}, result: { shown: true, fallback: true } }];
}
