import Link from "next/link";

const highlights = [
  {
    number: "01",
    title: "One clear ledger",
    copy: "See contributions and payment status together, without searching through messages or paper books.",
  },
  {
    number: "02",
    title: "A fair rotation",
    copy: "Give every ROSCA member a visible turn and keep the schedule easy to check.",
  },
  {
    number: "03",
    title: "Made for Ghana",
    copy: "Track GHS contributions, MoMo references, Paystack payments, and cash received.",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f6faf6]">
      <div className="pointer-events-none absolute -right-28 -top-44 h-[34rem] w-[34rem] rounded-full bg-green-100/60 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-56 -left-32 h-[34rem] w-[34rem] rounded-full bg-amber-100/50 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-5 pb-10 sm:px-8 lg:px-12">
        <header className="flex h-20 items-center justify-between border-b border-green-950/10">
          <Link href="/" className="flex items-center gap-3" aria-label="SusuApp home">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-green-800 text-lg font-black text-white shadow-lg shadow-green-900/15">
              S
            </span>
            <span className="text-lg font-extrabold tracking-tight text-slate-900">SusuApp</span>
            <span className="hidden rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-900 sm:inline-flex">
              Ghana
            </span>
          </Link>
          <Link href="/auth/login" className="text-sm font-bold text-green-800 transition hover:text-green-950">
            Sign in <span aria-hidden="true">→</span>
          </Link>
        </header>

        <section className="grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-[1.02fr_0.98fr] lg:gap-16 lg:py-24">
          <div className="max-w-2xl">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-green-200 bg-white/80 px-3.5 py-2 text-xs font-bold text-green-900 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-green-600" />
              Save together. Grow together.
            </div>
            <h1 className="text-5xl font-black leading-[1.03] tracking-[-0.055em] text-slate-950 sm:text-6xl lg:text-[4.4rem]">
              Your Susu,
              <br />
              <span className="text-green-800">clear at every step.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
              Keep every contribution, member, and ROSCA turn in one simple place. Built for Ghanaian
              savings groups and the people who keep them moving.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href="/auth/login" className="primary-button gap-2 px-6 text-base">
                Get started <span aria-hidden="true">↗</span>
              </Link>
              <span className="text-sm text-slate-500">Sign in securely with your Ghana phone number.</span>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs font-semibold text-slate-500">
              <span className="inline-flex items-center gap-2"><span className="text-green-700">✓</span> Collector and group Susu</span>
              <span className="inline-flex items-center gap-2"><span className="text-green-700">✓</span> GHS contribution tracking</span>
              <span className="inline-flex items-center gap-2"><span className="text-green-700">✓</span> Mobile-first web app</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[34rem]">
            <div className="absolute -inset-5 rounded-[2.5rem] bg-gradient-to-br from-green-100 via-white to-amber-100 opacity-80 blur-xl" />
            <div className="surface-card relative overflow-hidden p-5 sm:p-7">
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.15em] text-green-800">Group overview</p>
                  <h2 className="mt-2 text-xl font-extrabold tracking-tight text-slate-950">Adom Women&apos;s Susu</h2>
                  <p className="mt-1 text-sm text-slate-500">ROSCA · Weekly · Cycle 3 of 8</p>
                </div>
                <span className="rounded-xl bg-green-50 px-3 py-2 text-xs font-bold text-green-800">Active</span>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-medium text-slate-500">Contribution</p>
                  <p className="mt-2 text-xl font-extrabold text-slate-900">GHS 50.00</p>
                </div>
                <div className="rounded-2xl bg-green-50 p-4">
                  <p className="text-xs font-medium text-green-800">Estimated pot</p>
                  <p className="mt-2 text-xl font-extrabold text-green-900">GHS 400.00</p>
                </div>
              </div>

              <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
                <div className="grid grid-cols-[1fr_auto_auto] items-center bg-slate-50 px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <span>Member</span><span>Cycle 2</span><span>Cycle 3</span>
                </div>
                {[
                  { name: "Ama K.", first: "Paid", second: "Paid", active: true },
                  { name: "Kofi M.", first: "Paid", second: "Due", active: false },
                  { name: "Akua B.", first: "Paid", second: "Review", active: false },
                ].map((member) => (
                  <div key={member.name} className={`grid grid-cols-[1fr_auto_auto] items-center gap-3 border-t border-slate-100 px-4 py-3.5 text-sm ${member.active ? "bg-green-50/70" : "bg-white"}`}>
                    <span className="font-semibold text-slate-800">{member.name}</span>
                    <span className="inline-flex min-w-14 justify-center rounded-full bg-green-100 px-2.5 py-1 text-[11px] font-bold text-green-800">✓ {member.first}</span>
                    <span className={`inline-flex min-w-14 justify-center rounded-full px-2.5 py-1 text-[11px] font-bold ${member.second === "Paid" ? "bg-green-100 text-green-800" : member.second === "Review" ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-600"}`}>
                      {member.second === "Paid" ? "✓" : member.second === "Review" ? "◷" : "—"} {member.second}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex items-center justify-between rounded-2xl bg-slate-950 px-4 py-4 text-white">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-green-200">Next pot recipient</p>
                  <p className="mt-1 text-sm font-bold">Cycle 3 · Ama K.</p>
                </div>
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-xl" aria-hidden="true">♙</span>
              </div>
            </div>
            <div className="absolute -bottom-5 -left-4 hidden items-center gap-3 rounded-2xl border border-green-100 bg-white px-4 py-3 shadow-card sm:flex">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-green-100 text-lg text-green-800" aria-hidden="true">✓</span>
              <span><span className="block text-xs font-bold text-slate-900">Payment verified</span><span className="mt-0.5 block text-[11px] text-slate-500">Your ledger stays up to date</span></span>
            </div>
          </div>
        </section>

        <section className="grid gap-4 border-t border-green-950/10 py-10 sm:grid-cols-3 sm:py-12">
          {highlights.map((item) => (
            <article key={item.number} className="rounded-2xl p-4 sm:p-5">
              <p className="text-xs font-black tracking-[0.16em] text-green-700">{item.number}</p>
              <h2 className="mt-3 text-lg font-extrabold text-slate-900">{item.title}</h2>
              <p className="mt-2 max-w-sm text-sm leading-6 text-slate-600">{item.copy}</p>
            </article>
          ))}
        </section>

        <footer className="flex flex-col gap-3 border-t border-green-950/10 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} SusuApp. Save together, grow together. 🇬🇭</span>
          <span>SusuApp records activity; it does not hold or guarantee savings.</span>
        </footer>
      </div>
    </main>
  );
}
