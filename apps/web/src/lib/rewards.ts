export type UnlockedAchievement = {
  id: string;
  name: string;
  description?: string;
  iconKey?: string;
  tier?: "GOLD" | "SILVER" | "BRONZE";
  pointsReward?: number;
};

export type RewardsDelta = {
  streakCount?: number;
  pointsBalance?: number;
  pointsDelta?: number;
  unlocked?: UnlockedAchievement[];
};

export const REWARDS_EVENT = "rr-rewards";

export function emitRewards(delta?: RewardsDelta | null) {
  if (!delta || typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(REWARDS_EVENT, { detail: delta }));
}

export function achievementGlyph(iconKey?: string) {
  switch (iconKey) {
    case "local_fire_department":
      return "🔥";
    case "style":
      return "▤";
    case "quiz":
      return "✎";
    case "gavel":
      return "⚖";
    case "history_edu":
      return "📜";
    case "emoji_events":
      return "★";
    default:
      return "★";
  }
}
