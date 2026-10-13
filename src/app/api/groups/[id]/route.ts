import { MemberRole, MemberStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { apiErrorResponse, notFoundResponse, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const { id } = await context.params;

  try {
    const membership = await prisma.groupMember.findFirst({
      where: { groupId: id, userId: auth.userId, status: MemberStatus.ACTIVE },
      select: { id: true, role: true },
    });
    if (!membership) return notFoundResponse("This group is not available to your account.");

    const group = await prisma.susuGroup.findUnique({
      where: { id },
      include: {
        members: {
          where: membership.role === MemberRole.ORGANIZER
            ? { status: { in: [MemberStatus.ACTIVE, MemberStatus.INVITED] } }
            : { status: MemberStatus.ACTIVE },
          include: { user: { select: { name: true, phone: true } } },
          orderBy: [{ rotationOrder: "asc" }, { joinedAt: "asc" }, { createdAt: "asc" }],
        },
      },
    });
    if (!group || !group.isActive) return notFoundResponse("This group is no longer active.");

    return NextResponse.json({
      group: {
        id: group.id,
        name: group.name,
        type: group.type,
        contributionAmount: group.contributionAmount.toFixed(2),
        frequency: group.frequency,
        startDate: group.startDate.toISOString(),
        currentCycle: group.currentCycle,
        totalCycles: group.totalCycles,
        isActive: group.isActive,
        viewerRole: membership.role,
        members: group.members.map((member) => ({
          id: member.id,
          name: member.user.name ?? "Susu member",
          phone: membership.role === MemberRole.ORGANIZER ? member.user.phone : undefined,
          role: member.role,
          status: member.status,
          rotationOrder: member.rotationOrder,
        })),
      },
    });
  } catch (error: unknown) {
    return apiErrorResponse(error, "The group could not be loaded.");
  }
}
