import type { FastifyReply, FastifyRequest } from "fastify";
import type {
  SignupInput,
  SigninInput,
  UpdateProfileInput,
  ChangePasswordInput,
  PasswordResetConsumeInput,
} from "@learning/shared-validation";
import { requestMeta } from "../../shared/http/request-meta";
import { authService } from "./auth.service";

export class AuthController {
  async signup(req: FastifyRequest<{ Body: SignupInput }>, reply: FastifyReply) {
    const data = await authService.signup(
      req.body,
      requestMeta(req, { deviceId: req.body.deviceId, platform: req.body.platform })
    );
    return reply.status(201).send({ data });
  }

  async signin(req: FastifyRequest<{ Body: SigninInput }>, reply: FastifyReply) {
    const data = await authService.signin(
      req.body,
      requestMeta(req, { deviceId: req.body.deviceId, platform: req.body.platform })
    );
    return reply.status(200).send({ data });
  }

  async me(req: FastifyRequest, reply: FastifyReply) {
    const data = await authService.me(req.user!.sub);
    return reply.send({ data });
  }

  async updateProfile(req: FastifyRequest<{ Body: UpdateProfileInput }>, reply: FastifyReply) {
    const data = await authService.updateProfile(req.user!.sub, req.body);
    return reply.send({ data });
  }

  async changePassword(req: FastifyRequest<{ Body: ChangePasswordInput }>, reply: FastifyReply) {
    const data = await authService.changePassword(req.user!.sub, req.body, requestMeta(req));
    return reply.send({ data });
  }

  async consumePasswordReset(
    req: FastifyRequest<{ Body: PasswordResetConsumeInput }>,
    reply: FastifyReply
  ) {
    const data = await authService.consumePasswordReset(req.body, requestMeta(req));
    return reply.send({ data });
  }

  async startMfa(req: FastifyRequest, reply: FastifyReply) {
    const data = await authService.startMfa(req.user!.sub);
    return reply.send({ data });
  }

  async enableMfa(req: FastifyRequest<{ Body: { code: string } }>, reply: FastifyReply) {
    const issueSession = req.user?.purpose === "enroll";
    const data = await authService.enableMfa(req.user!.sub, req.body.code, requestMeta(req), issueSession);
    return reply.send({ data });
  }

  async disableMfa(req: FastifyRequest<{ Body: { code: string } }>, reply: FastifyReply) {
    const data = await authService.disableMfa(req.user!.sub, req.body.code);
    return reply.send({ data });
  }

  async verifyMfa(req: FastifyRequest<{ Body: { code: string } }>, reply: FastifyReply) {
    const data = await authService.verifyMfa(req.user!.sub, req.body.code, requestMeta(req));
    return reply.send({ data });
  }

  async securityStatus(req: FastifyRequest, reply: FastifyReply) {
    const data = await authService.securityStatus(req.user!.sub);
    return reply.send({ data });
  }
}

export const authController = new AuthController();
