import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { normalizeGhanaPhone } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const devSignInBodySchema = z.object({
  phone: z.string().trim().min(1).max(30).optional(),
});

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV !== "development" || process.env.AUTH_DEMO_MODE !== "true") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = devSignInBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Enter a valid Ghana phone number." },
      { status: 400 },
    );
  }

  const phoneInput = parsed.data.phone;
  const phone = phoneInput ? normalizeGhanaPhone(phoneInput) : null;
  if (phoneInput && !phone) {
    return NextResponse.json({ error: "Enter a valid Ghana phone number." }, { status: 400 });
  }

  try {
    const session = await getSession();
    session.userId = `demo_${randomUUID()}`;
    session.phone = phone ?? undefined;
    session.displayName = phone ? undefined : "Preview member";
    session.isDemo = true;
    await session.save();

    return NextResponse.json({ success: true, mode: "demo" });
  } catch {
    return NextResponse.json(
      { error: "Demo sign-in is temporarily unavailable." },
      { status: 503 },
    );
  }
}
