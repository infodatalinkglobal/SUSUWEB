import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GroupCreateForm } from "@/components/groups/group-create-form";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Create a group" };

export default async function NewGroupPage() {
  const session = await getSession();
  if (!session.userId || !session.phone || session.isDemo) redirect("/auth/login");

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/dashboard" className="text-sm font-semibold text-green-800 hover:text-green-950">← Back to dashboard</Link>
      <div className="mt-6">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-green-800">New Susu group</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Set up your group.</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">Choose the savings model, agree the contribution, and set the schedule. Amounts are records in GHS; SusuApp does not hold funds.</p>
      </div>
      <GroupCreateForm />
    </div>
  );
}
