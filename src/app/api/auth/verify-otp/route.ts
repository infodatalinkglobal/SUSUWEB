import { NextRequest, NextResponse } from "next/server";
import { ArkeselUnavailableError, verifyOTP } from "@/lib/arkesel";
import {
  markOtpAttemptFailed,
  OtpLimitError,
  releaseOtpVerification,
  reserveOtpVerification,
} from "@/lib/otp-limits";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { normalizeGhanaPhone, verifyOtpBodySchema } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TERMS_VERSION = "mvp-draft-2026-10-v1";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = verifyOtpBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Enter the six-digit code and accept the policies." },
      { status: 400 },
    );
  }

  const phone = normalizeGhanaPhone(parsed.data.phone);
  if (!phone) {
    return NextResponse.json({ error: "Enter a valid Ghana phone number." }, { status: 400 });
  }

  let issuedAt: Date;
  try {
    issuedAt = await reserveOtpVerification(phone);
  } catch (error: unknown) {
    if (error instanceof OtpLimitError) {
      if (error.reason === "locked" || error.reason === "attempt-limit") {
        return NextResponse.json(
          { error: "Too many attempts. Wait 10 minutes before requesting another code." },
          { status: 429 },
        );
      }
      return NextResponse.json(
        { error: "This code is invalid or has expired. Request a new code and try again." },
        { status: 401 },
      );
    }
    return NextResponse.json(
      { error: "Verification is temporarily unavailable. Please try again shortly." },
      { status: 503 },
    );
  }

  let isValid: boolean;
  try {
    isValid = await verifyOTP(phone, parsed.data.code);
  } catch (error: unknown) {
    try {
      await releaseOtpVerification(phone, issuedAt);
    } catch {
      // Provider failures must not expose database details to the caller.
    }
    if (error instanceof ArkeselUnavailableError) {
      return NextResponse.json(
        { error: "The SMS verification service is temporarily unavailable." },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: "The SMS verification service is temporarily unavailable." },
      { status: 503 },
    );
  }

  if (!isValid) {
    try {
      const locked = await markOtpAttemptFailed(phone, issuedAt);
      return NextResponse.json(
        {
          error: locked
            ? "Too many attempts. Wait 10 minutes before requesting another code."
            : "That code is incorrect. Check the SMS and try again.",
        },
        { status: locked ? 429 : 401 },
      );
    } catch {
      return NextResponse.json(
        { error: "Verification is temporarily unavailable. Please try again shortly." },
        { status: 503 },
      );
    }
  }

  try {
    const acceptedAt = new Date();
    const user = await prisma.$transaction(async (transaction) => {
      const account = await transaction.user.upsert({
        where: { phone },
        update: {
          termsAcceptedAt: acceptedAt,
          termsVersion: TERMS_VERSION,
        },
        create: {
          phone,
          termsAcceptedAt: acceptedAt,
          termsVersion: TERMS_VERSION,
        },
        select: { id: true, phone: true, name: true },
      });

      await transaction.otpChallenge.deleteMany({
        where: { phone, challengeIssuedAt: issuedAt },
      });
      return account;
    });

    const session = await getSession();
    session.userId = user.id;
    session.phone = user.phone;
    await session.save();

    return NextResponse.json({
      success: true,
      user: { phone: user.phone, name: user.name },
    });
  } catch {
    return NextResponse.json(
      { error: "We could not complete sign-in. Please request a new code and try again." },
      { status: 503 },
    );
  }
}
