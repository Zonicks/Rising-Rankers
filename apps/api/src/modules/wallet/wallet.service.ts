import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "../../infrastructure/database/prisma";
import { AppError } from "../../shared/errors/app-error";

type Bucket = "deposited" | "award" | "promo";

function bucketField(bucket: Bucket) {
  if (bucket === "award") return "awardBalance" as const;
  if (bucket === "promo") return "promoBalance" as const;
  return "depositedBalance" as const;
}

export class WalletService {
  async getBalances(userId: string) {
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new AppError("WALLET_NOT_FOUND", "Wallet not found", 404);
    return {
      deposited: wallet.depositedBalance.toString(),
      award: wallet.awardBalance.toString(),
      promo: wallet.promoBalance.toString(),
    };
  }

  async getLedger(userId: string, take = 50) {
    const rows = await prisma.walletLedger.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take,
    });
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      amount: r.amount.toString(),
      balanceBefore: r.balanceBefore.toString(),
      balanceAfter: r.balanceAfter.toString(),
      balanceBucket: r.balanceBucket,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      reference: r.reference,
    }));
  }

  async credit(params: {
    userId: string;
    amount: number;
    bucket?: Bucket;
    type?: "DEPOSIT" | "ADMIN_ADJUSTMENT" | "AWARD_CREDIT" | "REFUND";
    idempotencyKey?: string;
    reference?: string;
    note?: string;
  }) {
    const bucket = params.bucket ?? "deposited";
    const field = bucketField(bucket);
    const amount = new Decimal(params.amount);

    if (params.idempotencyKey) {
      const existing = await prisma.walletLedger.findUnique({
        where: { idempotencyKey: params.idempotencyKey },
      });
      if (existing) {
        return this.getBalances(params.userId);
      }
    }

    return prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { userId: params.userId } });
      if (!wallet) throw new AppError("WALLET_NOT_FOUND", "Wallet not found", 404);
      const before = wallet[field];
      const after = before.add(amount);
      await tx.wallet.update({
        where: { userId: params.userId },
        data: { [field]: after },
      });
      await tx.walletLedger.create({
        data: {
          userId: params.userId,
          type: params.type ?? "ADMIN_ADJUSTMENT",
          amount,
          balanceBefore: before,
          balanceAfter: after,
          balanceBucket: bucket,
          idempotencyKey: params.idempotencyKey,
          reference: params.reference,
          meta: params.note ? { note: params.note } : undefined,
        },
      });
      return {
        deposited: (field === "depositedBalance" ? after : wallet.depositedBalance).toString(),
        award: (field === "awardBalance" ? after : wallet.awardBalance).toString(),
        promo: (field === "promoBalance" ? after : wallet.promoBalance).toString(),
      };
    });
  }

  async debitDeposited(params: {
    userId: string;
    amount: number;
    type: "FLASH_UNLOCK" | "MCQ_UNLOCK" | "TEST_ENTRY" | "BOOK_UNLOCK";
    idempotencyKey?: string;
    reference?: string;
  }) {
    const amount = new Decimal(params.amount);
    if (params.idempotencyKey) {
      const existing = await prisma.walletLedger.findUnique({
        where: { idempotencyKey: params.idempotencyKey },
      });
      if (existing) return this.getBalances(params.userId);
    }

    return prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { userId: params.userId } });
      if (!wallet) throw new AppError("WALLET_NOT_FOUND", "Wallet not found", 404);
      if (wallet.depositedBalance.lt(amount)) {
        throw new AppError("WALLET_INSUFFICIENT", "Insufficient deposited balance", 400);
      }
      const before = wallet.depositedBalance;
      const after = before.sub(amount);
      await tx.wallet.update({
        where: { userId: params.userId },
        data: { depositedBalance: after },
      });
      await tx.walletLedger.create({
        data: {
          userId: params.userId,
          type: params.type,
          amount,
          balanceBefore: before,
          balanceAfter: after,
          balanceBucket: "deposited",
          idempotencyKey: params.idempotencyKey,
          reference: params.reference,
        },
      });
      return {
        deposited: after.toString(),
        award: wallet.awardBalance.toString(),
        promo: wallet.promoBalance.toString(),
      };
    });
  }

  /** Debit spendable rupees: deposited first, remainder from promo. Award is never spent. */
  async debitSpendable(params: {
    userId: string;
    amount: number;
    type: "FLASH_UNLOCK" | "MCQ_UNLOCK" | "TEST_ENTRY" | "BOOK_UNLOCK";
    idempotencyKey?: string;
    reference?: string;
  }) {
    const amount = new Decimal(params.amount);
    if (amount.lte(0)) return this.getBalances(params.userId);

    if (params.idempotencyKey) {
      const existing = await prisma.walletLedger.findUnique({
        where: { idempotencyKey: params.idempotencyKey },
      });
      if (existing) return this.getBalances(params.userId);
    }

    try {
      return await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { userId: params.userId } });
      if (!wallet) throw new AppError("WALLET_NOT_FOUND", "Wallet not found", 404);

      const spendable = wallet.depositedBalance.add(wallet.promoBalance);
      if (spendable.lt(amount)) {
        throw new AppError(
          "WALLET_INSUFFICIENT",
          "Insufficient wallet balance. Add money in Wallet.",
          400,
          { needed: amount.toString(), spendable: spendable.toString() }
        );
      }

      const fromDep = wallet.depositedBalance.lt(amount) ? wallet.depositedBalance : amount;
      const fromPromo = amount.sub(fromDep);
      const nextDep = wallet.depositedBalance.sub(fromDep);
      const nextPromo = wallet.promoBalance.sub(fromPromo);

      await tx.wallet.update({
        where: { userId: params.userId },
        data: { depositedBalance: nextDep, promoBalance: nextPromo },
      });

      if (fromDep.gt(0)) {
        await tx.walletLedger.create({
          data: {
            userId: params.userId,
            type: params.type,
            amount: fromDep,
            balanceBefore: wallet.depositedBalance,
            balanceAfter: nextDep,
            balanceBucket: "deposited",
            idempotencyKey: params.idempotencyKey,
            reference: params.reference,
          },
        });
      }
      if (fromPromo.gt(0)) {
        await tx.walletLedger.create({
          data: {
            userId: params.userId,
            type: params.type,
            amount: fromPromo,
            balanceBefore: wallet.promoBalance,
            balanceAfter: nextPromo,
            balanceBucket: "promo",
            idempotencyKey: fromDep.gt(0) ? `${params.idempotencyKey}:promo` : params.idempotencyKey,
            reference: params.reference,
          },
        });
      }

      return {
        deposited: nextDep.toString(),
        award: wallet.awardBalance.toString(),
        promo: nextPromo.toString(),
      };
      });
    } catch (error) {
      if ((error as { code?: string }).code === "P2002" && params.idempotencyKey) {
        return this.getBalances(params.userId);
      }
      throw error;
    }
  }
}

export const walletService = new WalletService();
