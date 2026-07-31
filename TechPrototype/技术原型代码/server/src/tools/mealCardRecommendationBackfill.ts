import { initializePostgres, postgresPool } from "../data/postgres.js";
import {
  backfillMealCardRecommendationCaches,
  backfillMealCardRecommendationFeatures,
} from "../modules/mealCardRecommendationFeatures.js";

const limitCards = readPositiveInteger(process.argv[2], 200);
const limitUsers = readPositiveInteger(process.argv[3], 100);

try {
  await initializePostgres();
  const features = await backfillMealCardRecommendationFeatures(limitCards);
  const caches = await backfillMealCardRecommendationCaches(limitUsers, limitCards);
  console.log(JSON.stringify({ features, caches }, null, 2));
} finally {
  await postgresPool.end();
}

function readPositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}
