import type { FastifyInstance } from "fastify";
import {
  adminBulkExportSchema,
  adminIncidentSchema,
  adminParentalConsentSchema,
  adminPasswordResetSchema,
  adminRevokeSessionsSchema,
  adminRightsCreateSchema,
  adminRightsEraseSchema,
  adminRightsExportSchema,
  adminStaffCreateSchema,
  adminStaffUpdateSchema,
  adminTicketNoteSchema,
  adminUserCorrectSchema,
  adminUserStatusSchema,
  adminUserTicketSchema,
} from "@learning/shared-validation";
import { authJwt, requireRole } from "../../shared/middleware/auth";
import { rateLimit } from "../../shared/middleware/rate-limit";
import { validateBody } from "../../shared/middleware/validate";
import { ADMIN_USER_VIEW_ROLES } from "./admin-users.policy";
import { adminUsersController } from "./admin-users.controller";

export async function adminUsersRoutes(app: FastifyInstance) {
  const privilegedLimit = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 20,
    keyPrefix: "admin-priv",
    keyFn: (req) => req.user?.sub ?? req.ip,
  });
  app.get(
    "/api/v1/admin/users",
    { preHandler: [authJwt, requireRole(...ADMIN_USER_VIEW_ROLES)] },
    (req, reply) => adminUsersController.list(req as never, reply)
  );
  app.get(
    "/api/v1/admin/users/:id",
    { preHandler: [authJwt, requireRole(...ADMIN_USER_VIEW_ROLES)] },
    (req, reply) => adminUsersController.get(req as never, reply)
  );
  app.post(
    "/api/v1/admin/users/:id/reveal",
    {
      preHandler: [
        authJwt,
        requireRole("SUPER_ADMIN", "SUPPORT_ADMIN", "FINANCE_ADMIN"),
        privilegedLimit,
      ],
    },
    (req, reply) => adminUsersController.reveal(req as never, reply)
  );
  app.post(
    "/api/v1/admin/users/:id/status",
    {
      preHandler: [
        authJwt,
        requireRole("SUPER_ADMIN", "SUPPORT_ADMIN", "FINANCE_ADMIN"),
        validateBody(adminUserStatusSchema),
      ],
    },
    (req, reply) => adminUsersController.setStatus(req as never, reply)
  );
  app.post(
    "/api/v1/admin/users/:id/sessions/revoke",
    {
      preHandler: [
        authJwt,
        requireRole("SUPER_ADMIN", "SUPPORT_ADMIN"),
        validateBody(adminRevokeSessionsSchema),
      ],
    },
    (req, reply) => adminUsersController.revokeSessions(req as never, reply)
  );
  app.post(
    "/api/v1/admin/users/:id/tickets",
    {
      preHandler: [
        authJwt,
        requireRole("SUPER_ADMIN", "SUPPORT_ADMIN"),
        validateBody(adminUserTicketSchema),
      ],
    },
    (req, reply) => adminUsersController.createTicket(req as never, reply)
  );
  app.post(
    "/api/v1/admin/users/:id/tickets/:ticketId/notes",
    {
      preHandler: [
        authJwt,
        requireRole("SUPER_ADMIN", "SUPPORT_ADMIN"),
        validateBody(adminTicketNoteSchema),
      ],
    },
    (req, reply) => adminUsersController.addTicketNote(req as never, reply)
  );
  app.post(
    "/api/v1/admin/users/:id/password-reset",
    {
      preHandler: [
        authJwt,
        requireRole("SUPER_ADMIN", "SUPPORT_ADMIN"),
        validateBody(adminPasswordResetSchema),
      ],
    },
    (req, reply) => adminUsersController.issuePasswordReset(req as never, reply)
  );
  app.get(
    "/api/v1/admin/users/:id/rights",
    { preHandler: [authJwt, requireRole(...ADMIN_USER_VIEW_ROLES)] },
    (req, reply) => adminUsersController.listRights(req as never, reply)
  );
  app.patch(
    "/api/v1/admin/users/:id/profile",
    {
      preHandler: [
        authJwt,
        requireRole("SUPER_ADMIN", "SUPPORT_ADMIN"),
        validateBody(adminUserCorrectSchema),
      ],
    },
    (req, reply) => adminUsersController.correctProfile(req as never, reply)
  );
  app.post(
    "/api/v1/admin/users/:id/rights",
    {
      preHandler: [
        authJwt,
        requireRole("SUPER_ADMIN", "SUPPORT_ADMIN", "FINANCE_ADMIN"),
        validateBody(adminRightsCreateSchema),
      ],
    },
    (req, reply) => adminUsersController.createRight(req as never, reply)
  );
  app.post(
    "/api/v1/admin/users/:id/rights/:rid/export",
    {
      preHandler: [
        authJwt,
        requireRole("SUPER_ADMIN", "SUPPORT_ADMIN", "FINANCE_ADMIN"),
        privilegedLimit,
        validateBody(adminRightsExportSchema),
      ],
    },
    (req, reply) => adminUsersController.exportRight(req as never, reply)
  );
  app.post(
    "/api/v1/admin/users/:id/rights/:rid/erase",
    {
      preHandler: [
        authJwt,
        requireRole("SUPER_ADMIN"),
        validateBody(adminRightsEraseSchema),
      ],
    },
    (req, reply) => adminUsersController.eraseRight(req as never, reply)
  );
  app.post(
    "/api/v1/admin/users/export",
    {
      preHandler: [authJwt, requireRole("SUPER_ADMIN"), validateBody(adminBulkExportSchema)],
    },
    (req, reply) => adminUsersController.exportDirectory(req as never, reply)
  );
  app.post(
    "/api/v1/admin/users/:id/parental-consent",
    {
      preHandler: [
        authJwt,
        requireRole("SUPER_ADMIN", "SUPPORT_ADMIN"),
        validateBody(adminParentalConsentSchema),
      ],
    },
    (req, reply) => adminUsersController.parentalConsent(req as never, reply)
  );
  app.post(
    "/api/v1/admin/incidents",
    {
      preHandler: [authJwt, requireRole("SUPER_ADMIN"), validateBody(adminIncidentSchema)],
    },
    (req, reply) => adminUsersController.logIncident(req as never, reply)
  );
  app.get(
    "/api/v1/admin/staff",
    { preHandler: [authJwt, requireRole("SUPER_ADMIN")] },
    (req, reply) => adminUsersController.listStaff(req, reply)
  );
  app.post(
    "/api/v1/admin/staff",
    {
      preHandler: [authJwt, requireRole("SUPER_ADMIN"), validateBody(adminStaffCreateSchema)],
    },
    (req, reply) => adminUsersController.createStaff(req as never, reply)
  );
  app.patch(
    "/api/v1/admin/staff/:id",
    {
      preHandler: [authJwt, requireRole("SUPER_ADMIN"), validateBody(adminStaffUpdateSchema)],
    },
    (req, reply) => adminUsersController.updateStaff(req as never, reply)
  );
}
