import { MemberRole, MemberStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse, conflictResponse, forbiddenResponse, notFoundResponse, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { updateRotationBodySchema } from "@/lib/validators";

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
  const parsed = updateRotationBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid rotation order." }, { status: 400 });
  }

  const memberIds = parsed.data.members.map((member) => member.memberId);
  const orders = parsed.data.members.map((member) => member.rotationOrder).sort((left, right) => left - right);
  if (new Set(memberIds).size !== memberIds.length || orders.some((order, index) => order !== index + 1)) {
    return NextResponse.json({ error: "Every active or invited member needs one unique, sequential rotation turn." }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const organizer = await transaction.groupMember.findFirst({
        where: { groupId: id, userId: auth.userId, status: MemberStatus.ACTIVE },
        select: { role: true },
      });
      if (!organizer) return { kind: "missing" as const };
      if (organizer.role !== MemberRole.ORGANIZER) return { kind: "forbidden" as const };

      const group = await transaction.susuGroup.findUnique({
        where: { id },
        select: { id: true, type: true, currentCycle: true, totalCycles: true, isActive: true },
      });
      if (!group || !group.isActive) return { kind: "missing" as const };
      if (group.type !== "ROSCA") return { kind: "not-rosca" as const };
      if (group.currentCycle !== 1) return { kind: "started" as const };

      const contributionCount = await transaction.contribution.count({ where: { groupId: id } });
      if (contributionCount > 0) return { kind: "started" as const };

      const members = await transaction.groupMember.findMany({
        where: { groupId: id, status: { in: [MemberStatus.ACTIVE, MemberStatus.INVITED] } },
        select: { id: true },
        orderBy: { createdAt: "asc" },
      });
      if (members.length === 0 || members.length !== parsed.data.members.length || members.length > group.totalCycles) {
        return { kind: "membership-changed" as const };
      }
      const allowedMemberIds = new Set(members.map((member) => member.id));
      if (memberIds.some((memberId) => !allowedMemberIds.has(memberId))) return { kind: "membership-changed" as const };

      for (let index = 0; index < parsed.data.members.length; index += 1) {
        const member = parsed.data.members[index];
        await transaction.groupMember.update({
          where: { id: member.memberId },
          data: { rotationOrder: -(index + 1) },
        });
      }
      for (const member of parsed.data.members) {
        await transaction.groupMember.update({
          where: { id: member.memberId },
          data: { rotationOrder: member.rotationOrder },
        });
      }
      return { kind: "updated" as const };
    });

    if (result.kind === "missing") return notFoundResponse("This group is not available to your account.");
    if (result.kind === "forbidden") return forbiddenResponse("Only the organizer can edit the ROSCA rotation.");
    if (result.kind === "not-rosca") return conflictResponse("Rotation order applies only to ROSCA groups.");
    if (result.kind === "started") return conflictResponse("The ROSCA rotation is locked after the group starts recording contributions or advances cycles.");
    if (result.kind === "membership-changed") return conflictResponse("The member list changed. Refresh the rotation and try again.");
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return apiErrorResponse(error, "The ROSCA rotation could not be updated.");
  }
}
