// Visual grouping only (e.g. "6030-7210") — the backend compares phones by digits only (see
// backend/src/lib/phone.ts's normalizePhone()), so how the client chooses to type it (with or
// without dashes/spaces) never affects matching. Shared by every phone input in the app
// (MyAppointmentsPage's lookup form, the booking flow's contact step) so the format is
// consistent everywhere a client types a phone number.
export function formatPhoneInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 15);
  return digits.replace(/(\d{4})(?=\d)/g, "$1-");
}
