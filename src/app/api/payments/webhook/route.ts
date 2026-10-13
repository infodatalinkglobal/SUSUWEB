import { ContributionStatus, PaymentAttemptStatus, PaymentMethod, Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPaystackSignature } from "@/lib/paystack";
import { amountToPesewas } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const webhookEnvelopeSchema = z.object({ event: z.string().min(1), data: z.unknown() }).passthrough();
const chargeSuccessSchema = z.object({
  reference: z.string().min(1).max(100),
  amount: z.number().int().nonnegative(),
  currency: z.string().length(3),
  status: z.string(),
  metadata: z.object({ contribution_id: z.string().min(1).max(64) }).passthrough(),
}).passthrough();

export async function POST(request: NextRequest) {
  if (!process.env.PAYSTACK_SECRET_KEY) {
    return NextResponse.json({ error: "Payment verification is not configured." }, { status: 503 });
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: "Webhook body could not be read." }, { status: 400 });
  }
  if (!verifyPaystackSignature(rawBody, request.headers.get("x-paystack-signature"))) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody) as unknown;
  } catch {
    return NextResponse.json({ error: "Webhook body must be valid JSON." }, { status: 400 });
  }
  const envelope = webhookEnvelopeSchema.safeParse(body);
  if (!envelope.success) {
    return NextResponse.json({ error: "Invalid webhook event." }, { status: 400 });
  }
  if (envelope.data.event !== "charge.success") {
    return NextResponse.json({ received: true, ignored: true });
  }

  const event = chargeSuccessSchema.safeParse(envelope.data.data);
  if (!event.success) {
    return NextResponse.json({ error: "Invalid payment event data." }, { status: 400 });
  }
  if (event.data.status !== "success" || event.data.currency !== "GHS") {
    return NextResponse.json({ error: "Payment status or currency did not match." }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const attempt = await transaction.paymentAttempt.findUnique({
        where: { reference: event.data.reference },
        include: { contribution: true },
      });
      if (!attempt) return { kind: "missing" as const };
      if (event.data.metadata.contribution_id !== attempt.contributionId) return { kind: "mismatch" as const };
      if (
        amountToPesewas(attempt.amount.toFixed(2)) !== event.data.amount ||
        attempt.currency !== event.data.currency
      ) {
        return { kind: "mismatch" as const };
      }
      if (attempt.status === PaymentAttemptStatus.VERIFIED) return { kind: "duplicate" as const };

      const now = new Date();
      await transaction.paymentAttempt.update({
        where: { id: attempt.id },
        data: { status: PaymentAttemptStatus.VERIFIED, verifiedAt: now },
      });

      if (attempt.contribution.status === ContributionStatus.PENDING) {
        await transaction.contribution.updateMany({
          where: { id: attempt.contributionId, status: ContributionStatus.PENDING },
          data: {
            status: ContributionStatus.VERIFIED,
            paymentMethod: PaymentMethod.PAYSTACK,
            paystackReference: event.data.reference,
            momoReference: null,
            paidAt: now,
            verifiedAt: now,
            reviewNote: null,
            reviewedAt: null,
            reviewedByUserId: null,
          },
        });
      }
      return { kind: "verified" as const };
    });

    if (result.kind === "missing") {
      return NextResponse.json({ error: "Payment reference is not associated with a contribution." }, { status: 404 });
    }
    if (result.kind === "mismatch") {
      return NextResponse.json({ error: "Payment amount, currency, or contribution did not match." }, { status: 400 });
    }
    return NextResponse.json({ received: true, duplicate: result.kind === "duplicate" });
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Payment reference conflicts with another contribution." }, { status: 409 });
    }
    return NextResponse.json({ error: "Payment event could not be recorded." }, { status: 500 });
  }
}
