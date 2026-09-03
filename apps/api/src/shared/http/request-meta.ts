import type { FastifyRequest } from "fastify";

export type RequestMeta = {
  ip?: string;
  userAgent?: string;
  deviceId?: string;
  platform?: string;
  country?: string;
  city?: string;
};

export function requestMeta(
  req: FastifyRequest,
  extra?: { deviceId?: string; platform?: string }
): RequestMeta {
  const ua = req.headers["user-agent"];
  const countryRaw = req.headers["cf-ipcountry"] ?? req.headers["x-app-country"];
  const cityRaw = req.headers["x-app-city"];
  const country = typeof countryRaw === "string" ? countryRaw.slice(0, 8).toUpperCase() : undefined;
  const city = typeof cityRaw === "string" ? cityRaw.slice(0, 80) : undefined;
  return {
    ip: req.ip,
    userAgent: typeof ua === "string" ? ua.slice(0, 400) : undefined,
    deviceId: extra?.deviceId,
    platform: extra?.platform,
    country: country && country !== "XX" ? country : undefined,
    city,
  };
}
