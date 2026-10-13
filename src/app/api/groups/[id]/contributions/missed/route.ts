import { ContributionStatus, MemberRole, MemberStatus, PaymentAttemptStatus, Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse, conflictResponse, forbiddenResponse, notFoundResponse, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { markMissedBodySchema } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

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
  const parsed = markMissedBodySchema.safeParse(body);
  if (!parsed.success || !parsed.data.memberId) {
    return NextResponse.json({ error: parsed.success ? "Choose an active group member." : parsed.error.issues[0]?.message ?? "Invalid contribution." }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const organizer = await transaction.groupMember.findFirst({
        where: { groupId: id, userId: auth.userId, status: MemberStatus.ACTIVE },
        select: { id: true, role: true },
      });
      if (!organizer) return { kind: "missing" as const };
      if (organizer.role !== MemberRole.ORGANIZER) return { kind: "forbidden" as const };

      const group = await transaction.susuGroup.findUnique({
        where: { id },
        select: { id: true, currentCycle: true, totalCycles: true, isActive: true, contributionAmount: true },
      });
      if (!group || !group.isActive) return { kind: "missing" as const };
      if (group.currentCycle > group.totalCycles) return { kind: "complete" as const };

      const member = await transaction.groupMember.findFirst({
        where: { id: parsed.data.memberId, groupId: id, status: MemberStatus.ACTIVE },
        select: { id: true, userId: true },
      });
      if (!member) return { kind: "member-missing" as const };

      const existing = await transaction.contribution.findUnique({
        where: { memberId_cycle: { memberId: member.id, cycle: group.currentCycle } },
      });
      if (existing?.status === ContributionStatus.MISSED) return { kind: "already-missed" as const };
      if (existing && existing.status !== ContributionStatus.PENDING) return { kind: "not-pending" as const };
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
              status: ContributionStatus.MISSED,
              paymentMethod: null,
              momoReference: null,
              paystackReference: null,
              paidAt: null,
              verifiedAt: null,
              reviewNote: parsed.data.note ?? null,
              reviewedAt: now,
              reviewedByUserId: auth.userId,
            },
          })
        : await transaction.contribution.create({
            data: {
              groupId: group.id,
              memberId: member.id,
              userId: member.userId,
              cycle: group.currentCycle,
              amount: group.contributionAmount,
              status: ContributionStatus.MISSED,
              reviewNote: parsed.data.note ?? null,
              reviewedAt: now,
              reviewedByUserId: auth.userId,
            },
          });
      await transaction.contributionReview.create({
        data: {
          contributionId: contribution.id,
          actorUserId: auth.userId,
          action: "MARKED_MISSED",
          note: parsed.data.note ?? null,
        },
      });
      return { kind: "marked" as const, contributionId: contribution.id, cycle: contribution.cycle };
    });

    if (result.kind === "missing") return notFoundResponse("This group is not available to your account.");
    if (result.kind === "forbidden") return forbiddenResponse("Only the organizer can mark a contribution missed.");
    if (result.kind === "member-missing") return notFoundResponse("The selected active group member was not found.");
    if (result.kind === "complete") return conflictResponse("This group has completed all planned cycles.");
    if (result.kind === "not-pending") return conflictResponse("Only an unpaid pending contribution can be marked missed.");
    if (result.kind === "payment-active") return conflictResponse("A Paystack payment is still in progress for this cycle.");
    if (result.kind === "already-missed") return NextResponse.json({ success: true, status: ContributionStatus.MISSED });
    return NextResponse.json({ success: true, ...result, status: ContributionStatus.MISSED }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return conflictResponse("A contribution already exists for this member and cycle.");
    }
    return apiErrorResponse(error, "The contribution could not be marked missed.");
  }
}
