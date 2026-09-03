import type { FastifyReply, FastifyRequest } from "fastify";
import type { AccountStatus } from "@learning/shared-types";
import type {
  AdminBulkExportInput,
  AdminIncidentInput,
  AdminParentalConsentInput,
  AdminRightsCreateInput,
  AdminRightsEraseInput,
  AdminRightsExportInput,
  AdminStaffCreateInput,
  AdminStaffUpdateInput,
  AdminTicketNoteInput,
  AdminUserCorrectInput,
  AdminUserTicketInput,
} from "@learning/shared-validation";
import { adminStaffService } from "./admin-staff.service";
import { adminUsersRightsService } from "./admin-users-rights.service";
import { adminUsersService } from "./admin-users.service";

export class AdminUsersController {
  async list(
    req: FastifyRequest<{
      Querystring: { q?: string; status?: AccountStatus; cursor?: string; take?: string };
    }>,
    reply: FastifyReply
  ) {
    const take = req.query.take ? Number(req.query.take) : undefined;
    const data = await adminUsersService.list({
      q: req.query.q,
      status: req.query.status,
      cursor: req.query.cursor,
      take: Number.isFinite(take) ? take : undefined,
    });
    return reply.send({ data });
  }

  async get(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const data = await adminUsersService.get(req.params.id, req.user!.role);
    return reply.send({ data });
  }

  async reveal(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const data = await adminUsersService.reveal(
      req.params.id,
      { id: req.user!.sub, role: req.user!.role },
      req.ip
    );
    return reply.send({ data });
  }

  async setStatus(
    req: FastifyRequest<{
      Params: { id: string };
      Body: { status: AccountStatus; reason: string; notify?: boolean };
    }>,
    reply: FastifyReply
  ) {
    const data = await adminUsersService.setStatus(
      req.params.id,
      req.body,
      { id: req.user!.sub, role: req.user!.role },
      req.ip
    );
    return reply.send({ data });
  }

  async createTicket(
    req: FastifyRequest<{
      Params: { id: string };
      Body: AdminUserTicketInput;
    }>,
    reply: FastifyReply
  ) {
    const data = await adminUsersService.createTicket(
      req.params.id,
      req.body,
      { id: req.user!.sub, role: req.user!.role },
      req.ip
    );
    return reply.status(201).send({ data });
  }

  async addTicketNote(
    req: FastifyRequest<{
      Params: { id: string; ticketId: string };
      Body: AdminTicketNoteInput;
    }>,
    reply: FastifyReply
  ) {
    const data = await adminUsersService.addTicketNote(
      req.params.id,
      req.params.ticketId,
      req.body,
      { id: req.user!.sub, role: req.user!.role },
      req.ip
    );
    return reply.status(201).send({ data });
  }

  async issuePasswordReset(
    req: FastifyRequest<{ Params: { id: string }; Body: { reason: string } }>,
    reply: FastifyReply
  ) {
    const data = await adminUsersService.issuePasswordReset(
      req.params.id,
      req.body,
      { id: req.user!.sub, role: req.user!.role },
      req.ip
    );
    return reply.send({ data });
  }

  async revokeSessions(
    req: FastifyRequest<{
      Params: { id: string };
      Body: { deviceId?: string; reason: string };
    }>,
    reply: FastifyReply
  ) {
    const data = await adminUsersService.revokeSessions(
      req.params.id,
      req.body,
      { id: req.user!.sub, role: req.user!.role },
      req.ip
    );
    return reply.send({ data });
  }

  async listRights(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const data = await adminUsersRightsService.list(req.params.id);
    return reply.send({ data });
  }

  async correctProfile(
    req: FastifyRequest<{ Params: { id: string }; Body: AdminUserCorrectInput }>,
    reply: FastifyReply
  ) {
    const data = await adminUsersRightsService.correct(
      req.params.id,
      req.body,
      { id: req.user!.sub, role: req.user!.role },
      req.ip
    );
    return reply.send({ data });
  }

  async createRight(
    req: FastifyRequest<{ Params: { id: string }; Body: AdminRightsCreateInput }>,
    reply: FastifyReply
  ) {
    const data = await adminUsersRightsService.create(
      req.params.id,
      req.body,
      { id: req.user!.sub, role: req.user!.role },
      req.ip
    );
    return reply.status(201).send({ data });
  }

  async exportRight(
    req: FastifyRequest<{ Params: { id: string; rid: string }; Body: AdminRightsExportInput }>,
    reply: FastifyReply
  ) {
    const data = await adminUsersRightsService.exportPack(
      req.params.id,
      req.params.rid,
      req.body,
      { id: req.user!.sub, role: req.user!.role },
      req.ip
    );
    return reply.send({ data });
  }

  async eraseRight(
    req: FastifyRequest<{ Params: { id: string; rid: string }; Body: AdminRightsEraseInput }>,
    reply: FastifyReply
  ) {
    const data = await adminUsersRightsService.erase(
      req.params.id,
      req.params.rid,
      req.body,
      { id: req.user!.sub, role: req.user!.role },
      req.ip
    );
    return reply.send({ data });
  }

  async exportDirectory(
    req: FastifyRequest<{ Body: AdminBulkExportInput }>,
    reply: FastifyReply
  ) {
    const data = await adminUsersService.exportDirectory(
      req.body,
      { id: req.user!.sub, role: req.user!.role },
      req.ip
    );
    return reply.send({ data });
  }

  async parentalConsent(
    req: FastifyRequest<{ Params: { id: string }; Body: AdminParentalConsentInput }>,
    reply: FastifyReply
  ) {
    const data = await adminUsersService.recordParentalConsent(
      req.params.id,
      req.body,
      { id: req.user!.sub, role: req.user!.role },
      req.ip
    );
    return reply.send({ data });
  }

  async logIncident(req: FastifyRequest<{ Body: AdminIncidentInput }>, reply: FastifyReply) {
    const data = await adminUsersService.logIncident(
      req.body,
      { id: req.user!.sub, role: req.user!.role },
      req.ip
    );
    return reply.send({ data });
  }

  async listStaff(_req: FastifyRequest, reply: FastifyReply) {
    const data = await adminStaffService.list();
    return reply.send({ data });
  }

  async createStaff(req: FastifyRequest<{ Body: AdminStaffCreateInput }>, reply: FastifyReply) {
    const data = await adminStaffService.create(req.body, { id: req.user!.sub }, req.ip);
    return reply.status(201).send({ data });
  }

  async updateStaff(
    req: FastifyRequest<{ Params: { id: string }; Body: AdminStaffUpdateInput }>,
    reply: FastifyReply
  ) {
    const data = await adminStaffService.update(
      req.params.id,
      req.body,
      { id: req.user!.sub },
      req.ip
    );
    return reply.send({ data });
  }
}

export const adminUsersController = new AdminUsersController();
