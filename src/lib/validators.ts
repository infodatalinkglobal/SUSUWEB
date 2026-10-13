import { z } from "zod";

export const GHANA_PHONE_REGEX = /^\+233[0-9]{9}$/;
export const OTP_REGEX = /^[0-9]{6}$/;
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Converts common Ghana input forms (024..., 24..., 23324..., +23324...) to
 * E.164. A number with a different explicit country code is rejected.
 */
export function normalizeGhanaPhone(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const digits = trimmed.replace(/[^0-9]/g, "");
  let nationalNumber = digits;

  if (trimmed.startsWith("+")) {
    if (!digits.startsWith("233")) return null;
    nationalNumber = digits.slice(3);
  } else if (digits.startsWith("233") && digits.length === 12) {
    nationalNumber = digits.slice(3);
  }

  if (nationalNumber.startsWith("0")) {
    nationalNumber = nationalNumber.slice(1);
  }

  const normalized = `+233${nationalNumber}`;
  return GHANA_PHONE_REGEX.test(normalized) ? normalized : null;
}

/** Format the text entered in the country-code-prefixed phone field. */
export function formatGhanaNationalNumber(input: string): string {
  const trimmed = input.trim();
  if (trimmed.startsWith("+") && !trimmed.startsWith("+233")) {
    return trimmed.slice(0, 18);
  }

  let digits = trimmed.replace(/[^0-9]/g, "");
  if (digits.startsWith("233") && digits.length > 9) {
    digits = digits.slice(3);
  }
  if (digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  return digits.slice(0, 9);
}

function isValidDateOnly(value: string): boolean {
  if (!DATE_ONLY_REGEX.test(value)) return false;
  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (year < 2000 || year > 2100) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

const moneyTextSchema = z
  .string()
  .trim()
  .regex(/^\d{1,8}(?:\.\d{1,2})?$/, "Enter a GHS amount with no more than two decimal places.")
  .refine((value) => {
    const [whole, fraction = ""] = value.split(".");
    return BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0")) >= BigInt(100);
  }, "The contribution must be at least GHS 1.00.");

export const sendOtpBodySchema = z.object({
  phone: z.string().trim().min(1).max(30),
});

export const verifyOtpBodySchema = z.object({
  phone: z.string().trim().min(1).max(30),
  code: z.string().regex(OTP_REGEX, "Enter the six-digit code."),
  termsAccepted: z.literal(true),
});

export const createGroupBodySchema = z
  .object({
    name: z.string().trim().min(2, "Enter a group name.").max(80, "Group names can be at most 80 characters."),
    type: z.enum(["COLLECTOR", "ROSCA"]),
    contributionAmount: moneyTextSchema,
    frequency: z.enum(["WEEKLY", "MONTHLY"]),
    startDate: z.string().refine(isValidDateOnly, "Choose a valid start date."),
    totalCycles: z.number().int().min(1).max(100),
  })
  .superRefine((data, context) => {
    if (data.type === "ROSCA" && data.totalCycles < 2) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["totalCycles"],
        message: "A ROSCA group needs at least two planned turns.",
      });
    }
  });

export const inviteMembersBodySchema = z.object({
  phones: z.string().trim().min(1, "Enter at least one phone number.").max(5000),
});

export const updateRotationBodySchema = z.object({
  members: z.array(z.object({
    memberId: z.string().trim().min(1).max(64),
    rotationOrder: z.number().int().min(1).max(100),
  })).min(1).max(100),
});

export const advanceCycleBodySchema = z.object({
  expectedCycle: z.number().int().min(1).max(100),
});

const recordMomoContributionSchema = z.object({
  method: z.literal("MOMO_MANUAL"),
  reference: z.string().trim().regex(/^[A-Za-z0-9]{6,64}$/, "Enter an alphanumeric MoMo reference with at least six characters."),
});

const recordCashContributionSchema = z.object({
  method: z.literal("CASH"),
  memberId: z.string().trim().min(1).max(64),
  note: z.string().trim().max(500).optional(),
});

export const recordContributionBodySchema = z.discriminatedUnion("method", [
  recordMomoContributionSchema,
  recordCashContributionSchema,
]);

export const contributionReviewBodySchema = z.object({
  note: z.string().trim().max(500).optional(),
});

export const rejectContributionBodySchema = z.object({
  note: z.string().trim().min(3, "Add a short reason for rejecting this reference.").max(500),
});

export const markMissedBodySchema = z.object({
  memberId: z.string().trim().min(1).max(64).optional(),
  note: z.string().trim().max(500).optional(),
});

export const initializePaystackBodySchema = z.object({
  groupId: z.string().trim().min(1).max(64),
  email: z.string().trim().email("Enter a valid email for the Paystack receipt.").max(254),
});

export const prepareRemindersBodySchema = z.object({
  memberIds: z.array(z.string().trim().min(1).max(64)).max(100).optional(),
});

export type SendOtpBody = z.infer<typeof sendOtpBodySchema>;
export type VerifyOtpBody = z.infer<typeof verifyOtpBodySchema>;
export type CreateGroupBody = z.infer<typeof createGroupBodySchema>;
