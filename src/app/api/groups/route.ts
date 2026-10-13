import { MemberStatus, MemberRole, Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createGroupBodySchema } from "@/lib/validators";
import { normalizeGhsAmount } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;

  try {
    const memberships = await prisma.groupMember.findMany({
      where: {
        userId: auth.userId,
        status: MemberStatus.ACTIVE,
        group: { isActive: true },
      },
      include: {
        group: {
          include: {
            members: { where: { status: MemberStatus.ACTIVE }, select: { id: true } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({
      groups: memberships.map(({ group, role, status }) => ({
        id: group.id,
        name: group.name,
        type: group.type,
        contributionAmount: group.contributionAmount.toFixed(2),
        frequency: group.frequency,
        startDate: group.startDate.toISOString(),
        currentCycle: group.currentCycle,
        totalCycles: group.totalCycles,
        isActive: group.isActive,
        memberCount: group.members.length,
        role,
        membershipStatus: status,
      })),
    });
  } catch (error: unknown) {
    return apiErrorResponse(error, "Your groups could not be loaded.");
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = createGroupBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? "Check the group details and try again.",
        issues: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message })),
      },
      { status: 400 },
    );
  }

  try {
    const group = await prisma.$transaction(async (transaction) => {
      const createdGroup = await transaction.susuGroup.create({
        data: {
          name: parsed.data.name,
          type: parsed.data.type,
          contributionAmount: new Prisma.Decimal(normalizeGhsAmount(parsed.data.contributionAmount)),
          frequency: parsed.data.frequency,
          startDate: new Date(`${parsed.data.startDate}T00:00:00.000Z`),
          totalCycles: parsed.data.totalCycles,
          currentCycle: 1,
          isActive: true,
        },
      });
      await transaction.groupMember.create({
        data: {
          groupId: createdGroup.id,
          userId: auth.userId,
          role: MemberRole.ORGANIZER,
          status: MemberStatus.ACTIVE,
          rotationOrder: createdGroup.type === "ROSCA" ? 1 : null,
          joinedAt: new Date(),
        },
      });
      return createdGroup;
    });

    return NextResponse.json(
      {
        group: {
          id: group.id,
          name: group.name,
          type: group.type,
          contributionAmount: group.contributionAmount.toFixed(2),
          frequency: group.frequency,
          startDate: group.startDate.toISOString(),
          currentCycle: group.currentCycle,
          totalCycles: group.totalCycles,
        },
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    return apiErrorResponse(error, "The group could not be created.");
  }
}
