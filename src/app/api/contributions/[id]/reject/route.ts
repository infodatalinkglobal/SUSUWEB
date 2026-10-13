import { ContributionStatus, MemberRole, MemberStatus, PaymentMethod } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse, conflictResponse, forbiddenResponse, notFoundResponse, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { rejectContributionBodySchema } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = rejectContributionBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Add a review note." }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const contribution = await transaction.contribution.findUnique({ where: { id } });
      if (!contribution) return { kind: "missing" as const };
      const organizer = await transaction.groupMember.findFirst({
        where: { groupId: contribution.groupId, userId: auth.userId, status: MemberStatus.ACTIVE },
        select: { role: true },
      });
      if (!organizer || organizer.role !== MemberRole.ORGANIZER) return { kind: "forbidden" as const };
      if (contribution.status !== ContributionStatus.RECORDED || contribution.paymentMethod !== PaymentMethod.MOMO_MANUAL) {
        return { kind: "not-reviewable" as const };
      }

      const now = new Date();
      const update = await transaction.contribution.updateMany({
        where: { id, status: ContributionStatus.RECORDED, paymentMethod: PaymentMethod.MOMO_MANUAL },
        data: {
          status: ContributionStatus.PENDING,
          paymentMethod: null,
          momoReference: null,
          paidAt: null,
          verifiedAt: null,
          reviewedAt: now,
          reviewedByUserId: auth.userId,
          reviewNote: parsed.data.note,
        },
      });
      if (update.count !== 1) return { kind: "changed" as const };
      await transaction.contributionReview.create({
        data: {
          contributionId: id,
          actorUserId: auth.userId,
          action: "MOMO_REJECTED",
          note: parsed.data.note,
          referenceSnapshot: contribution.momoReference,
        },
      });
      return { kind: "rejected" as const };
    });

    if (result.kind === "missing") return notFoundResponse("Contribution not found.");
    if (result.kind === "forbidden") return forbiddenResponse("Only the group organizer can review this contribution.");
    if (result.kind === "not-reviewable") return conflictResponse("Only a recorded MoMo reference can be rejected.");
    if (result.kind === "changed") return conflictResponse("This contribution changed. Refresh the ledger and try again.");
    return NextResponse.json({ success: true, status: ContributionStatus.PENDING });
  } catch (error: unknown) {
    return apiErrorResponse(error, "The MoMo reference could not be rejected.");
  }
}
