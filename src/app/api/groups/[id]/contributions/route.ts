import { ContributionStatus, MemberRole, MemberStatus, PaymentAttemptStatus, PaymentMethod, Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse, conflictResponse, forbiddenResponse, notFoundResponse, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { recordContributionBodySchema } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const { id } = await context.params;

  try {
    const viewer = await prisma.groupMember.findFirst({
      where: { groupId: id, userId: auth.userId, status: MemberStatus.ACTIVE },
      select: { role: true },
    });
    if (!viewer) return notFoundResponse("This group is not available to your account.");

    const contributions = await prisma.contribution.findMany({
      where: { groupId: id },
      include: { member: { include: { user: { select: { name: true, phone: true } } } } },
      orderBy: [{ cycle: "asc" }, { createdAt: "asc" }],
    });

    return NextResponse.json({
      contributions: contributions.map((contribution) => ({
        id: contribution.id,
        memberId: contribution.memberId,
        memberName: contribution.member.user.name ?? "Susu member",
        phone: viewer.role === MemberRole.ORGANIZER ? contribution.member.user.phone : undefined,
        cycle: contribution.cycle,
        amount: contribution.amount.toFixed(2),
        status: contribution.status,
        paymentMethod: contribution.paymentMethod,
        momoReference: viewer.role === MemberRole.ORGANIZER ? contribution.momoReference : undefined,
        reviewNote: viewer.role === MemberRole.ORGANIZER || contribution.userId === auth.userId
          ? contribution.reviewNote
          : undefined,
        paidAt: contribution.paidAt?.toISOString() ?? null,
        verifiedAt: contribution.verifiedAt?.toISOString() ?? null,
        createdAt: contribution.createdAt.toISOString(),
      })),
    });
  } catch (error: unknown) {
    return apiErrorResponse(error, "The contribution ledger could not be loaded.");
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = recordContributionBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the contribution details." }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const callerMembership = await transaction.groupMember.findFirst({
        where: { groupId: id, userId: auth.userId, status: MemberStatus.ACTIVE },
        include: { group: true },
      });
      if (!callerMembership || !callerMembership.group.isActive) return { kind: "missing" as const };
      const group = callerMembership.group;
      if (group.currentCycle > group.totalCycles) return { kind: "complete" as const };

      if (parsed.data.method === "MOMO_MANUAL") {
        const existing = await transaction.contribution.findUnique({
          where: { memberId_cycle: { memberId: callerMembership.id, cycle: group.currentCycle } },
        });
        if (existing && existing.status !== ContributionStatus.PENDING) return { kind: "already-recorded" as const };
        if (existing) {
          const activeAttempt = await transaction.paymentAttempt.findFirst({
            where: {
              contributionId: existing.id,
              status: PaymentAttemptStatus.INITIALIZED,
              expiresAt: { gt: new Date() },
            },
            select: { id: true },
          });
          if (activeAttempt) return { kind: "payment-active" as const };
        }

        const now = new Date();
        const contribution = existing
          ? await transaction.contribution.update({
              where: { id: existing.id },
              data: {
                amount: group.contributionAmount,
                status: ContributionStatus.RECORDED,
                paymentMethod: PaymentMethod.MOMO_MANUAL,
                momoReference: parsed.data.reference.toUpperCase(),
                paystackReference: null,
                paidAt: now,
                verifiedAt: null,
                reviewNote: null,
                reviewedAt: null,
                reviewedByUserId: null,
              },
            })
          : await transaction.contribution.create({
              data: {
                groupId: group.id,
                memberId: callerMembership.id,
                userId: auth.userId,
                cycle: group.currentCycle,
                amount: group.contributionAmount,
                status: ContributionStatus.RECORDED,
                paymentMethod: PaymentMethod.MOMO_MANUAL,
                momoReference: parsed.data.reference.toUpperCase(),
                paidAt: now,
              },
            });
        return { kind: "recorded" as const, id: contribution.id, cycle: contribution.cycle, status: contribution.status };
      }

      if (callerMembership.role !== MemberRole.ORGANIZER) return { kind: "forbidden" as const };
      const targetMember = await transaction.groupMember.findFirst({
        where: { id: parsed.data.memberId, groupId: id, status: MemberStatus.ACTIVE },
        select: { id: true, userId: true },
      });
      if (!targetMember) return { kind: "target-missing" as const };
      const existing = await transaction.contribution.findUnique({
        where: { memberId_cycle: { memberId: targetMember.id, cycle: group.currentCycle } },
      });
      if (existing && existing.status === ContributionStatus.VERIFIED) return { kind: "already-verified" as const };
      if (existing && existing.status === ContributionStatus.RECORDED) return { kind: "under-review" as const };
      if (existing) {
        const activeAttempt = await transaction.paymentAttempt.findFirst({
          where: {
            contributionId: existing.id,
            status: PaymentAttemptStatus.INITIALIZED,
            expiresAt: { gt: new Date() },
          },
          select: { id: true },
        });
        if (activeAttempt) return { kind: "payment-active" as const };
      }

      const now = new Date();
      const contribution = existing
        ? await transaction.contribution.update({
            where: { id: existing.id },
            data: {
              amount: group.contributionAmount,
              status: ContributionStatus.VERIFIED,
              paymentMethod: PaymentMethod.CASH,
              momoReference: null,
              paystackReference: null,
              paidAt: now,
              verifiedAt: now,
              reviewNote: parsed.data.note ?? null,
              reviewedAt: now,
              reviewedByUserId: auth.userId,
            },
          })
        : await transaction.contribution.create({
            data: {
              groupId: group.id,
              memberId: targetMember.id,
              userId: targetMember.userId,
              cycle: group.currentCycle,
              amount: group.contributionAmount,
              status: ContributionStatus.VERIFIED,
              paymentMethod: PaymentMethod.CASH,
              paidAt: now,
              verifiedAt: now,
              reviewNote: parsed.data.note ?? null,
              reviewedAt: now,
              reviewedByUserId: auth.userId,
            },
          });
      await transaction.contributionReview.create({
        data: {
          contributionId: contribution.id,
          actorUserId: auth.userId,
          action: "CASH_RECORDED",
          note: parsed.data.note ?? null,
        },
      });
      return { kind: "recorded" as const, id: contribution.id, cycle: contribution.cycle, status: contribution.status };
    });

    if (result.kind === "missing") return notFoundResponse("This group is not available to your account.");
    if (result.kind === "complete") return conflictResponse("This group has completed all planned cycles.");
    if (result.kind === "forbidden") return forbiddenResponse("Only the organizer can record cash received.");
    if (result.kind === "target-missing") return notFoundResponse("The selected active group member was not found.");
    if (result.kind === "already-recorded") return conflictResponse("A contribution is already recorded for this cycle.");
    if (result.kind === "already-verified") return conflictResponse("This contribution is already verified.");
    if (result.kind === "under-review") return conflictResponse("This member has a MoMo reference awaiting review.");
    if (result.kind === "payment-active") return conflictResponse("A Paystack payment is already in progress for this cycle.");

    return NextResponse.json({ success: true, contribution: result }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return conflictResponse("A contribution already exists for this member and cycle.");
    }
    return apiErrorResponse(error, "The contribution could not be recorded.");
  }
}
