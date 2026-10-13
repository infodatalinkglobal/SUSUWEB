import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const PAYSTACK_BASE_URL = "https://api.paystack.co";
const requestTimeoutMs = 15_000;

const initializeResponseSchema = z.object({
  status: z.boolean(),
  data: z.object({
    authorization_url: z.string().url().refine((value) => value.startsWith("https://")),
    reference: z.string().min(1).max(100),
  }),
});

export class PaystackUnavailableError extends Error {
  constructor() {
    super("Paystack is not configured or is temporarily unavailable.");
    this.name = "PaystackUnavailableError";
  }
}

export class PaystackRejectedError extends Error {
  constructor() {
    super("Paystack could not initialize this payment.");
    this.name = "PaystackRejectedError";
  }
}

export interface InitializePaystackInput {
  email: string;
  amountPesewas: number;
  reference: string;
  callbackUrl: string;
  contributionId: string;
  groupId: string;
  cycle: number;
}

export async function initializePaystackTransaction(input: InitializePaystackInput): Promise<{
  authorizationUrl: string;
  reference: string;
}> {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) throw new PaystackUnavailableError();

  let response: Response;
  try {
    response = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: input.email,
        amount: input.amountPesewas,
        currency: "GHS",
        reference: input.reference,
        callback_url: input.callbackUrl,
        channels: ["mobile_money", "card"],
        metadata: {
          contribution_id: input.contributionId,
          group_id: input.groupId,
          cycle: input.cycle,
        },
      }),
      signal: AbortSignal.timeout(requestTimeoutMs),
      cache: "no-store",
    });
  } catch {
    throw new PaystackUnavailableError();
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new PaystackUnavailableError();
  }

  const parsed = initializeResponseSchema.safeParse(body);
  if (!response.ok || !parsed.success) throw new PaystackRejectedError();
  if (!parsed.data.status || parsed.data.data.reference !== input.reference) {
    throw new PaystackRejectedError();
  }

  return {
    authorizationUrl: parsed.data.data.authorization_url,
    reference: parsed.data.data.reference,
  };
}

export function verifyPaystackSignature(rawBody: string, signature: string | null): boolean {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey || !signature || !/^[0-9a-fA-F]{128}$/.test(signature)) return false;

  const expected = createHmac("sha512", secretKey).update(rawBody, "utf8").digest();
  const received = Buffer.from(signature, "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}
