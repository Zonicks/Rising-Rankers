import type { FastifyInstance } from "fastify";
import { supportTicketSchema, supportTicketStatusSchema } from "@learning/shared-validation";
import { prisma } from "../../infrastructure/database/prisma";
import { authJwt, requireRole } from "../../shared/middleware/auth";
import { validateBody } from "../../shared/middleware/validate";
import { AppError } from "../../shared/errors/app-error";

export async function supportRoutes(app: FastifyInstance) {
  app.post(
    "/api/v1/support/tickets",
    { preHandler: [authJwt, validateBody(supportTicketSchema)] },
    async (req, reply) => {
      const body = req.body as { category: string; subject: string; message: string };
      const ticket = await prisma.supportTicket.create({
        data: {
          userId: req.user!.sub,
          category: body.category,
          subject: body.subject,
          message: body.message,
        },
      });
      if (body.category === "Privacy") {
        await prisma.dataRightsRequest.create({
          data: {
            userId: req.user!.sub,
            type: "GRIEVANCE",
            status: "OPEN",
            reason: body.message,
            dueAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
            payload: { ticketId: ticket.id },
          },
        });
      }
      return reply.status(201).send({
        data: {
          id: ticket.id,
          status: ticket.status,
          category: ticket.category,
          subject: ticket.subject,
        },
      });
    }
  );

  app.get("/api/v1/support/tickets/me", { preHandler: [authJwt] }, async (req, reply) => {
    const rows = await prisma.supportTicket.findMany({
      where: { userId: req.user!.sub },
      orderBy: { createdAt: "desc" },
    });
    return reply.send({ data: rows });
  });

  app.get(
    "/api/v1/admin/support/tickets",
    { preHandler: [authJwt, requireRole("SUPER_ADMIN", "SUPPORT_ADMIN", "READ_ONLY")] },
    async (_req, reply) => {
      const rows = await prisma.supportTicket.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
        include: { user: { select: { id: true, email: true, fullName: true } } },
      });
      return reply.send({ data: rows });
    }
  );

  app.patch(
    "/api/v1/admin/support/tickets/:id",
    {
      preHandler: [
        authJwt,
        requireRole("SUPER_ADMIN", "SUPPORT_ADMIN"),
        validateBody(supportTicketStatusSchema),
      ],
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const { status } = req.body as { status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED" };
      const existing = await prisma.supportTicket.findUnique({ where: { id } });
      if (!existing) throw new AppError("NOT_FOUND", "Ticket not found", 404);
      const ticket = await prisma.supportTicket.update({
        where: { id },
        data: { status },
        include: { user: { select: { id: true, email: true, fullName: true } } },
      });
      return reply.send({ data: ticket });
    }
  );
}
