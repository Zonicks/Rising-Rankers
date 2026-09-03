export function statusLabel(status: string) {
  if (status === "WITHDRAWAL_RESTRICTED") return "Withdrawals restricted";
  if (status === "UNDER_REVIEW") return "Under review";
  if (status === "KYC_PENDING") return "KYC pending";
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export function statusChip(status: string) {
  if (status === "ACTIVE") return "chip-success";
  if (status === "SUSPENDED" || status === "BLOCKED") return "chip-danger";
  return "chip-accent";
}

export function ist(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
}
