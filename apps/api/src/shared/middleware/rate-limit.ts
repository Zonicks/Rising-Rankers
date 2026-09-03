import type { FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../errors/app-error";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function rateLimit(options: {
  windowMs: number;
  max: number;
  keyPrefix: string;
  keyFn?: (req: FastifyRequest) => string;
}) {
  return async (req: FastifyRequest, _reply: FastifyReply) => {
    const id = options.keyFn?.(req) ?? req.ip;
    const key = `${options.keyPrefix}:${id}`;
    const now = Date.now();
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      return;
    }

    current.count += 1;
    if (current.count > options.max) {
      throw new AppError(
        "RATE_LIMITED",
        "Too many requests. Please try again shortly.",
        429,
        { retryAt: new Date(current.resetAt).toISOString() }
      );
    }
  };
}
