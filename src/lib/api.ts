import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireAuth, UnauthorizedError } from "@/lib/session";

export async function requireApiUser(): Promise<
  { userId: string; phone: string } | NextResponse<{ error: string }>
> {
  try {
    return await requireAuth();
  } catch (error: unknown) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    return NextResponse.json({ error: "Authentication is temporarily unavailable." }, { status: 503 });
  }
}

export function apiErrorResponse(error: unknown, fallback = "The request could not be completed."): NextResponse {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return NextResponse.json({ error: "This action conflicts with an existing record." }, { status: 409 });
    }
    if (error.code === "P2025") {
      return NextResponse.json({ error: "The requested record was not found." }, { status: 404 });
    }
  }
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export function notFoundResponse(message = "The requested item was not found."): NextResponse {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function forbiddenResponse(message = "You do not have permission to perform this action."): NextResponse {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function conflictResponse(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 409 });
}
