import { normalizeGhanaPhone } from "@/lib/validators";

export function buildWhatsAppUrl(phone: string, message: string): string {
  const normalizedPhone = normalizeGhanaPhone(phone);
  if (!normalizedPhone) throw new Error("A valid Ghana phone number is required for WhatsApp.");
  const number = normalizedPhone.slice(1);
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
