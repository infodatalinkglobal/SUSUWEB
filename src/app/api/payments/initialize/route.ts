import { ContributionStatus, MemberStatus, PaymentAttemptStatus, PaymentMethod, Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse, conflictResponse, notFoundResponse, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { initializePaystackTransaction, PaystackRejectedError, PaystackUnavailableError } from "@/lib/paystack";
import { initializePaystackBodySchema } from "@/lib/validators";
import { amountToPesewas, getAppBaseUrl } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = initializePaystackBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the payment details." }, { status: 400 });
  }
  if (!process.env.PAYSTACK_SECRET_KEY) {
    return NextResponse.json({ error: "Paystack is not configured or is temporarily unavailable." }, { status: 503 });
  }

  const reference = `SUSU-${randomUUID().replaceAll("-", "")}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 60 * 1000);

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const membership = await transaction.groupMember.findFirst({
        where: { groupId: parsed.data.groupId, userId: auth.userId, status: MemberStatus.ACTIVE },
        include: { group: true },
      });
      if (!membership || !membership.group.isActive) return { kind: "missing" as const };
      const group = membership.group;
      if (group.currentCycle > group.totalCycles) return { kind: "complete" as const };

      const existing = await transaction.contribution.findUnique({
        where: { memberId_cycle: { memberId: membership.id, cycle: group.currentCycle } },
      });
      if (existing && existing.status !== ContributionStatus.PENDING) return { kind: "already-paid" as const };
      if (existing) {
        const activeAttempt = await transaction.paymentAttempt.findFirst({
          where: {
            contributionId: existing.id,
            status: PaymentAttemptStatus.INITIALIZED,
            expiresAt: { gt: now },
          },
          select: { id: true },
        });
        if (activeAttempt) return { kind: "in-progress" as const };
        await transaction.paymentAttempt.updateMany({
          where: {
            contributionId: existing.id,
            status: PaymentAttemptStatus.INITIALIZED,
            expiresAt: { lte: now },
          },
          data: { status: PaymentAttemptStatus.FAILED },
        });
      }

      const contribution = existing
        ? await transaction.contribution.update({
            where: { id: existing.id },
            data: {
              amount: group.contributionAmount,
              paymentMethod: PaymentMethod.PAYSTACK,
              momoReference: null,
              paystackReference: reference,
              paidAt: null,
              verifiedAt: null,
            },
          })
        : await transaction.contribution.create({
            data: {
              groupId: group.id,
              memberId: membership.id,
              userId: auth.userId,
              cycle: group.currentCycle,
              amount: group.contributionAmount,
              status: ContributionStatus.PENDING,
              paymentMethod: PaymentMethod.PAYSTACK,
              paystackReference: reference,
            },
          });
      await transaction.paymentAttempt.create({
        data: {
          contributionId: contribution.id,
          reference,
          amount: group.contributionAmount,
          currency: "GHS",
          status: PaymentAttemptStatus.INITIALIZED,
          expiresAt,
        },
      });
      return {
        kind: "ready" as const,
        contributionId: contribution.id,
        groupId: group.id,
        cycle: group.currentCycle,
        amount: group.contributionAmount.toFixed(2),
      };
    });

    if (result.kind === "missing") return notFoundResponse("This group is not available to your account.");
    if (result.kind === "complete") return conflictResponse("This group has completed all planned cycles.");
    if (result.kind === "already-paid") return conflictResponse("A contribution has already been recorded for this cycle.");
    if (result.kind === "in-progress") return conflictResponse("A Paystack payment is already in progress for this cycle.");

    const amountPesewas = amountToPesewas(result.amount);
    const baseUrl = getAppBaseUrl(request.headers.get("origin"));
    const callbackUrl = new URL(
      `/dashboard/groups/${encodeURIComponent(result.groupId)}/contribute?payment=returning`,
      baseUrl,
    ).toString();

    const payment = await initializePaystackTransaction({
      email: parsed.data.email,
      amountPesewas,
      reference,
      callbackUrl,
      contributionId: result.contributionId,
      groupId: result.groupId,
      cycle: result.cycle,
    });

    return NextResponse.json({
      success: true,
      authorizationUrl: payment.authorizationUrl,
      reference: payment.reference,
      amount: result.amount,
      currency: "GHS",
    });
  } catch (error: unknown) {
    try {
      await prisma.$transaction(async (transaction) => {
        const attempt = await transaction.paymentAttempt.findUnique({ where: { reference }, select: { contributionId: true } });
        if (!attempt) return;
        await transaction.paymentAttempt.updateMany({
          where: { reference, status: PaymentAttemptStatus.INITIALIZED },
          data: { status: PaymentAttemptStatus.FAILED },
        });
        await transaction.contribution.updateMany({
          where: { id: attempt.contributionId, status: ContributionStatus.PENDING, paystackReference: reference },
          data: { paymentMethod: null, paystackReference: null },
        });
      });
    } catch {
      // Keep provider failures safe even if cleanup is temporarily unavailable.
    }
    if (error instanceof PaystackUnavailableError) {
      return NextResponse.json({ error: "Paystack is not configured or is temporarily unavailable." }, { status: 503 });
    }
    if (error instanceof PaystackRejectedError) {
      return NextResponse.json({ error: "Paystack could not initialize this payment. Please try again later." }, { status: 502 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return conflictResponse("A payment attempt already exists for this cycle. Refresh and try again.");
    }
    return apiErrorResponse(error, "The payment could not be initialized.");
  }
}
