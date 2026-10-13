import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MemberStatus } from "@prisma/client";
import { JoinInvitationButton } from "@/components/groups/join-invitation-button";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

type PageProps = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Join a Susu group" };

export default async function JoinGroupPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getSession();
  if (!session.userId || !session.phone || session.isDemo) {
    return (
      <main className="grid min-h-screen place-items-center px-4 py-10">
        <section className="surface-card w-full max-w-lg p-6 text-center sm:p-9">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-green-100 text-xl font-black text-green-800">S</span>
          <p className="mt-6 text-xs font-bold uppercase tracking-[0.16em] text-green-800">SusuApp invitation</p>
          <h1 className="mt-2 text-2xl font-black text-slate-950">Sign in with the invited phone.</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">To protect the group, accept the invitation after signing in with the Ghana number it was sent to. The app does not send WhatsApp messages; this link was prepared for you by the organizer.</p>
          <Link href="/auth/login" className="primary-button mt-6 w-full">Continue to sign in</Link>
        </section>
      </main>
    );
  }

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: id, userId: session.userId } },
    include: {
      user: { select: { phone: true } },
      group: { select: { id: true, name: true, type: true, contributionAmount: true, frequency: true, isActive: true } },
    },
  });
  if (!membership || membership.user.phone !== session.phone || membership.status === MemberStatus.LEFT || !membership.group.isActive) {
    return (
      <main className="grid min-h-screen place-items-center px-4 py-10">
        <section className="surface-card w-full max-w-lg p-6 text-center sm:p-9">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-green-800">SusuApp invitation</p>
          <h1 className="mt-2 text-2xl font-black text-slate-950">No matching invitation found.</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">This account does not have an active invitation for the signed-in phone. Use the number that received the WhatsApp link or contact the organizer.</p>
          <Link href="/auth/login" className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700">Use a different phone</Link>
        </section>
      </main>
    );
  }

  const group = membership.group;
  if (membership.status === MemberStatus.ACTIVE) {
    return (
      <main className="grid min-h-screen place-items-center px-4 py-10">
        <section className="surface-card w-full max-w-lg p-6 sm:p-9">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-green-800">Already joined</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">{group.name}</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">You are already an active member of this {group.type === "ROSCA" ? "ROSCA rotation" : "Collector Susu"} group.</p>
          <Link href={`/dashboard/groups/${encodeURIComponent(id)}`} className="primary-button mt-6 w-full">Open group</Link>
        </section>
      </main>
    );
  }

  if (membership.status !== MemberStatus.INVITED) notFound();

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <section className="surface-card w-full max-w-lg p-6 sm:p-9">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-green-100 text-lg font-black text-green-800">S</span>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.16em] text-green-800">SusuApp invitation</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">{group.name}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">You&apos;re signed in as <span className="font-semibold text-slate-900">{session.phone}</span>. This is a {group.type === "ROSCA" ? "ROSCA rotation" : "Collector Susu"} group.</p>
        <div className="mt-6 space-y-4">
          <div className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
            Contribution: <strong>{group.contributionAmount.toFixed(2)} GHS</strong> · {group.frequency.toLowerCase()}. Joining lets you see the group schedule and record your own contributions.
          </div>
          <JoinInvitationButton groupId={id} />
        </div>
      </section>
    </main>
  );
}
