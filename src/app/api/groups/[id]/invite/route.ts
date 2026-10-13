import { MemberRole, MemberStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse, forbiddenResponse, notFoundResponse, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getAppBaseUrl } from "@/lib/utils";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { inviteMembersBodySchema, normalizeGhanaPhone } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };
type InviteOutcome = {
  phone: string;
  status: "invited" | "already-invited" | "already-active" | "rotation-full";
  name: string | null;
};

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
  const parsed = inviteMembersBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Enter valid phone numbers." }, { status: 400 });
  }

  const rawNumbers = parsed.data.phones.split(/[\n\r,;]+/).map((value) => value.trim()).filter(Boolean);
  const invalidNumbers: string[] = [];
  const duplicateNumbers: string[] = [];
  const uniquePhones: string[] = [];
  const seen = new Set<string>();
  for (const rawNumber of rawNumbers) {
    const phone = normalizeGhanaPhone(rawNumber);
    if (!phone) {
      invalidNumbers.push(rawNumber);
      continue;
    }
    if (seen.has(phone)) {
      duplicateNumbers.push(phone);
      continue;
    }
    seen.add(phone);
    uniquePhones.push(phone);
  }
  if (uniquePhones.length === 0) {
    return NextResponse.json({
      results: [],
      invalidNumbers,
      duplicateNumbers,
      message: "No valid, unique Ghana numbers were provided.",
    });
  }

  try {
    const transactionResult = await prisma.$transaction(async (transaction) => {
      const organizer = await transaction.groupMember.findFirst({
        where: { groupId: id, userId: auth.userId, status: MemberStatus.ACTIVE },
        select: { role: true },
      });
      if (!organizer) return { kind: "missing" as const };
      if (organizer.role !== MemberRole.ORGANIZER) return { kind: "forbidden" as const };

      const group = await transaction.susuGroup.findUnique({
        where: { id },
        select: { id: true, name: true, type: true, totalCycles: true, isActive: true },
      });
      if (!group || !group.isActive) return { kind: "missing" as const };

      const latestRotation = group.type === "ROSCA"
        ? await transaction.groupMember.findFirst({
            where: { groupId: id, status: { not: MemberStatus.LEFT }, rotationOrder: { not: null } },
            orderBy: { rotationOrder: "desc" },
            select: { rotationOrder: true },
          })
        : null;
      let nextRotation = (latestRotation?.rotationOrder ?? 0) + 1;
      const outcomes: InviteOutcome[] = [];

      for (const phone of uniquePhones) {
        let user = await transaction.user.findUnique({ where: { phone }, select: { id: true, name: true } });
        const existingMembership = user
          ? await transaction.groupMember.findUnique({
              where: { groupId_userId: { groupId: id, userId: user.id } },
              select: { id: true, status: true, rotationOrder: true },
            })
          : null;

        if (existingMembership?.status === MemberStatus.ACTIVE) {
          outcomes.push({ phone, status: "already-active", name: user?.name ?? null });
          continue;
        }
        if (existingMembership?.status === MemberStatus.INVITED) {
          outcomes.push({ phone, status: "already-invited", name: user?.name ?? null });
          continue;
        }

        const hasReusableRotation = group.type === "ROSCA" && existingMembership?.rotationOrder !== null && existingMembership?.rotationOrder !== undefined;
        const assignedRotation = group.type === "ROSCA"
          ? hasReusableRotation ? existingMembership.rotationOrder : nextRotation
          : null;
        if (group.type === "ROSCA" && (assignedRotation === null || assignedRotation > group.totalCycles)) {
          outcomes.push({ phone, status: "rotation-full", name: user?.name ?? null });
          continue;
        }

        if (!user) {
          user = await transaction.user.create({ data: { phone }, select: { id: true, name: true } });
        }

        if (existingMembership) {
          await transaction.groupMember.update({
            where: { id: existingMembership.id },
            data: {
              status: MemberStatus.INVITED,
              role: MemberRole.MEMBER,
              rotationOrder: assignedRotation,
              invitedAt: new Date(),
              joinedAt: null,
            },
          });
        } else {
          await transaction.groupMember.create({
            data: {
              groupId: id,
              userId: user.id,
              status: MemberStatus.INVITED,
              role: MemberRole.MEMBER,
              rotationOrder: assignedRotation,
              invitedAt: new Date(),
            },
          });
        }
        if (group.type === "ROSCA" && !hasReusableRotation) nextRotation += 1;
        outcomes.push({ phone, status: "invited", name: user.name });
      }

      return { kind: "success" as const, groupName: group.name, outcomes };
    });

    if (transactionResult.kind === "missing") return notFoundResponse("This group is not available to your account.");
    if (transactionResult.kind === "forbidden") return forbiddenResponse("Only the organizer can invite members.");

    const appBaseUrl = getAppBaseUrl(request.headers.get("origin"));
    const joinUrl = new URL(`/join/${encodeURIComponent(id)}`, appBaseUrl).toString();
    const results = transactionResult.outcomes.map((outcome) => {
      const message = `🤝 You've been invited to join "${transactionResult.groupName}" on SusuApp! Tap to join: ${joinUrl} Save together, grow together 🇬🇭`;
      const mayResend = outcome.status === "invited" || outcome.status === "already-invited";
      return {
        ...outcome,
        whatsappUrl: mayResend ? buildWhatsAppUrl(outcome.phone, message) : null,
      };
    });

    return NextResponse.json({
      groupName: transactionResult.groupName,
      joinUrl,
      results,
      invalidNumbers,
      duplicateNumbers,
      message: "WhatsApp links are prepared only; choose a recipient and press Send in WhatsApp.",
    });
  } catch (error: unknown) {
    return apiErrorResponse(error, "Invitations could not be created.");
  }
}
