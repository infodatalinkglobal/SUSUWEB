import type { Metadata } from "next";
import Link from "next/link";
import { MemberStatus } from "@prisma/client";
import { getSession, isDemoPreviewEnabled } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatGhs } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await getSession();
  const isDemoPreview = Boolean(session.isDemo) || (isDemoPreviewEnabled() && !session.userId);
  let memberships: Awaited<ReturnType<typeof loadMemberships>> = [];
  let loadFailed = false;

  if (session.userId && !session.isDemo) {
    try {
      memberships = await loadMemberships(session.userId);
    } catch {
      loadFailed = true;
    }
  }

  return (
    <div>
      <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-green-800">Your workspace</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Welcome to SusuApp.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            {isDemoPreview ? (
              <>You&apos;re in a temporary preview as <span className="font-semibold text-slate-900">{session.phone ?? session.displayName ?? "Preview member"}</span>. Demo sign-in creates no account, and no group or contribution data is saved.</>
            ) : (
              <>You&apos;re signed in as <span className="font-semibold text-slate-900">{session.phone}</span>. Manage your Susu groups and contribution records here.</>
            )}
          </p>
        </div>
        {!isDemoPreview ? (
          <Link href="/dashboard/groups/new" className="primary-button shrink-0 gap-2">
            Create a group <span aria-hidden="true">+</span>
          </Link>
        ) : null}
      </div>

      {loadFailed ? (
        <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
          We could not load your groups. Check the database connection and refresh this page.
        </div>
      ) : memberships.length > 0 ? (
        <section aria-labelledby="groups-heading">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 id="groups-heading" className="text-lg font-extrabold text-slate-950">Your groups</h2>
            <span className="text-sm text-slate-500">{memberships.length} active {memberships.length === 1 ? "group" : "groups"}</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {memberships.map(({ group, role }) => (
              <Link key={group.id} href={`/dashboard/groups/${encodeURIComponent(group.id)}`} className="surface-card group p-5 transition hover:-translate-y-0.5 hover:border-green-300 hover:shadow-lg">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-green-800">{group.type === "ROSCA" ? "Rotating Susu" : "Collector Susu"}</p>
                    <h3 className="mt-2 text-lg font-extrabold text-slate-950 group-hover:text-green-800">{group.name}</h3>
                  </div>
                  <span className="rounded-full bg-green-50 px-2.5 py-1 text-[11px] font-bold text-green-800">{role === "ORGANIZER" ? "Organizer" : "Member"}</span>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Contribution</p>
                    <p className="mt-1 font-extrabold text-slate-900">{formatGhs(group.contributionAmount.toFixed(2))}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Schedule</p>
                    <p className="mt-1 font-extrabold capitalize text-slate-900">{group.frequency.toLowerCase()}</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                  <span>Cycle {group.currentCycle} of {group.totalCycles}</span>
                  <span>{group.members.length} {group.members.length === 1 ? "member" : "members"}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : (
        <section className="surface-card grid min-h-[22rem] place-items-center p-6 text-center sm:p-10">
          <div className="max-w-md">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-green-100 text-2xl text-green-800" aria-hidden="true">◎</span>
            <h2 className="mt-5 text-xl font-extrabold text-slate-950">Your Susu groups start here</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {isDemoPreview
                ? "This preview shows the dashboard shell only. Sign in with a real Ghana phone account and database to create a group; this demo saves no data."
                : "Create a Collector or ROSCA group to set its contribution amount, schedule, and first cycle."}
            </p>
            {isDemoPreview ? (
              <Link href="/auth/login" className="mt-6 inline-flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-2.5 text-sm font-bold text-green-900 transition hover:bg-green-100">
                Back to sign-in <span aria-hidden="true">↗</span>
              </Link>
            ) : (
              <Link href="/dashboard/groups/new" className="primary-button mt-6 gap-2">
                Create your first group <span aria-hidden="true">+</span>
              </Link>
            )}
          </div>
        </section>
      )}

      {!isDemoPreview ? (
        <p className="mt-8 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs leading-5 text-slate-500">
          SusuApp records contributions; it does not hold, lend, or guarantee savings. GHS amounts are records, not a wallet balance.
        </p>
      ) : null}
    </div>
  );
}

async function loadMemberships(userId: string) {
  return prisma.groupMember.findMany({
    where: { userId, status: MemberStatus.ACTIVE, group: { isActive: true } },
    include: {
      group: {
        include: { members: { where: { status: MemberStatus.ACTIVE }, select: { id: true } } },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}
