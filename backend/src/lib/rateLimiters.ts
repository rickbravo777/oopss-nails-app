import rateLimit from "express-rate-limit";

// Guards the phone + confirmation-code self-service endpoints against brute-force
// enumeration of confirmation codes (see docs/nfr.md — Security).
export const selfServiceLookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos. Intenta de nuevo más tarde." },
});

// Guards anonymous chat-session creation (POST /chat/sessions) — unauthenticated by design
// (it's how a client identifies itself in the first place), so IP-based throttling is the
// only available control against bulk Conversation-row creation.
export const chatSessionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos. Intenta de nuevo más tarde." },
});

// Guards sending a chat message (POST /chat/sessions/:id/messages) — each accepted message
// triggers a real OpenAI API call (direct billing cost), so this endpoint needs its own,
// slightly more generous cap that still allows a genuine multi-turn conversation.
export const chatMessageLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados mensajes. Intenta de nuevo más tarde." },
});

// Guards photo upload (POST /uploads) — writes to disk, so also worth capping per-IP.
export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas subidas. Intenta de nuevo más tarde." },
});

// Guards admin login (POST /auth/login) against brute-force credential guessing. The handler
// already runs bcrypt.compare against a dummy hash on every request (timing-safe against
// enumeration), but nothing previously capped the number of attempts an attacker could make.
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos de inicio de sesión. Intenta de nuevo más tarde." },
});
