import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { initializePostgres, postgresPool } from "../data/postgres.js";

const sqlitePath = process.env.SQLITE_MIGRATION_PATH ?? resolve(process.cwd(), "data", "ueat-dev.sqlite");

const tables: Array<{
  name: string;
  columns: string[];
  booleanColumns?: string[];
  jsonColumns?: string[];
}> = [
  {
    name: "users",
    columns: ["id", "email", "password_hash", "nickname", "avatar_text", "verified", "school", "bio", "preference_tags", "created_at", "updated_at"],
    booleanColumns: ["verified"],
    jsonColumns: ["preference_tags"],
  },
  {
    name: "meal_cards",
    columns: ["id", "user_id", "nickname", "avatar_text", "verified", "text", "time", "place", "people", "tags", "match_score", "reason", "status", "created_at", "updated_at"],
    booleanColumns: ["verified"],
    jsonColumns: ["tags"],
  },
  {
    name: "posts",
    columns: ["id", "author_id", "title", "text", "author", "avatar", "channel", "topic", "media_type", "media_source", "place", "likes", "favorites", "comments", "shares", "verified", "hot", "followed", "nearby", "status", "created_at", "updated_at"],
    booleanColumns: ["verified", "hot", "followed", "nearby"],
  },
  {
    name: "comments",
    columns: ["id", "post_id", "author_id", "author", "avatar", "text", "likes", "status", "created_at", "updated_at"],
  },
  { name: "likes", columns: ["user_id", "post_id", "created_at"] },
  { name: "favorites", columns: ["user_id", "post_id", "created_at"] },
  { name: "follows", columns: ["follower_user_id", "following_user_id", "created_at"] },
  { name: "blocks", columns: ["blocker_user_id", "blocked_user_id", "created_at"] },
  { name: "reports", columns: ["id", "reporter_user_id", "target_type", "target_id", "reason", "status", "created_at", "updated_at"] },
  { name: "notifications", columns: ["id", "user_id", "type", "actor_user_id", "target_type", "target_id", "text", "created_at", "read_at"] },
  { name: "conversations", columns: ["id", "title", "preview", "created_at", "updated_at"] },
  { name: "conversation_members", columns: ["conversation_id", "user_id", "unread_count", "joined_at"] },
  { name: "messages", columns: ["id", "conversation_id", "sender_user_id", "type", "text", "metadata", "created_at"], jsonColumns: ["metadata"] },
  { name: "message_reads", columns: ["message_id", "user_id", "read_at"] },
  {
    name: "exchange_requests",
    columns: ["id", "sender_user_id", "receiver_user_id", "target_card_id", "own_card_id", "conversation_id", "status", "created_at", "updated_at"],
  },
];

if (!existsSync(sqlitePath)) {
  console.log(`No SQLite database found at ${sqlitePath}; skipping migration.`);
  process.exit(0);
}

await initializePostgres();

const sqlite = new DatabaseSync(sqlitePath, { readOnly: true });

for (const table of tables) {
  const exists = sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table.name);
  if (!exists) continue;

  const rows = sqlite.prepare(`SELECT ${table.columns.join(", ")} FROM ${table.name}`).all() as Record<string, unknown>[];
  let inserted = 0;

  for (const row of rows) {
    const values = table.columns.map((column) => normalizeValue(row[column], column, table));
    const placeholders = table.columns.map((column, index) => {
      const placeholder = `$${index + 1}`;
      return table.jsonColumns?.includes(column) ? `${placeholder}::jsonb` : placeholder;
    });

    const result = await postgresPool.query(
      `INSERT INTO ${table.name} (${table.columns.join(", ")})
       VALUES (${placeholders.join(", ")})
       ON CONFLICT DO NOTHING`,
      values
    );
    inserted += result.rowCount ?? 0;
  }

  console.log(`Migrated ${inserted}/${rows.length} rows into ${table.name}.`);
}

await postgresPool.end();

function normalizeValue(value: unknown, column: string, table: { booleanColumns?: string[]; jsonColumns?: string[] }) {
  if (value === null || value === undefined) return null;
  if (table.booleanColumns?.includes(column)) return Boolean(value);
  if (table.jsonColumns?.includes(column)) {
    return typeof value === "string" ? value : JSON.stringify(value);
  }
  return value;
}
