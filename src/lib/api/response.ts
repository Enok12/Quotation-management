import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "./errors";

// Consistent envelopes — every route returns one of these two shapes.
export type ApiSuccess<T> = { success: true; data: T };
export type ApiError = { success: false; message: string; errors?: unknown[] };

export function ok<T>(data: T, init?: number | ResponseInit) {
  const responseInit = typeof init === "number" ? { status: init } : init;
  return NextResponse.json<ApiSuccess<T>>({ success: true, data }, responseInit);
}

export function fail(message: string, status = 400, errors?: unknown[]) {
  return NextResponse.json<ApiError>({ success: false, message, errors }, { status });
}

// Wrap a route handler so business/validation errors map to clean envelopes
// instead of leaking stack traces. Keeps controllers thin.
export function handler<Args extends unknown[]>(
  fn: (...args: Args) => Promise<Response>,
) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof ZodError) {
        return fail("Validation failed", 422, err.issues);
      }
      if (err instanceof AppError) {
        return fail(err.message, err.status);
      }
      console.error("[unhandled]", err);
      return fail("Internal server error", 500);
    }
  };
}
