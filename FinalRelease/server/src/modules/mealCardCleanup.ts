import { postgresStore } from "../data/postgres.js";
import { realtimeHub } from "../realtime.js";

const cleanupIntervalMs = 60 * 60 * 1000;

let cleanupTimerStarted = false;

export async function runMealCardHomeCleanup(now = new Date()) {
  const result = await postgresStore.closeHomeExpiredMealCards(now);
  if (result.cardIds.length) {
    realtimeHub.broadcastAll({
      type: "meal-card.cleanup",
      data: { cardIds: result.cardIds },
      createdAt: now.toISOString(),
    });
  }
  return result;
}

export function startMealCardHomeCleanup() {
  if (cleanupTimerStarted) return;
  cleanupTimerStarted = true;

  runMealCardHomeCleanup().catch((error) => {
    console.warn("Failed to run meal card home cleanup.", error);
  });

  const timer = setInterval(() => {
    runMealCardHomeCleanup().catch((error) => {
      console.warn("Failed to run meal card home cleanup.", error);
    });
  }, cleanupIntervalMs);

  (timer as { unref?: () => void }).unref?.();
}
