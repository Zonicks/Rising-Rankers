import type { FastifyReply, FastifyRequest } from "fastify";
import { liveTestService } from "./live-test.service";
import { auditService } from "../audit/audit.service";

export class LiveTestController {
  async create(req: FastifyRequest<{ Body: Record<string, unknown> }>, reply: FastifyReply) {
    const data = await liveTestService.create(req.body as never);
    return reply.status(201).send({ data });
  }

  async listStudent(req: FastifyRequest, reply: FastifyReply) {
    const data = await liveTestService.catalog(req.user!.sub);
    return reply.send({ data });
  }

  async listAdmin(_req: FastifyRequest, reply: FastifyReply) {
    const data = await liveTestService.listForAdmin();
    return reply.send({ data });
  }

  async get(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const data = await liveTestService.toPublicTest(req.params.id);
    return reply.send({ data });
  }

  async join(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const data = await liveTestService.join(req.user!.sub, req.params.id);
    return reply.send({ data });
  }

  async waitingRoom(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const data = await liveTestService.waitingRoom(req.user!.sub, req.params.id);
    return reply.send({ data });
  }

  async session(req: FastifyRequest<{ Params: { id: string }; Querystring: { deviceId?: string } }>, reply: FastifyReply) {
    const deviceId =
      (req.query?.deviceId as string | undefined) ||
      (req.headers["x-device-id"] as string | undefined);
    const data = await liveTestService.getSession(req.user!.sub, req.params.id, deviceId);
    return reply.send({ data });
  }

  async appSwitch(
    req: FastifyRequest<{ Body: { testId: string; deviceId?: string } }>,
    reply: FastifyReply
  ) {
    const data = await liveTestService.recordAppSwitch(
      req.user!.sub,
      req.body.testId,
      req.body.deviceId
    );
    return reply.send({ data });
  }

  async saveAnswer(
    req: FastifyRequest<{
      Params: { id: string };
      Body: { mcqId: string; selectedOption?: string | null; deviceId?: string };
    }>,
    reply: FastifyReply
  ) {
    const data = await liveTestService.saveAnswer(
      req.user!.sub,
      req.params.id,
      req.body.mcqId,
      req.body.selectedOption ?? null,
      req.body.deviceId
    );
    return reply.send({ data });
  }

  async submit(
    req: FastifyRequest<{
      Params: { id: string };
      Body: {
        answers: Array<{ mcqId: string; selectedOption?: string | null }>;
        autoSubmit?: boolean;
        deviceId?: string;
        appSwitchCount?: number;
      };
    }>,
    reply: FastifyReply
  ) {
    const data = await liveTestService.submit(
      req.user!.sub,
      req.params.id,
      req.body.answers ?? [],
      req.body.autoSubmit,
      { deviceId: req.body.deviceId, appSwitchCount: req.body.appSwitchCount }
    );
    return reply.send({ data });
  }

  async result(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const data = await liveTestService.getResult(req.user!.sub, req.params.id);
    return reply.send({ data });
  }

  async quizStats(req: FastifyRequest, reply: FastifyReply) {
    const data = await liveTestService.quizStats(req.user!.sub);
    return reply.send({ data });
  }

  async cancel(req: FastifyRequest<{ Params: { id: string }; Body: { reason?: string } }>, reply: FastifyReply) {
    const data = await liveTestService.cancel(req.params.id, req.body?.reason);
    return reply.send({ data });
  }

  async declare(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const data = await liveTestService.declareResults(req.params.id);
    await auditService.log({
      actorUserId: req.user!.sub,
      action: "RESULTS_DECLARED",
      entityType: "LiveTest",
      entityId: req.params.id,
      ip: req.ip,
      meta: data,
    });
    return reply.send({ data });
  }

  async approveAwards(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const data = await liveTestService.approveAwards(req.params.id);
    await auditService.log({
      actorUserId: req.user!.sub,
      action: "AWARDS_APPROVED",
      entityType: "LiveTest",
      entityId: req.params.id,
      ip: req.ip,
      meta: data,
    });
    return reply.send({ data });
  }

  async awardReport(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const data = await liveTestService.awardReport(req.params.id);
    return reply.send({ data });
  }

  async listSubmissions(
    req: FastifyRequest<{ Querystring: { testId?: string } }>,
    reply: FastifyReply
  ) {
    const data = await liveTestService.listSubmissions({ testId: req.query.testId });
    return reply.send({ data });
  }

  async getSubmission(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const data = await liveTestService.getSubmission(req.params.id);
    return reply.send({ data });
  }
}

export const liveTestController = new LiveTestController();
