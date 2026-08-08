import { describe, expect, it, vi } from "vitest";

import { encrypt } from "./crypto";
import { prisma } from "./prisma";

const mockedAppend = vi.fn();

vi.mock("googleapis", () => ({
  google: {
    auth: { GoogleAuth: vi.fn().mockImplementation((opts) => ({ opts })) },
    sheets: vi.fn(() => ({ spreadsheets: { values: { append: mockedAppend } } })),
  },
}));

vi.mock("./prisma", () => ({
  prisma: {
    credential: { findUnique: vi.fn() },
    errorLog: { create: vi.fn().mockResolvedValue({}) },
  },
}));

const { appendAppointmentToSheet } = await import("./googleSheets");
const mockedFindUnique = vi.mocked(prisma.credential.findUnique);

const ROW = {
  clientName: "Carolina Villa",
  clientPhone: "8095551234",
  clientEmail: "carolina@correo.com",
  serviceNames: ["Manicure Gel"],
  specialistName: "Tania",
  date: "2026-08-10",
  startTime: "10:00",
  confirmationCode: "ABC12345",
};

const FAKE_SERVICE_ACCOUNT = JSON.stringify({ type: "service_account", client_email: "x@y.iam.gserviceaccount.com" });

describe("appendAppointmentToSheet", () => {
  it("silently does nothing when the Google credentials aren't configured yet", async () => {
    mockedFindUnique.mockResolvedValue(null);

    await appendAppointmentToSheet(ROW);

    expect(mockedAppend).not.toHaveBeenCalled();
    expect(prisma.errorLog.create).not.toHaveBeenCalled();
  });

  it("silently does nothing when only one of the two required credentials is set", async () => {
    mockedFindUnique.mockImplementation(async ({ where: { key } }: { where: { key: string } }) =>
      key === "GOOGLE_SERVICE_ACCOUNT_JSON"
        ? ({ encryptedValue: encrypt(FAKE_SERVICE_ACCOUNT) } as never)
        : null,
    );

    await appendAppointmentToSheet(ROW);

    expect(mockedAppend).not.toHaveBeenCalled();
  });

  it("appends a row with the client's contact info and appointment details when configured", async () => {
    mockedFindUnique.mockImplementation(async ({ where: { key } }: { where: { key: string } }) => {
      if (key === "GOOGLE_SERVICE_ACCOUNT_JSON") return { encryptedValue: encrypt(FAKE_SERVICE_ACCOUNT) } as never;
      if (key === "GOOGLE_SHEETS_SPREADSHEET_ID") return { encryptedValue: encrypt("sheet-abc-123") } as never;
      return null;
    });
    mockedAppend.mockResolvedValue({});

    await appendAppointmentToSheet(ROW);

    expect(mockedAppend).toHaveBeenCalledWith(
      expect.objectContaining({
        spreadsheetId: "sheet-abc-123",
        requestBody: {
          values: [
            expect.arrayContaining([
              "Carolina Villa",
              "8095551234",
              "carolina@correo.com",
              "Manicure Gel",
              "Tania",
              "2026-08-10",
              "10:00",
              "ABC12345",
            ]),
          ],
        },
      }),
    );
  });

  it("never throws and logs to ErrorLog instead when the Google API call fails", async () => {
    mockedFindUnique.mockImplementation(async ({ where: { key } }: { where: { key: string } }) => {
      if (key === "GOOGLE_SERVICE_ACCOUNT_JSON") return { encryptedValue: encrypt(FAKE_SERVICE_ACCOUNT) } as never;
      if (key === "GOOGLE_SHEETS_SPREADSHEET_ID") return { encryptedValue: encrypt("sheet-abc-123") } as never;
      return null;
    });
    mockedAppend.mockRejectedValue(new Error("Google API unreachable"));

    await expect(appendAppointmentToSheet(ROW)).resolves.toBeUndefined();

    expect(prisma.errorLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ source: "googleSheets" }) }),
    );
  });
});
