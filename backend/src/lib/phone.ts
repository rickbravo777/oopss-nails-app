// Strips everything but digits, so a phone typed/stored with different visual formatting
// (dashes, spaces, parentheses) still matches consistently — both at booking time (client
// upsert, keyed on this field) and at self-service lookup/cancel/reschedule time.
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}
