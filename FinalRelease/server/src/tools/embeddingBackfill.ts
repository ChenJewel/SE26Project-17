import { initializePostgres, postgresPool } from "../data/postgres.js";
import { backfillAiMemoryEmbeddings } from "../modules/aiMemory.js";

process.env.AI_EMBEDDING_PROVIDER ??= "ollama";
process.env.OLLAMA_EMBEDDING_MODEL ??= "bge-m3";
process.env.AI_EMBEDDING_VECTOR_DIMENSIONS ??= "1024";

const limit = readPositiveInteger(process.argv[2], 100);

try {
  await initializePostgres();
  const result = await backfillAiMemoryEmbeddings(limit);
  console.log(JSON.stringify(result, null, 2));
} finally {
  await postgresPool.end();
}

function readPositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}
