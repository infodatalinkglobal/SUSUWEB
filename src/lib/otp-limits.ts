import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_LOCKOUT_MS = 10 * 60 * 1000;
const OTP_SEND_WINDOW_MS = 10 * 60 * 1000;
const MAX_SENDS_PER_WINDOW = 3;
const MAX_VERIFICATION_ATTEMPTS = 3;

export type OtpLimitReason = "locked" | "send-rate-limit" | "attempt-limit" | "expired" | "missing";

export class OtpLimitError extends Error {
  readonly reason: OtpLimitReason;

  constructor(reason: OtpLimitReason) {
    super(reason);
    this.name = "OtpLimitError";
    this.reason = reason;
  }
}

async function withSerializableRetry<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error: unknown) {
      const retryable =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2034" || error.code === "P2002");
      if (!retryable || attempt === 2) throw error;
    }
  }

  throw new Error("Could not reserve OTP request.");
}

export async function reserveOtpSend(phone: string, now = new Date()): Promise<void> {
  await withSerializableRetry(async (tx) => {
    const existing = await tx.otpChallenge.findUnique({ where: { phone } });

    if (existing?.lockedUntil && existing.lockedUntil > now) {
      throw new OtpLimitError("locked");
    }

    const windowIsCurrent =
      existing !== null && now.getTime() - existing.sendWindowStartedAt.getTime() < OTP_SEND_WINDOW_MS;

    if (windowIsCurrent && existing.sendCount >= MAX_SENDS_PER_WINDOW) {
      throw new OtpLimitError("send-rate-limit");
    }

    const sendCount = windowIsCurrent ? existing.sendCount + 1 : 1;
    const sendWindowStartedAt = windowIsCurrent ? existing.sendWindowStartedAt : now;

    if (existing) {
      await tx.otpChallenge.update({
        where: { phone },
        data: {
          challengeIssuedAt: now,
          verificationAttempts: 0,
          lockedUntil: null,
          sendWindowStartedAt,
          sendCount,
        },
      });
    } else {
      await tx.otpChallenge.create({
        data: {
          phone,
          challengeIssuedAt: now,
          verificationAttempts: 0,
          sendWindowStartedAt,
          sendCount,
        },
      });
    }
  });
}

export async function reserveOtpVerification(phone: string, now = new Date()): Promise<Date> {
  const expiresAt = new Date(now.getTime() - OTP_TTL_MS);
  const result = await prisma.otpChallenge.updateMany({
    where: {
      phone,
      challengeIssuedAt: { gt: expiresAt },
      verificationAttempts: { lt: MAX_VERIFICATION_ATTEMPTS },
      OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }],
    },
    data: { verificationAttempts: { increment: 1 } },
  });

  if (result.count === 1) {
    const reservedChallenge = await prisma.otpChallenge.findUnique({ where: { phone } });
    if (reservedChallenge) return reservedChallenge.challengeIssuedAt;
    throw new OtpLimitError("missing");
  }

  const challenge = await prisma.otpChallenge.findUnique({ where: { phone } });
  if (!challenge) throw new OtpLimitError("missing");
  if (challenge.lockedUntil && challenge.lockedUntil > now) throw new OtpLimitError("locked");
  if (challenge.verificationAttempts >= MAX_VERIFICATION_ATTEMPTS) {
    throw new OtpLimitError("attempt-limit");
  }
  if (challenge.challengeIssuedAt.getTime() <= expiresAt.getTime()) {
    throw new OtpLimitError("expired");
  }

  throw new OtpLimitError("missing");
}

export async function releaseOtpVerification(phone: string, issuedAt: Date): Promise<void> {
  await prisma.otpChallenge.updateMany({
    where: { phone, challengeIssuedAt: issuedAt, verificationAttempts: { gt: 0 } },
    data: { verificationAttempts: { decrement: 1 } },
  });
}

export async function markOtpAttemptFailed(phone: string, issuedAt: Date, now = new Date()): Promise<boolean> {
  const challenge = await prisma.otpChallenge.findUnique({ where: { phone } });
  if (!challenge || challenge.challengeIssuedAt.getTime() !== issuedAt.getTime()) return false;

  if (challenge.verificationAttempts >= MAX_VERIFICATION_ATTEMPTS) {
    await prisma.otpChallenge.updateMany({
      where: {
        phone,
        challengeIssuedAt: issuedAt,
        verificationAttempts: { gte: MAX_VERIFICATION_ATTEMPTS },
        OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }],
      },
      data: { lockedUntil: new Date(now.getTime() + OTP_LOCKOUT_MS) },
    });
    return true;
  }

  return false;
}

export async function consumeOtpChallenge(phone: string, issuedAt: Date): Promise<void> {
  await prisma.otpChallenge.deleteMany({ where: { phone, challengeIssuedAt: issuedAt } });
}
