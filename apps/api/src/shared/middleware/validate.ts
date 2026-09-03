import type { FastifyReply, FastifyRequest } from "fastify";
import type { SafeParseReturnType } from "zod";
import { AppError } from "../errors/app-error";

export function validateBody<T>(schema: { safeParse: (data: unknown) => SafeParseReturnType<unknown, T> }) {
  return async (req: FastifyRequest, _reply: FastifyReply) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", "Invalid request body", 400, parsed.error.flatten());
    }
    (req as FastifyRequest & { body: T }).body = parsed.data;
  };
}
