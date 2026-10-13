import { NextRequest, NextResponse } from "next/server";
import { ArkeselError, ArkeselUnavailableError, sendOTP } from "@/lib/arkesel";
import { OtpLimitError, reserveOtpSend } from "@/lib/otp-limits";
import { normalizeGhanaPhone, sendOtpBodySchema } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = sendOtpBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Enter a valid Ghana phone number." },
      { status: 400 },
    );
  }

  const phone = normalizeGhanaPhone(parsed.data.phone);
  if (!phone) {
    return NextResponse.json(
      { error: "Enter a valid Ghana phone number, such as 024 412 3456." },
      { status: 400 },
    );
  }

  try {
    await reserveOtpSend(phone);
  } catch (error: unknown) {
    if (error instanceof OtpLimitError) {
      return NextResponse.json(
        { error: "Please wait before requesting another code." },
        { status: 429 },
      );
    }
    return NextResponse.json(
      { error: "Sign-in is temporarily unavailable. Please try again shortly." },
      { status: 503 },
    );
  }

  try {
    await sendOTP(phone);
  } catch (error: unknown) {
    if (error instanceof ArkeselError) {
      return NextResponse.json(
        { error: "The SMS provider could not send a code. Please try again." },
        { status: 502 },
      );
    }
    if (error instanceof ArkeselUnavailableError) {
      return NextResponse.json(
        { error: "SMS sign-in is not configured or is temporarily unavailable." },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: "SMS sign-in is temporarily unavailable. Please try again shortly." },
      { status: 503 },
    );
  }

  return NextResponse.json({
    success: true,
    message: "If this number can receive SMS, a sign-in code has been sent.",
  });
}
