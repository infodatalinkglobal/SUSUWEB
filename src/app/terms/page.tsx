import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <main className="min-h-screen px-5 py-10 sm:px-8 sm:py-16">
      <article className="surface-card mx-auto max-w-3xl p-6 sm:p-10">
        <Link href="/auth/login" className="text-sm font-bold text-green-800 hover:text-green-950">← Back to sign in</Link>
        <p className="mt-8 text-xs font-bold uppercase tracking-[0.16em] text-amber-800">Draft for MVP</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Terms of Service</h1>
        <p className="mt-2 text-sm text-slate-500">Draft version mvp-draft-2026-10-v1</p>
        <div className="mt-8 space-y-5 text-sm leading-7 text-slate-700">
          <p><strong>Important:</strong> These draft terms are not legal advice and have not yet received Ghanaian legal review. They must be finalized before production use or real-money payment processing.</p>
          <h2 className="text-lg font-bold text-slate-900">What SusuApp does</h2>
          <p>SusuApp provides digital records for Susu groups, contribution status, and ROSCA rotation schedules. It is a record-keeping and payment interface, not a wallet. It does not hold, lend, or guarantee savings.</p>
          <h2 className="text-lg font-bold text-slate-900">Payment records</h2>
          <p>A MoMo reference remains unverified until the group&apos;s organizer checks it. A Paystack payment is marked verified only after server-side confirmation. Cash entries are recorded by the organizer who received the cash. Users should report errors promptly.</p>
          <h2 className="text-lg font-bold text-slate-900">User responsibility</h2>
          <p>Users are responsible for protecting access to their phone and for reviewing their group&apos;s records. A displayed contribution or scheduled ROSCA turn does not itself guarantee settlement or receipt of funds.</p>
          <p className="rounded-xl bg-amber-50 p-4 text-amber-950">Final terms, fees, payment settlement details, support contact, and dispute procedures must be added after legal and operational review.</p>
        </div>
      </article>
    </main>
  );
}
