import { z } from "zod";

const ARKESEL_BASE_URL = "https://sms.arkesel.com/api/v2";
const requestTimeoutMs = 12_000;

const arkeselResponseSchema = z
  .object({
    code: z.union([z.string(), z.number()]),
    message: z.string().optional(),
  })
  .passthrough();

export class ArkeselError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArkeselError";
  }
}

export class ArkeselUnavailableError extends Error {
  constructor() {
    super("The SMS service is temporarily unavailable.");
    this.name = "ArkeselUnavailableError";
  }
}

async function postArkesel(path: string, payload: Record<string, string | number>): Promise<string> {
  const apiKey = process.env.ARKESEL_API_KEY;
  if (!apiKey) {
    throw new ArkeselUnavailableError();
  }

  let response: Response;
  try {
    response = await fetch(`${ARKESEL_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(requestTimeoutMs),
      cache: "no-store",
    });
  } catch {
    throw new ArkeselUnavailableError();
  }

  let responseBody: unknown;
  try {
    responseBody = await response.json();
  } catch {
    throw new ArkeselUnavailableError();
  }

  const parsed = arkeselResponseSchema.safeParse(responseBody);
  if (!parsed.success || !response.ok) {
    throw new ArkeselUnavailableError();
  }

  return String(parsed.data.code);
}

export async function sendOTP(phone: string): Promise<void> {
  const code = await postArkesel("/otp/send", {
    expiry: 5,
    length: 6,
    medium: "sms",
    message: "Your SusuApp code is %otp_code%. It expires in 5 minutes.",
    number: phone,
    sender_id: "SusuApp",
    type: "numeric",
  });

  if (code !== "1100") {
    throw new ArkeselError("Arkesel did not accept the OTP request.");
  }
}

export async function verifyOTP(phone: string, code: string): Promise<boolean> {
  const resultCode = await postArkesel("/otp/verify", {
    number: phone,
    code,
  });

  return resultCode === "1100";
}
