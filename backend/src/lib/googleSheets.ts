import { google } from "googleapis";

import { decrypt } from "./crypto";
import { prisma } from "./prisma";

export interface SheetAppointmentRow {
  clientName: string;
  clientPhone: string;
  clientEmail?: string | null;
  serviceNames: string[];
  specialistName: string;
  date: string;
  startTime: string;
  confirmationCode: string;
}

interface GoogleSheetsCredentials {
  serviceAccount: Record<string, unknown>;
  spreadsheetId: string;
}

// Level-3 credentials, same vault/pattern as OPENAI_API_KEY (design/architecture.md —
// Credential Level Mapping): the salon owner pastes these into /admin/credenciales, no
// developer needed to rotate them. Both must be present — if either is missing (e.g. this
// feature hasn't been set up yet), sync is silently skipped, not treated as an error.
async function getCredentials(): Promise<GoogleSheetsCredentials | null> {
  const [jsonRow, idRow] = await Promise.all([
    prisma.credential.findUnique({ where: { key: "GOOGLE_SERVICE_ACCOUNT_JSON" } }),
    prisma.credential.findUnique({ where: { key: "GOOGLE_SHEETS_SPREADSHEET_ID" } }),
  ]);
  if (!jsonRow || !idRow) return null;

  try {
    const serviceAccount = JSON.parse(decrypt(jsonRow.encryptedValue));
    const spreadsheetId = decrypt(idRow.encryptedValue).trim();
    return { serviceAccount, spreadsheetId };
  } catch {
    return null;
  }
}

// Appends one row per booked appointment (client contact info + what/who/when) to a Google
// Sheet the salon owner controls — so she has a live, always-current contact list she can
// open directly in Sheets, without needing to log into the admin panel. Fire-and-forget by
// design: NEVER throws and never blocks/fails the booking it's attached to — Google being
// slow, misconfigured, or simply not set up yet must not stop a client from getting her
// confirmation code. Failures are logged to ErrorLog for the admin to notice, not surfaced
// to the client.
export async function appendAppointmentToSheet(row: SheetAppointmentRow): Promise<void> {
  try {
    const credentials = await getCredentials();
    if (!credentials) return;

    const auth = new google.auth.GoogleAuth({
      credentials: credentials.serviceAccount,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const sheets = google.sheets({ version: "v4", auth });

    await sheets.spreadsheets.values.append({
      spreadsheetId: credentials.spreadsheetId,
      // Unqualified range (no "SheetName!" prefix) targets the first tab — the salon owner
      // doesn't have to rename their tab to match anything specific.
      range: "A1:I1",
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [
          [
            new Date().toISOString(),
            row.clientName,
            row.clientPhone,
            row.clientEmail ?? "",
            row.serviceNames.join(", "),
            row.specialistName,
            row.date,
            row.startTime,
            row.confirmationCode,
          ],
        ],
      },
    });
  } catch (err) {
    await prisma.errorLog
      .create({ data: { source: "googleSheets", message: err instanceof Error ? err.message : String(err) } })
      .catch(() => {});
  }
}
