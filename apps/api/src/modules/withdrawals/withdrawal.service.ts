import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "../../infrastructure/database/prisma";
import { AppError } from "../../shared/errors/app-error";

const MIN_WITHDRAWAL = 100;

export class WithdrawalService {
  async request(userId: string, amount: number, method: string, destination: string) {
    if (amount < MIN_WITHDRAWAL) {
      throw new AppError("MIN_WITHDRAWAL", `Minimum withdrawal is ₹${MIN_WITHDRAWAL}`, 400);
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { wallet: true, profile: true },
    });
    if (!user?.wallet) throw new AppError("WALLET_NOT_FOUND", "Wallet not found", 404);
    if (user.status === "WITHDRAWAL_RESTRICTED" || user.status === "BLOCKED") {
      throw new AppError("WITHDRAWAL_BLOCKED", "Withdrawals are restricted for this account", 403);
    }
    if (!user.email) {
      throw new AppError("EMAIL_REQUIRED", "Email required before withdrawal", 400);
    }
    if (Number(user.wallet.awardBalance) < amount) {
      throw new AppError("INSUFFICIENT_AWARD", "Insufficient award balance", 400);
    }

    // Hold funds: move from award to pending via ledger debit style
    const before = user.wallet.awardBalance;
    const after = before.sub(new Decimal(amount));
    const withdrawal = await prisma.$transaction(async (tx) => {
      await tx.wallet.update({
        where: { userId },
        data: { awardBalance: after },
      });
      await tx.walletLedger.create({
        data: {
          userId,
          type: "WITHDRAWAL",
          amount: new Decimal(amount),
          balanceBefore: before,
          balanceAfter: after,
          balanceBucket: "award",
          status: "PENDING",
          idempotencyKey: `wd-hold:${userId}:${Date.now()}`,
          reference: destination,
        },
      });
      return tx.withdrawal.create({
        data: {
          userId,
          amount: new Decimal(amount),
          method,
          destination,
          status: "PENDING",
        },
      });
    });

    return {
      id: withdrawal.id,
      amount: withdrawal.amount.toString(),
      status: withdrawal.status,
      method: withdrawal.method,
      destination: withdrawal.destination,
    };
  }

  async myList(userId: string) {
    const rows = await prisma.withdrawal.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((w) => ({
      id: w.id,
      amount: w.amount.toString(),
      status: w.status,
      method: w.method,
      destination: w.destination,
      rejectReason: w.rejectReason,
      createdAt: w.createdAt.toISOString(),
    }));
  }

  async adminList() {
    const rows = await prisma.withdrawal.findMany({
      orderBy: { createdAt: "desc" },
      include: { user: { select: { id: true, email: true, fullName: true } } },
      take: 100,
    });
    return rows.map((w) => ({
      id: w.id,
      amount: w.amount.toString(),
      status: w.status,
      method: w.method,
      destination: w.destination,
      rejectReason: w.rejectReason,
      createdAt: w.createdAt.toISOString(),
      user: w.user,
    }));
  }

  async review(id: string, action: "APPROVE" | "REJECT", rejectReason?: string) {
    const row = await prisma.withdrawal.findUnique({ where: { id } });
    if (!row) throw new AppError("NOT_FOUND", "Withdrawal not found", 404);
    if (row.status !== "PENDING" && row.status !== "UNDER_REVIEW") {
      throw new AppError("INVALID_STATE", "Withdrawal already processed", 400);
    }

    if (action === "REJECT") {
      // refund award balance
      const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: row.userId } });
      const before = wallet.awardBalance;
      const after = before.add(row.amount);
      await prisma.$transaction([
        prisma.wallet.update({ where: { userId: row.userId }, data: { awardBalance: after } }),
        prisma.walletLedger.create({
          data: {
            userId: row.userId,
            type: "REFUND",
            amount: row.amount,
            balanceBefore: before,
            balanceAfter: after,
            balanceBucket: "award",
            status: "REFUNDED",
            idempotencyKey: `wd-reject:${row.id}`,
            reference: row.id,
          },
        }),
        prisma.withdrawal.update({
          where: { id },
          data: {
            status: "REJECTED",
            rejectReason: rejectReason ?? "Rejected by finance",
            processedAt: new Date(),
          },
        }),
      ]);
      return { id, status: "REJECTED" };
    }

    await prisma.withdrawal.update({
      where: { id },
      data: { status: "SUCCESSFUL", processedAt: new Date() },
    });
    await prisma.walletLedger.updateMany({
      where: { reference: row.destination, type: "WITHDRAWAL", status: "PENDING" },
      data: { status: "SUCCESSFUL" },
    });
    return { id, status: "SUCCESSFUL" };
  }
}

export const withdrawalService = new WithdrawalService();
