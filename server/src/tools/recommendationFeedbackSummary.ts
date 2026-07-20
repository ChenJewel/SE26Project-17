import { initializePostgres, postgresPool, postgresStore } from "../data/postgres.js";

const days = readPositiveInteger(process.argv[2], 7);
const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

try {
  await initializePostgres();
  const [mealCardEvents, aiRows] = await Promise.all([
    postgresStore.getMealCardRecommendationEventStats(since),
    postgresPool.query<{
      exposures: string;
      selected: string;
      sent: string;
      recipient_replies: string;
      advanced_to_meal: string;
    }>(
      `SELECT COUNT(*)::text AS exposures,
              COUNT(selected_index)::text AS selected,
              COUNT(sent_message_id)::text AS sent,
              COUNT(recipient_replied_at)::text AS recipient_replies,
              COUNT(advanced_to_meal_at)::text AS advanced_to_meal
       FROM ai_recommendation_logs
       WHERE created_at >= $1`,
      [since]
    ),
  ]);
  const mealCardTotals = summarizeMealCardEvents(mealCardEvents);
  const aiTotals = aiRows.rows[0] ?? {
    exposures: "0",
    selected: "0",
    sent: "0",
    recipient_replies: "0",
    advanced_to_meal: "0",
  };

  console.log(
    JSON.stringify(
      {
        windowDays: days,
        since,
        mealCards: {
          totals: mealCardTotals,
          rates: {
            detailOpenPerExposure: rate(mealCardTotals.detail_open, mealCardTotals.exposure),
            skipPerExposure: rate(mealCardTotals.skip, mealCardTotals.exposure),
            invitePerExposure: rate(mealCardTotals.invite, mealCardTotals.exposure),
            acceptPerInvite: rate(mealCardTotals.accept, mealCardTotals.invite),
            rejectPerInvite: rate(mealCardTotals.reject, mealCardTotals.invite),
            reportPerExposure: rate(mealCardTotals.report, mealCardTotals.exposure),
            blockPerExposure: rate(mealCardTotals.block, mealCardTotals.exposure),
          },
          byDay: mealCardEvents,
        },
        aiIcebreakers: {
          totals: {
            exposures: Number(aiTotals.exposures) || 0,
            selected: Number(aiTotals.selected) || 0,
            sent: Number(aiTotals.sent) || 0,
            recipientReplies: Number(aiTotals.recipient_replies) || 0,
            advancedToMeal: Number(aiTotals.advanced_to_meal) || 0,
          },
          rates: {
            selectedPerExposure: rate(Number(aiTotals.selected), Number(aiTotals.exposures)),
            sentPerExposure: rate(Number(aiTotals.sent), Number(aiTotals.exposures)),
            replyPerSent: rate(Number(aiTotals.recipient_replies), Number(aiTotals.sent)),
            advancedToMealPerSent: rate(Number(aiTotals.advanced_to_meal), Number(aiTotals.sent)),
          },
        },
      },
      null,
      2
    )
  );
} finally {
  await postgresPool.end();
}

function summarizeMealCardEvents(events: Awaited<ReturnType<typeof postgresStore.getMealCardRecommendationEventStats>>) {
  const totals = {
    exposure: 0,
    detail_open: 0,
    invite: 0,
    accept: 0,
    reject: 0,
    block: 0,
    report: 0,
    skip: 0,
  };
  for (const event of events) {
    totals[event.eventType] += event.count;
  }
  return totals;
}

function rate(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return Number((numerator / denominator).toFixed(4));
}

function readPositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}
