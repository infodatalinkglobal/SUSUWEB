import { MemberRole, MemberStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse, conflictResponse, forbiddenResponse, notFoundResponse, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { advanceCycleBodySchema } from "@/lib/validators";

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
  const parsed = advanceCycleBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid cycle." }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const membership = await transaction.groupMember.findFirst({
        where: { groupId: id, userId: auth.userId, status: MemberStatus.ACTIVE },
        select: { role: true },
      });
      if (!membership) return { kind: "missing" as const };
      if (membership.role !== MemberRole.ORGANIZER) return { kind: "forbidden" as const };

      const group = await transaction.susuGroup.findUnique({
        where: { id },
        select: { currentCycle: true, totalCycles: true, isActive: true },
      });
      if (!group || !group.isActive) return { kind: "missing" as const };
      if (group.currentCycle !== parsed.data.expectedCycle) return { kind: "stale" as const };
      if (group.currentCycle >= group.totalCycles) return { kind: "complete" as const };

      const updated = await transaction.susuGroup.updateMany({
        where: { id, currentCycle: parsed.data.expectedCycle, isActive: true },
        data: { currentCycle: { increment: 1 } },
      });
      if (updated.count !== 1) return { kind: "stale" as const };
      return { kind: "advanced" as const, currentCycle: parsed.data.expectedCycle + 1 };
    });

    if (result.kind === "missing") return notFoundResponse("This group is not available to your account.");
    if (result.kind === "forbidden") return forbiddenResponse("Only the organizer can advance the cycle.");
    if (result.kind === "stale") return conflictResponse("The group cycle changed. Refresh the ledger and try again.");
    if (result.kind === "complete") return conflictResponse("This group has completed all planned cycles.");
    return NextResponse.json({ success: true, currentCycle: result.currentCycle });
  } catch (error: unknown) {
    return apiErrorResponse(error, "The cycle could not be advanced.");
  }
}
