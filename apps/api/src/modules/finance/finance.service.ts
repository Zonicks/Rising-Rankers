import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "../../infrastructure/database/prisma";

function asNumber(d: Decimal | number | string | null | undefined) {
  if (d == null) return 0;
  return typeof d === "number" ? d : Number(d);
}

function money(n: number) {
  return (Math.round(n * 100) / 100).toFixed(2);
}

function sumByType(
  rows: Array<{ type: string; _sum: { amount: Decimal | null } }>,
  type: string
) {
  return rows.filter((r) => r.type === type).reduce((n, r) => n + asNumber(r._sum.amount), 0);
}

export class FinanceService {
  async summary() {
    const [ledgerSums, tests, withdrawals, walletTotals] = await Promise.all([
      prisma.walletLedger.groupBy({
        by: ["type"],
        where: { status: "SUCCESSFUL" },
        _sum: { amount: true },
      }),
      prisma.liveTest.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          registrations: { select: { status: true, feePaid: true } },
          awards: { select: { status: true, amount: true } },
        },
      }),
      prisma.withdrawal.groupBy({
        by: ["status"],
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.wallet.aggregate({
        _sum: {
          depositedBalance: true,
          awardBalance: true,
          promoBalance: true,
        },
      }),
    ]);

    const entryFees = sumByType(ledgerSums, "TEST_ENTRY");
    const refunds = sumByType(ledgerSums, "REFUND");
    const awardsCreditedLedger = sumByType(ledgerSums, "AWARD_CREDIT");
    const unlocks =
      sumByType(ledgerSums, "FLASH_UNLOCK") +
      sumByType(ledgerSums, "MCQ_UNLOCK") +
      sumByType(ledgerSums, "BOOK_UNLOCK");
    const deposits = sumByType(ledgerSums, "DEPOSIT");

    const byTest = tests.map((t) => {
      const collected = t.registrations
        .filter((r) => r.status === "JOINED")
        .reduce((n, r) => n + asNumber(r.feePaid), 0);
      const refunded = t.registrations
        .filter((r) => r.status === "REFUNDED")
        .reduce((n, r) => n + asNumber(r.feePaid), 0);
      const awardsPaid = t.awards
        .filter((a) => a.status === "CREDITED")
        .reduce((n, a) => n + asNumber(a.amount), 0);
      const awardsPending = t.awards
        .filter((a) => a.status === "PENDING_REVIEW")
        .reduce((n, a) => n + asNumber(a.amount), 0);
      const feePct = asNumber(t.platformFeePercent);
      const platformFee = (collected * feePct) / 100;
      const realized = collected - awardsPaid;
      const committed = realized - awardsPending;
      const subsidy = Math.max(0, awardsPaid + awardsPending - collected);
      return {
        id: t.id,
        title: t.title,
        status: t.status,
        joined: t.registrations.filter((r) => r.status === "JOINED").length,
        collected: money(collected),
        refunded: money(refunded),
        platformFee: money(platformFee),
        awardsPaid: money(awardsPaid),
        awardsPending: money(awardsPending),
        subsidy: money(subsidy),
        realized: money(realized),
        committed: money(committed),
      };
    });

    const awardsPending = byTest.reduce((n, t) => n + Number(t.awardsPending), 0);
    const awardsPaidTests = byTest.reduce((n, t) => n + Number(t.awardsPaid), 0);
    const collectedTests = byTest.reduce((n, t) => n + Number(t.collected), 0);
    const platformFeeTotal = byTest.reduce((n, t) => n + Number(t.platformFee), 0);
    const subsidyTotal = byTest.reduce((n, t) => n + Number(t.subsidy), 0);

    const realizedContest = collectedTests - awardsPaidTests;
    const committedContest = realizedContest - awardsPending;
    const realizedAll = realizedContest + unlocks;

    const withdraw = (status: string) => {
      const row = withdrawals.find((w) => w.status === status);
      return { amount: asNumber(row?._sum.amount), count: row?._count._all ?? 0 };
    };

    return {
      contest: {
        entryFees: money(collectedTests),
        ledgerEntryFees: money(entryFees),
        refunds: money(refunds),
        awardsPaid: money(awardsPaidTests),
        awardsPaidLedger: money(awardsCreditedLedger),
        awardsPending: money(awardsPending),
        platformFee: money(platformFeeTotal),
        subsidy: money(subsidyTotal),
        realized: money(realizedContest),
        committed: money(committedContest),
      },
      other: {
        unlocks: money(unlocks),
        deposits: money(deposits),
      },
      combined: {
        realized: money(realizedAll),
        committed: money(realizedAll - awardsPending),
      },
      wallets: {
        deposited: money(asNumber(walletTotals._sum.depositedBalance)),
        award: money(asNumber(walletTotals._sum.awardBalance)),
        promo: money(asNumber(walletTotals._sum.promoBalance)),
      },
      withdrawals: {
        pending: money(withdraw("PENDING").amount + withdraw("UNDER_REVIEW").amount),
        approved: money(
          withdraw("APPROVED").amount + withdraw("PROCESSING").amount + withdraw("SUCCESSFUL").amount
        ),
        rejected: money(withdraw("REJECTED").amount),
      },
      tests: byTest,
    };
  }
}

export const financeService = new FinanceService();
