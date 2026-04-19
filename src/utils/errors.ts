import { ZodError } from "zod";

type PgLikeError = Error & {
  code?: string;
  detail?: string;
};

export function toHttpError(error: unknown): { status: number; message: string } {
  if (error instanceof ZodError) {
    const message = error.issues.map((issue) => issue.message).join("; ");
    return { status: 400, message };
  }

  if (error instanceof Error) {
    const pgError = error as PgLikeError;

    if (pgError.code === "40001") {
      return {
        status: 409,
        message: "Serialization conflict. Retry the request.",
      };
    }

    if (pgError.code === "23514" || pgError.code === "23503") {
      return {
        status: 400,
        message: pgError.message,
      };
    }

    return {
      status: 400,
      message: pgError.detail || pgError.message,
    };
  }

  return { status: 500, message: "Unexpected server error" };
}
