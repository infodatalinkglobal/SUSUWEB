import { ContributionStatus, MemberRole, MemberStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse, forbiddenResponse, notFoundResponse, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { formatGhs, getAppBaseUrl } from "@/lib/utils";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { prepareRemindersBodySchema } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const { id } = await context.params;

  let body: unknown = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text) as unknown;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = prepareRemindersBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid reminder selection." }, { status: 400 });
  }

  try {
    const organizer = await prisma.groupMember.findFirst({
      where: { groupId: id, userId: auth.userId, role: MemberRole.ORGANIZER, status: MemberStatus.ACTIVE },
      select: { id: true },
    });
    if (!organizer) {
      const anyMembership = await prisma.groupMember.findFirst({
        where: { groupId: id, userId: auth.userId, status: MemberStatus.ACTIVE },
        select: { id: true },
      });
      if (!anyMembership) return notFoundResponse("This group is not available to your account.");
      return forbiddenResponse("Only the organizer can prepare group reminders.");
    }

    const group = await prisma.susuGroup.findUnique({
      where: { id },
      select: { id: true, name: true, currentCycle: true, totalCycles: true, contributionAmount: true, isActive: true },
    });
    if (!group || !group.isActive) return notFoundResponse("This group is no longer active.");
    if (group.currentCycle > group.totalCycles) {
      return NextResponse.json({ cycle: group.currentCycle, reminders: [], message: "The group has completed all planned cycles." });
    }

    const selectedIds = parsed.data.memberIds ? new Set(parsed.data.memberIds) : null;
    const members = await prisma.groupMember.findMany({
      where: {
        groupId: id,
        status: MemberStatus.ACTIVE,
        ...(selectedIds ? { id: { in: [...selectedIds] } } : {}),
      },
      include: { user: { select: { name: true, phone: true } } },
      orderBy: [{ rotationOrder: "asc" }, { joinedAt: "asc" }],
    });
    const contributions = await prisma.contribution.findMany({
      where: { groupId: id, cycle: group.currentCycle },
      select: { memberId: true, status: true },
    });
    const contributionByMember = new Map(contributions.map((contribution) => [contribution.memberId, contribution.status]));
    const groupUrl = new URL(`/dashboard/groups/${encodeURIComponent(id)}/contribute`, getAppBaseUrl(request.headers.get("origin"))).toString();
    const amount = formatGhs(group.contributionAmount.toFixed(2));
    const reminders = members
      .filter((member) => {
        const status = contributionByMember.get(member.id);
        return status !== ContributionStatus.VERIFIED && status !== ContributionStatus.RECORDED;
      })
      .map((member) => {
        const name = member.user.name ?? "there";
        const message = `⚠️ Hi ${name}, your ${amount} Susu contribution for ${group.name} is due. Pay now: ${groupUrl} — SusuApp 🇬🇭`;
        return {
          memberId: member.id,
          name: member.user.name ?? "Susu member",
          phone: member.user.phone,
          status: contributionByMember.get(member.id) ?? ContributionStatus.PENDING,
          whatsappUrl: buildWhatsAppUrl(member.user.phone, message),
        };
      });

    return NextResponse.json({
      cycle: group.currentCycle,
      reminders,
      message: "Links only: review each recipient, open WhatsApp, and press Send. No message was sent by SusuApp.",
    });
  } catch (error: unknown) {
    return apiErrorResponse(error, "Reminder links could not be prepared.");
  }
}
