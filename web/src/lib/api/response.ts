import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "AUTH_REQUIRED"
  | "CONFIG_MISSING"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "QUEST_NOT_FOUND"
  | "QUEST_DAY_NOT_FOUND"
  | "QUEST_DAY_LOCKED"
  | "MISSION_NOT_FOUND"
  | "AI_UNAVAILABLE"
  | "AI_INVALID_RESPONSE"
  | "SERVER_ERROR";

export class ApiError extends Error {
  constructor(
    public code: ApiErrorCode,
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export function ok<T>(data: T, meta?: Record<string, unknown>) {
  return NextResponse.json({
    success: true,
    data,
    ...(meta ? { meta } : {}),
  });
}

export function fail(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          status: error.status,
        },
      },
      { status: error.status },
    );
  }

  let message = "Unexpected error";
  if (error instanceof Error) {
    message = error.message;
  } else if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    message = error.message;
  } else if (typeof error === "string") {
    message = error;
  }

  return NextResponse.json(
    {
      success: false,
      error: {
        code: "SERVER_ERROR",
        message,
        status: 500,
      },
    },
    { status: 500 },
  );
}
