import type { FastifyInstance } from "fastify";
import {
  appSwitchSchema,
  createLiveTestSchema,
  deviceRegisterSchema,
  submitTestSchema,
} from "@learning/shared-validation";
import { z } from "zod";
import { authJwt, requireRole } from "../../shared/middleware/auth";
import { validateBody } from "../../shared/middleware/validate";
import { rateLimit } from "../../shared/middleware/rate-limit";
import { liveTestController } from "./live-test.controller";
import { deviceService } from "../devices/device.service";
import { fraudService } from "../fraud/fraud.service";

const cancelSchema = z.object({ reason: z.string().max(240).optional() });

export async function liveTestRoutes(app: FastifyInstance) {
  app.get("/api/v1/tests", { preHandler: [authJwt] }, (req, reply) =>
    liveTestController.listStudent(req, reply)
  );
  app.get("/api/v1/me/quiz-stats", { preHandler: [authJwt] }, (req, reply) =>
    liveTestController.quizStats(req, reply)
  );
  app.get("/api/v1/tests/:id", { preHandler: [authJwt] }, (req, reply) =>
    liveTestController.get(req as never, reply)
  );
  app.post(
    "/api/v1/tests/:id/join",
    {
      preHandler: [
        authJwt,
        rateLimit({
          windowMs: 60_000,
          max: 20,
          keyPrefix: "join",
          keyFn: (req) => req.user?.sub ?? req.ip,
        }),
      ],
    },
    (req, reply) => liveTestController.join(req as never, reply)
  );
  app.get("/api/v1/tests/:id/waiting-room", { preHandler: [authJwt] }, (req, reply) =>
    liveTestController.waitingRoom(req as never, reply)
  );
  app.get("/api/v1/tests/:id/session", { preHandler: [authJwt] }, (req, reply) =>
    liveTestController.session(req as never, reply)
  );
  const saveAnswerSchema = z.object({
    mcqId: z.string().min(1),
    selectedOption: z.union([z.enum(["A", "B", "C", "D"]), z.null()]),
    deviceId: z.string().min(1).max(120).optional(),
  });
  app.patch(
    "/api/v1/tests/:id/answers",
    { preHandler: [authJwt, validateBody(saveAnswerSchema)] },
    (req, reply) => liveTestController.saveAnswer(req as never, reply)
  );
  app.post(
    "/api/v1/tests/:id/submit",
    { preHandler: [authJwt, validateBody(submitTestSchema)] },
    (req, reply) => liveTestController.submit(req as never, reply)
  );
  app.get("/api/v1/tests/:id/result", { preHandler: [authJwt] }, (req, reply) =>
    liveTestController.result(req as never, reply)
  );
  app.post(
    "/api/v1/tests/app-switch",
    { preHandler: [authJwt, validateBody(appSwitchSchema)] },
    (req, reply) => liveTestController.appSwitch(req as never, reply)
  );

  app.post(
    "/api/v1/devices/register",
    { preHandler: [authJwt, validateBody(deviceRegisterSchema)] },
    async (req, reply) => {
      const body = req.body as { deviceId: string; platform?: string };
      const ua = req.headers["user-agent"];
      const data = await deviceService.upsert(req.user!.sub, body.deviceId, body.platform, {
        ip: req.ip,
        userAgent: typeof ua === "string" ? ua.slice(0, 400) : undefined,
      });
      return reply.send({ data });
    }
  );

  const testRoles = ["SUPER_ADMIN", "TEST_ADMIN"] as const;
  app.get(
    "/api/v1/admin/tests",
    { preHandler: [authJwt, requireRole(...testRoles, "READ_ONLY", "FINANCE_ADMIN")] },
    (req, reply) => liveTestController.listAdmin(req, reply)
  );
  app.post(
    "/api/v1/admin/tests",
    { preHandler: [authJwt, requireRole(...testRoles), validateBody(createLiveTestSchema)] },
    (req, reply) => liveTestController.create(req as never, reply)
  );
  app.post(
    "/api/v1/admin/tests/:id/cancel",
    { preHandler: [authJwt, requireRole(...testRoles), validateBody(cancelSchema)] },
    (req, reply) => liveTestController.cancel(req as never, reply)
  );
  app.post(
    "/api/v1/admin/tests/:id/declare-results",
    { preHandler: [authJwt, requireRole(...testRoles, "FINANCE_ADMIN")] },
    (req, reply) => liveTestController.declare(req as never, reply)
  );
  app.post(
    "/api/v1/admin/tests/:id/approve-awards",
    { preHandler: [authJwt, requireRole("SUPER_ADMIN", "FINANCE_ADMIN")] },
    (req, reply) => liveTestController.approveAwards(req as never, reply)
  );
  app.get(
    "/api/v1/admin/tests/:id/awards",
    { preHandler: [authJwt, requireRole(...testRoles, "FINANCE_ADMIN", "READ_ONLY")] },
    (req, reply) => liveTestController.awardReport(req as never, reply)
  );

  app.get(
    "/api/v1/admin/submissions/live",
    { preHandler: [authJwt, requireRole(...testRoles, "FINANCE_ADMIN", "READ_ONLY")] },
    (req, reply) => liveTestController.listSubmissions(req as never, reply)
  );
  app.get(
    "/api/v1/admin/submissions/live/:id",
    { preHandler: [authJwt, requireRole(...testRoles, "FINANCE_ADMIN", "READ_ONLY")] },
    (req, reply) => liveTestController.getSubmission(req as never, reply)
  );

  app.get(
    "/api/v1/admin/fraud-flags",
    {
      preHandler: [
        authJwt,
        requireRole("SUPER_ADMIN", "TEST_ADMIN", "FINANCE_ADMIN", "SUPPORT_ADMIN", "READ_ONLY"),
      ],
    },
    async (_req, reply) => reply.send({ data: await fraudService.list() })
  );
}
