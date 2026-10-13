import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <main className="min-h-screen px-5 py-10 sm:px-8 sm:py-16">
      <article className="surface-card mx-auto max-w-3xl p-6 sm:p-10">
        <Link href="/auth/login" className="text-sm font-bold text-green-800 hover:text-green-950">← Back to sign in</Link>
        <p className="mt-8 text-xs font-bold uppercase tracking-[0.16em] text-amber-800">Draft for MVP</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Privacy Policy</h1>
        <p className="mt-2 text-sm text-slate-500">Draft version mvp-draft-2026-10-v1</p>
        <div className="mt-8 space-y-5 text-sm leading-7 text-slate-700">
          <p><strong>Important:</strong> This draft describes the intended MVP data use and is not a finalized privacy notice. Obtain Ghanaian privacy/legal review and publish the final policy before production use.</p>
          <h2 className="text-lg font-bold text-slate-900">Information used</h2>
          <p>The MVP uses a Ghana phone number to deliver OTP codes, identify a user, and connect that user to group records. Group names, membership, contribution references, payment status, and audit timestamps are stored to provide the ledger.</p>
          <h2 className="text-lg font-bold text-slate-900">How information is used</h2>
          <p>Information is used to authenticate users, operate group ledgers, prepare WhatsApp links, and reconcile payment events. Paystack and Arkesel receive only the information required for their respective payment and OTP services.</p>
          <h2 className="text-lg font-bold text-slate-900">Security and control</h2>
          <p>Access is intended to be limited by group membership and role. OTP values and provider secrets must not be stored in the application database or exposed in logs. Users should contact the product team to request access, correction, or deletion, subject to financial-record retention obligations.</p>
          <p className="rounded-xl bg-amber-50 p-4 text-amber-950">Before launch, add a verified contact, legal basis, retention periods, data-subject rights process, processor details, and any applicable registration information.</p>
        </div>
      </article>
    </main>
  );
}
