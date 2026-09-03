export interface AdminCreditInput {
  userId: string;
  amount: number;
  bucket: "deposited" | "award" | "promo";
  note?: string;
}
