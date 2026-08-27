import QRCode from "qrcode";
import { randomBytes } from "crypto";

export function generateTicketCode(): string {
  return randomBytes(16).toString("hex");
}

export function generateQRData(ticketCode: string): string {
  return JSON.stringify({
    code: ticketCode,
    ts: Date.now(),
  });
}

export async function generateQRCodeDataURL(qrData: string): Promise<string> {
  return QRCode.toDataURL(qrData, {
    errorCorrectionLevel: "M",
    width: 300,
    margin: 2,
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
  });
}

export function parseQRData(qrData: string): { code: string; ts: number } | null {
  try {
    const parsed = JSON.parse(qrData);
    if (parsed.code && parsed.ts) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}
