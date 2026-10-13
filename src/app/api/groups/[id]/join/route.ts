import { MemberStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { apiErrorResponse, conflictResponse, forbiddenResponse, notFoundResponse, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const { id } = await context.params;

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const group = await transaction.susuGroup.findUnique({
        where: { id },
        select: { id: true, name: true, type: true, isActive: true },
      });
      if (!group || !group.isActive) return { kind: "missing" as const };

      const membership = await transaction.groupMember.findUnique({
        where: { groupId_userId: { groupId: id, userId: auth.userId } },
        include: { user: { select: { phone: true } } },
      });
      if (!membership) return { kind: "missing" as const };
      if (membership.user.phone !== auth.phone) return { kind: "phone-mismatch" as const };
      if (membership.status === MemberStatus.ACTIVE) {
        return { kind: "joined" as const, group: { id: group.id, name: group.name, type: group.type } };
      }
      if (membership.status !== MemberStatus.INVITED) return { kind: "not-invited" as const };

      const update = await transaction.groupMember.updateMany({
        where: { id: membership.id, status: MemberStatus.INVITED },
        data: { status: MemberStatus.ACTIVE, joinedAt: new Date() },
      });
      if (update.count !== 1) return { kind: "race" as const };
      return { kind: "joined" as const, group: { id: group.id, name: group.name, type: group.type } };
    });

    if (result.kind === "missing") return notFoundResponse("No invitation for this account was found.");
    if (result.kind === "phone-mismatch") return forbiddenResponse("Sign in with the phone number that received this invitation.");
    if (result.kind === "not-invited") return conflictResponse("This membership is no longer available to accept.");
    if (result.kind === "race") return conflictResponse("The invitation changed. Refresh the page and try again.");
    return NextResponse.json({ success: true, group: result.group });
  } catch (error: unknown) {
    return apiErrorResponse(error, "The invitation could not be accepted.");
  }
}
