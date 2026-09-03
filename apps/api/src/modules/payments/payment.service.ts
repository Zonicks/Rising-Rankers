import { randomUUID } from "crypto";
import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "../../infrastructure/database/prisma";
import { AppError } from "../../shared/errors/app-error";
import { walletService } from "../wallet/wallet.service";
import { env } from "../../config/env";

export class PaymentService {
  async createDeposit(userId: string, amount: number) {
    const idempotencyKey = `deposit:${userId}:${amount}:${randomUUID()}`;
    const payment = await prisma.payment.create({
      data: {
        userId,
        amount: new Decimal(amount),
        status: "PENDING",
        provider: "sandbox",
        providerRef: `sandbox_${randomUUID()}`,
        idempotencyKey,
      },
    });

    return {
      paymentId: payment.id,
      providerRef: payment.providerRef,
      amount: payment.amount.toString(),
      status: payment.status,
      // Sandbox checkout — client calls confirm endpoint
      sandboxConfirmPath: `/api/v1/payments/sandbox/confirm`,
      message: "Sandbox payment created. Confirm success/failure to credit wallet.",
    };
  }

  async confirmSandbox(paymentId: string, status: "SUCCESSFUL" | "FAILED") {
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new AppError("NOT_FOUND", "Payment not found", 404);
    if (!payment.providerRef) throw new AppError("INVALID_PAYMENT", "Missing provider ref", 400);
    return this.applyWebhook({
      providerRef: payment.providerRef,
      status,
    });
  }

  async applyWebhook(input: {
    providerRef: string;
    status: "SUCCESSFUL" | "FAILED";
    signature?: string;
  }) {
    // Real gateways: verify signature with PAYMENT_WEBHOOK_SECRET
    if (input.signature && env.JWT_SECRET && input.signature === "invalid") {
      throw new AppError("INVALID_SIGNATURE", "Webhook signature invalid", 401);
    }

    const payment = await prisma.payment.findUnique({
      where: { providerRef: input.providerRef },
    });
    if (!payment) throw new AppError("NOT_FOUND", "Payment not found", 404);

    if (payment.status === "SUCCESSFUL" || payment.status === "FAILED") {
      const balances = await walletService.getBalances(payment.userId);
      return {
        paymentId: payment.id,
        status: payment.status,
        alreadyProcessed: true,
        balances,
      };
    }

    if (input.status === "FAILED") {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: "FAILED" },
      });
      return {
        paymentId: payment.id,
        status: "FAILED" as const,
        alreadyProcessed: false,
        balances: await walletService.getBalances(payment.userId),
      };
    }

    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "SUCCESSFUL" },
    });

    const balances = await walletService.credit({
      userId: payment.userId,
      amount: Number(payment.amount),
      bucket: "deposited",
      type: "DEPOSIT",
      idempotencyKey: `pay:${payment.id}`,
      reference: payment.providerRef ?? payment.id,
    });

    return {
      paymentId: payment.id,
      status: "SUCCESSFUL" as const,
      alreadyProcessed: false,
      balances,
    };
  }
}

export const paymentService = new PaymentService();
