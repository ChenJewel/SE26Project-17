import pg from "pg";
import type {
  AiSuggestionCache,
  AiEmbeddingJob,
  AiEmbeddingJobStatus,
  AiEmbeddingJobTargetType,
  AiSuggestionJob,
  AiSuggestionMode,
  AiSuggestionStatus,
  AiMemoryItem,
  AiMemorySourceType,
  AiRecommendationLog,
  CommunityComment,
  CommunityPost,
  Conversation,
  MealCard,
  MealCardRecommendationCache,
  MealCardRecommendationEvent,
  MealCardRecommendationEventType,
  MealCardRecommendationFeature,
  MealExchangeRequest,
  Message,
  MessageType,
  Notification,
  Report,
  User,
  UserPetState,
  UserAiProfile,
  UserSettings,
} from "../types.js";
import { isMealCardVisibleOnHome } from "../common/mealCardVisibility.js";
import {
  type AiEmbeddingJobRow,
  type AiMemoryItemRow,
  type AiRecommendationLogRow,
  type AiSuggestionCacheRow,
  type AiSuggestionJobRow,
  type CommunityCommentRow,
  type CommunityPostRow,
  type ConversationMemberRow,
  type ConversationRow,
  type ExchangeRequestRow,
  type MealCardRecommendationCacheRow,
  type MealCardRecommendationEventRow,
  type MealCardRecommendationFeatureRow,
  type MealCardRow,
  type MessageRow,
  type NotificationRow,
  type ReportRow,
  type UserAiProfileRow,
  type UserPetStateRow,
  type UserRow,
  type UserSettingsRow,
  mapAiEmbeddingJob,
  mapAiMemoryItem,
  mapAiRecommendationLog,
  mapAiSuggestionCache,
  mapAiSuggestionJob,
  mapCommunityComment,
  mapCommunityPost,
  mapConversation,
  mapExchangeRequest,
  mapMealCard,
  mapMealCardRecommendationCache,
  mapMealCardRecommendationEvent,
  mapMealCardRecommendationFeature,
  mapMessage,
  mapNotification,
  mapOptional,
  mapReport,
  mapUser,
  mapUserAiProfile,
  mapUserPetState,
  mapUserSettings,
  parseAiEmbeddingJobStatus,
  parseMealCardRecommendationEventType,
  parseNumberArray,
  parseRecord,
  parseStringArray,
} from "./postgresMappers.js";

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required. Configure the cloud PostgreSQL connection before starting the server.");
}

export const postgresPool = new Pool({
  connectionString: databaseUrl,
});

const mealCardSelectSql = `
  SELECT mc.*, u.nickname AS user_nickname, u.avatar_text AS user_avatar_text, u.avatar_url AS user_avatar_url, u.verified AS user_verified
  FROM meal_cards mc
  JOIN users u ON u.id = mc.user_id
`;

const postSelectColumnsSql = `
  SELECT p.*, u.nickname AS user_nickname, u.avatar_text AS user_avatar_text, u.avatar_url AS user_avatar_url, u.verified AS user_verified
`;

const postSelectSql = `
  ${postSelectColumnsSql}
  FROM posts p
  JOIN users u ON u.id = p.author_id
`;

const commentSelectColumnsSql = `
  SELECT c.*, u.nickname AS user_nickname, u.avatar_text AS user_avatar_text, u.avatar_url AS user_avatar_url
`;

const commentSelectSql = `
  ${commentSelectColumnsSql}
  FROM comments c
  JOIN users u ON u.id = c.author_id
`;

export async function initializePostgres() {
  await postgresPool.query("SELECT 1");
  await postgresPool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      nickname TEXT NOT NULL,
      avatar_text TEXT NOT NULL,
      avatar_url TEXT,
      verified BOOLEAN NOT NULL DEFAULT false,
      school TEXT,
      bio TEXT,
      preference_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
      profile_completed BOOLEAN NOT NULL DEFAULT true,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS meal_cards (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      nickname TEXT NOT NULL,
      avatar_text TEXT NOT NULL,
      verified BOOLEAN NOT NULL DEFAULT false,
      text TEXT NOT NULL,
      time TEXT NOT NULL,
      place TEXT NOT NULL,
      people TEXT NOT NULL,
      tags JSONB NOT NULL DEFAULT '[]'::jsonb,
      match_score INTEGER NOT NULL DEFAULT 80,
      reason TEXT NOT NULL,
      media_type TEXT,
      media_url TEXT,
      media_mime_type TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      edit_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      text TEXT NOT NULL,
      author TEXT NOT NULL,
      avatar TEXT NOT NULL,
      channel TEXT NOT NULL,
      topic TEXT NOT NULL,
      media_type TEXT NOT NULL DEFAULT 'text',
      media_source TEXT NOT NULL DEFAULT 'text',
      media_url TEXT,
      media_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
      media_poster_url TEXT,
      media_mime_type TEXT,
      place TEXT NOT NULL,
      likes INTEGER NOT NULL DEFAULT 0,
      favorites INTEGER NOT NULL DEFAULT 0,
      comments INTEGER NOT NULL DEFAULT 0,
      shares INTEGER NOT NULL DEFAULT 0,
      verified BOOLEAN NOT NULL DEFAULT false,
      hot BOOLEAN NOT NULL DEFAULT false,
      followed BOOLEAN NOT NULL DEFAULT false,
      nearby BOOLEAN NOT NULL DEFAULT false,
      status TEXT NOT NULL DEFAULT 'published',
      edit_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      author TEXT NOT NULL,
      avatar TEXT NOT NULL,
      text TEXT NOT NULL,
      parent_comment_id TEXT REFERENCES comments(id) ON DELETE SET NULL,
      reply_to_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      reply_to_author TEXT,
      likes INTEGER NOT NULL DEFAULT 0,
      favorites INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'published',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS likes (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, post_id)
    );

    CREATE TABLE IF NOT EXISTS favorites (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, post_id)
    );

    CREATE TABLE IF NOT EXISTS comment_likes (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      comment_id TEXT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, comment_id)
    );

    CREATE TABLE IF NOT EXISTS comment_favorites (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      comment_id TEXT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, comment_id)
    );

    CREATE TABLE IF NOT EXISTS follows (
      follower_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      following_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      PRIMARY KEY (follower_user_id, following_user_id)
    );

    CREATE TABLE IF NOT EXISTS blocks (
      blocker_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      blocked_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      PRIMARY KEY (blocker_user_id, blocked_user_id)
    );

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      reporter_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      target_type TEXT,
      target_id TEXT,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL,
      read_at TEXT
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      preview TEXT NOT NULL DEFAULT '',
      conversation_type TEXT NOT NULL DEFAULT 'direct',
      avatar_text TEXT,
      avatar_url TEXT,
      description TEXT,
      category TEXT,
      location TEXT,
      join_question TEXT,
      is_public BOOLEAN NOT NULL DEFAULT false,
      owner_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversation_members (
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      unread_count INTEGER NOT NULL DEFAULT 0,
      joined_at TEXT NOT NULL,
      PRIMARY KEY (conversation_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      sender_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      text TEXT NOT NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TEXT NOT NULL,
      revoked_at TEXT
    );

    CREATE TABLE IF NOT EXISTS message_reads (
      message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      read_at TEXT NOT NULL,
      PRIMARY KEY (message_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS exchange_requests (
      id TEXT PRIMARY KEY,
      sender_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      receiver_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      target_card_id TEXT NOT NULL REFERENCES meal_cards(id) ON DELETE CASCADE,
      own_card_id TEXT REFERENCES meal_cards(id) ON DELETE SET NULL,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_settings (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      settings JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS email_verification_codes (
      email TEXT NOT NULL,
      purpose TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      school TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      sent_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      consumed_at TEXT,
      PRIMARY KEY (email, purpose)
    );

    CREATE TABLE IF NOT EXISTS email_send_logs (
      id BIGSERIAL PRIMARY KEY,
      day_key TEXT NOT NULL,
      purpose TEXT NOT NULL,
      email TEXT NOT NULL,
      school TEXT NOT NULL,
      provider TEXT NOT NULL,
      status TEXT NOT NULL,
      error_code TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS invitation_codes (
      id TEXT PRIMARY KEY,
      code_hash TEXT NOT NULL UNIQUE,
      code_prefix TEXT NOT NULL,
      label TEXT NOT NULL,
      max_uses INTEGER NOT NULL DEFAULT 10,
      used_count INTEGER NOT NULL DEFAULT 0,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      expires_at TEXT NOT NULL,
      created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS invitation_code_redemptions (
      id TEXT PRIMARY KEY,
      invitation_id TEXT NOT NULL REFERENCES invitation_codes(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      used_at TEXT NOT NULL,
      UNIQUE (invitation_id, user_id),
      UNIQUE (invitation_id, email)
    );

    CREATE TABLE IF NOT EXISTS user_pet_states (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      state JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_suggestion_jobs (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      requester_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      target_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      mode TEXT NOT NULL,
      status TEXT NOT NULL,
      provider TEXT NOT NULL,
      input_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      result_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      fallback_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      error_message TEXT,
      created_at TEXT NOT NULL,
      started_at TEXT,
      finished_at TEXT
    );

    CREATE TABLE IF NOT EXISTS ai_suggestion_cache (
      cache_key TEXT PRIMARY KEY,
      mode TEXT NOT NULL,
      provider TEXT NOT NULL,
      context_hash TEXT NOT NULL,
      suggestions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_memory_items (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      text TEXT NOT NULL,
      canonical_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
      embedding_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      embedding_model TEXT,
      embedded_at TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      visibility TEXT NOT NULL DEFAULT 'public',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (user_id, source_type, source_id)
    );

    CREATE TABLE IF NOT EXISTS ai_embedding_jobs (
      id TEXT PRIMARY KEY,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      text_hash TEXT NOT NULL,
      embedding_model TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      priority INTEGER NOT NULL DEFAULT 0,
      retry_count INTEGER NOT NULL DEFAULT 0,
      run_after TEXT,
      locked_at TEXT,
      locked_by TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      finished_at TEXT,
      UNIQUE (target_type, target_id, embedding_model)
    );

    CREATE TABLE IF NOT EXISTS meal_card_recommendation_features (
      card_id TEXT PRIMARY KEY REFERENCES meal_cards(id) ON DELETE CASCADE,
      feature_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      text_hash TEXT NOT NULL,
      model_version TEXT NOT NULL,
      embedding_model TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS meal_card_recommendation_cache (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      card_id TEXT NOT NULL REFERENCES meal_cards(id) ON DELETE CASCADE,
      semantic_score DOUBLE PRECISION NOT NULL DEFAULT 0,
      reason_tags TEXT[] NOT NULL DEFAULT '{}',
      feature_version TEXT NOT NULL,
      source_hash TEXT NOT NULL,
      expires_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, card_id)
    );

    CREATE TABLE IF NOT EXISTS meal_card_recommendation_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      card_id TEXT REFERENCES meal_cards(id) ON DELETE SET NULL,
      author_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      event_type TEXT NOT NULL,
      rank INTEGER,
      match_score INTEGER,
      reason TEXT,
      source TEXT NOT NULL DEFAULT 'home',
      context_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_ai_profiles (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      profile_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_recommendation_logs (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      requester_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      target_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      job_id TEXT REFERENCES ai_suggestion_jobs(id) ON DELETE SET NULL,
      mode TEXT NOT NULL,
      provider TEXT NOT NULL,
      context_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      suggestions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      selected_index INTEGER,
      selected_text TEXT,
      sent_message_id TEXT REFERENCES messages(id) ON DELETE SET NULL,
      recipient_replied_at TEXT,
      advanced_to_meal_at TEXT,
      outcome_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS semantic_tag_mappings (
      id TEXT PRIMARY KEY,
      raw_text TEXT NOT NULL,
      normalized_text TEXT NOT NULL,
      canonical_tag TEXT NOT NULL,
      dimension TEXT NOT NULL,
      confidence DOUBLE PRECISION NOT NULL DEFAULT 0,
      method TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      source TEXT NOT NULL DEFAULT 'unknown',
      source_count INTEGER NOT NULL DEFAULT 0,
      sample_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      taxonomy_version TEXT NOT NULL,
      embedding_model TEXT,
      reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      reviewed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (normalized_text, canonical_tag)
    );

    CREATE INDEX IF NOT EXISTS idx_meal_cards_user_id ON meal_cards(user_id);
    CREATE INDEX IF NOT EXISTS idx_meal_cards_status ON meal_cards(status);
    CREATE INDEX IF NOT EXISTS idx_posts_author_id ON posts(author_id);
    CREATE INDEX IF NOT EXISTS idx_posts_status_created_at ON posts(status, created_at);
    CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
    CREATE INDEX IF NOT EXISTS idx_comments_status ON comments(status);
    CREATE INDEX IF NOT EXISTS idx_likes_post_id ON likes(post_id);
    CREATE INDEX IF NOT EXISTS idx_favorites_post_id ON favorites(post_id);
    CREATE INDEX IF NOT EXISTS idx_comment_likes_comment_id ON comment_likes(comment_id);
    CREATE INDEX IF NOT EXISTS idx_comment_favorites_comment_id ON comment_favorites(comment_id);
    CREATE INDEX IF NOT EXISTS idx_follows_follower_user_id ON follows(follower_user_id);
    CREATE INDEX IF NOT EXISTS idx_follows_following_user_id ON follows(following_user_id);
    CREATE INDEX IF NOT EXISTS idx_blocks_blocked_user_id ON blocks(blocked_user_id);
    CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
    CREATE INDEX IF NOT EXISTS idx_notifications_user_created_at ON notifications(user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_email_verification_codes_expires ON email_verification_codes(expires_at);
    CREATE INDEX IF NOT EXISTS idx_email_send_logs_day_purpose ON email_send_logs(day_key, purpose);
    CREATE INDEX IF NOT EXISTS idx_email_send_logs_email ON email_send_logs(email);
    CREATE INDEX IF NOT EXISTS idx_invitation_codes_active_expires ON invitation_codes(active, expires_at);
    CREATE INDEX IF NOT EXISTS idx_invitation_redemptions_email ON invitation_code_redemptions(email);
    CREATE INDEX IF NOT EXISTS idx_conversation_members_user_id ON conversation_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_messages_conversation_created_at ON messages(conversation_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_exchange_requests_conversation_id ON exchange_requests(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_exchange_requests_receiver ON exchange_requests(receiver_user_id, status);
    CREATE INDEX IF NOT EXISTS idx_ai_suggestion_jobs_requester ON ai_suggestion_jobs(requester_user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_ai_suggestion_jobs_status ON ai_suggestion_jobs(status, created_at);
    CREATE INDEX IF NOT EXISTS idx_ai_suggestion_cache_expires ON ai_suggestion_cache(expires_at);
    CREATE INDEX IF NOT EXISTS idx_ai_memory_items_user ON ai_memory_items(user_id, status, updated_at);
    CREATE INDEX IF NOT EXISTS idx_ai_memory_items_source ON ai_memory_items(source_type, source_id);
    CREATE INDEX IF NOT EXISTS idx_ai_embedding_jobs_status ON ai_embedding_jobs(status, run_after, priority, created_at);
    CREATE INDEX IF NOT EXISTS idx_ai_embedding_jobs_target ON ai_embedding_jobs(target_type, target_id);
    CREATE INDEX IF NOT EXISTS idx_meal_card_recommendation_features_status ON meal_card_recommendation_features(status, updated_at);
    CREATE INDEX IF NOT EXISTS idx_meal_card_recommendation_cache_user ON meal_card_recommendation_cache(user_id, expires_at, updated_at);
    CREATE INDEX IF NOT EXISTS idx_meal_card_recommendation_cache_card ON meal_card_recommendation_cache(card_id, updated_at);
    CREATE INDEX IF NOT EXISTS idx_meal_card_recommendation_events_user ON meal_card_recommendation_events(user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_meal_card_recommendation_events_card ON meal_card_recommendation_events(card_id, event_type, created_at);
    CREATE INDEX IF NOT EXISTS idx_meal_card_recommendation_events_type ON meal_card_recommendation_events(event_type, created_at);
    CREATE INDEX IF NOT EXISTS idx_ai_recommendation_logs_requester ON ai_recommendation_logs(requester_user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_ai_recommendation_logs_conversation ON ai_recommendation_logs(conversation_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_semantic_tag_mappings_status ON semantic_tag_mappings(status, updated_at);
    CREATE INDEX IF NOT EXISTS idx_semantic_tag_mappings_canonical ON semantic_tag_mappings(canonical_tag, status);
  `);

  await postgresPool.query("ALTER TABLE comments ADD COLUMN IF NOT EXISTS favorites INTEGER NOT NULL DEFAULT 0");
  await postgresPool.query("ALTER TABLE messages ADD COLUMN IF NOT EXISTS revoked_at TEXT");
  await postgresPool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT");
  await postgresPool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'");
  await postgresPool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN NOT NULL DEFAULT true");
  await postgresPool.query("ALTER TABLE posts ADD COLUMN IF NOT EXISTS media_url TEXT");
  await postgresPool.query("ALTER TABLE posts ADD COLUMN IF NOT EXISTS media_urls JSONB NOT NULL DEFAULT '[]'::jsonb");
  await postgresPool.query("ALTER TABLE posts ADD COLUMN IF NOT EXISTS media_poster_url TEXT");
  await postgresPool.query("ALTER TABLE posts ADD COLUMN IF NOT EXISTS media_mime_type TEXT");
  await postgresPool.query("ALTER TABLE posts ADD COLUMN IF NOT EXISTS edit_count INTEGER NOT NULL DEFAULT 0");
  await postgresPool.query("ALTER TABLE comments ADD COLUMN IF NOT EXISTS parent_comment_id TEXT REFERENCES comments(id) ON DELETE SET NULL");
  await postgresPool.query("ALTER TABLE comments ADD COLUMN IF NOT EXISTS reply_to_user_id TEXT REFERENCES users(id) ON DELETE SET NULL");
  await postgresPool.query("ALTER TABLE comments ADD COLUMN IF NOT EXISTS reply_to_author TEXT");
  await postgresPool.query("ALTER TABLE meal_cards ADD COLUMN IF NOT EXISTS media_type TEXT");
  await postgresPool.query("ALTER TABLE meal_cards ADD COLUMN IF NOT EXISTS media_url TEXT");
  await postgresPool.query("ALTER TABLE meal_cards ADD COLUMN IF NOT EXISTS media_mime_type TEXT");
  await postgresPool.query("ALTER TABLE meal_cards ADD COLUMN IF NOT EXISTS edit_count INTEGER NOT NULL DEFAULT 0");
  await postgresPool.query("ALTER TABLE conversations ADD COLUMN IF NOT EXISTS conversation_type TEXT NOT NULL DEFAULT 'direct'");
  await postgresPool.query("ALTER TABLE conversations ADD COLUMN IF NOT EXISTS avatar_text TEXT");
  await postgresPool.query("ALTER TABLE conversations ADD COLUMN IF NOT EXISTS avatar_url TEXT");
  await postgresPool.query("ALTER TABLE conversations ADD COLUMN IF NOT EXISTS description TEXT");
  await postgresPool.query("ALTER TABLE conversations ADD COLUMN IF NOT EXISTS category TEXT");
  await postgresPool.query("ALTER TABLE conversations ADD COLUMN IF NOT EXISTS location TEXT");
  await postgresPool.query("ALTER TABLE conversations ADD COLUMN IF NOT EXISTS join_question TEXT");
  await postgresPool.query("ALTER TABLE conversations ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false");
  await postgresPool.query("ALTER TABLE conversations ADD COLUMN IF NOT EXISTS owner_user_id TEXT REFERENCES users(id) ON DELETE SET NULL");
  await postgresPool.query(`
    CREATE TABLE IF NOT EXISTS user_settings (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      settings JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TEXT NOT NULL
    )
  `);
  await postgresPool.query(`
    CREATE TABLE IF NOT EXISTS email_verification_codes (
      email TEXT NOT NULL,
      purpose TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      school TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      sent_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      consumed_at TEXT,
      PRIMARY KEY (email, purpose)
    )
  `);
  await postgresPool.query("CREATE INDEX IF NOT EXISTS idx_email_verification_codes_expires ON email_verification_codes(expires_at)");
  await postgresPool.query(`
    CREATE TABLE IF NOT EXISTS email_send_logs (
      id BIGSERIAL PRIMARY KEY,
      day_key TEXT NOT NULL,
      purpose TEXT NOT NULL,
      email TEXT NOT NULL,
      school TEXT NOT NULL,
      provider TEXT NOT NULL,
      status TEXT NOT NULL,
      error_code TEXT,
      created_at TEXT NOT NULL
    )
  `);
  await postgresPool.query("CREATE INDEX IF NOT EXISTS idx_email_send_logs_day_purpose ON email_send_logs(day_key, purpose)");
  await postgresPool.query("CREATE INDEX IF NOT EXISTS idx_email_send_logs_email ON email_send_logs(email)");
  await postgresPool.query(`
    CREATE TABLE IF NOT EXISTS invitation_codes (
      id TEXT PRIMARY KEY,
      code_hash TEXT NOT NULL UNIQUE,
      code_prefix TEXT NOT NULL,
      label TEXT NOT NULL,
      max_uses INTEGER NOT NULL DEFAULT 10,
      used_count INTEGER NOT NULL DEFAULT 0,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      expires_at TEXT NOT NULL,
      created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  await postgresPool.query(`
    CREATE TABLE IF NOT EXISTS invitation_code_redemptions (
      id TEXT PRIMARY KEY,
      invitation_id TEXT NOT NULL REFERENCES invitation_codes(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      used_at TEXT NOT NULL,
      UNIQUE (invitation_id, user_id),
      UNIQUE (invitation_id, email)
    )
  `);
  await postgresPool.query("CREATE INDEX IF NOT EXISTS idx_invitation_codes_active_expires ON invitation_codes(active, expires_at)");
  await postgresPool.query("CREATE INDEX IF NOT EXISTS idx_invitation_redemptions_email ON invitation_code_redemptions(email)");
  await postgresPool.query(`
    CREATE TABLE IF NOT EXISTS user_pet_states (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      state JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TEXT NOT NULL
    )
  `);
  await postgresPool.query(`
    CREATE TABLE IF NOT EXISTS ai_suggestion_jobs (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      requester_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      target_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      mode TEXT NOT NULL,
      status TEXT NOT NULL,
      provider TEXT NOT NULL,
      input_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      result_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      fallback_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      error_message TEXT,
      created_at TEXT NOT NULL,
      started_at TEXT,
      finished_at TEXT
    )
  `);
  await postgresPool.query(`
    CREATE TABLE IF NOT EXISTS ai_suggestion_cache (
      cache_key TEXT PRIMARY KEY,
      mode TEXT NOT NULL,
      provider TEXT NOT NULL,
      context_hash TEXT NOT NULL,
      suggestions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
  await postgresPool.query(`
    CREATE TABLE IF NOT EXISTS ai_memory_items (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      text TEXT NOT NULL,
      canonical_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
      embedding_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      embedding_model TEXT,
      embedded_at TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      visibility TEXT NOT NULL DEFAULT 'public',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (user_id, source_type, source_id)
    )
  `);
  await postgresPool.query(`
    CREATE TABLE IF NOT EXISTS ai_embedding_jobs (
      id TEXT PRIMARY KEY,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      text_hash TEXT NOT NULL,
      embedding_model TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      priority INTEGER NOT NULL DEFAULT 0,
      retry_count INTEGER NOT NULL DEFAULT 0,
      run_after TEXT,
      locked_at TEXT,
      locked_by TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      finished_at TEXT,
      UNIQUE (target_type, target_id, embedding_model)
    )
  `);
  await postgresPool.query(`
    CREATE TABLE IF NOT EXISTS meal_card_recommendation_features (
      card_id TEXT PRIMARY KEY REFERENCES meal_cards(id) ON DELETE CASCADE,
      feature_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      text_hash TEXT NOT NULL,
      model_version TEXT NOT NULL,
      embedding_model TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  await postgresPool.query(`
    CREATE TABLE IF NOT EXISTS meal_card_recommendation_cache (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      card_id TEXT NOT NULL REFERENCES meal_cards(id) ON DELETE CASCADE,
      semantic_score DOUBLE PRECISION NOT NULL DEFAULT 0,
      reason_tags TEXT[] NOT NULL DEFAULT '{}',
      feature_version TEXT NOT NULL,
      source_hash TEXT NOT NULL,
      expires_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, card_id)
    )
  `);
  await postgresPool.query(`
    CREATE TABLE IF NOT EXISTS meal_card_recommendation_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      card_id TEXT REFERENCES meal_cards(id) ON DELETE SET NULL,
      author_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      event_type TEXT NOT NULL,
      rank INTEGER,
      match_score INTEGER,
      reason TEXT,
      source TEXT NOT NULL DEFAULT 'home',
      context_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TEXT NOT NULL
    )
  `);
  await postgresPool.query(`
    CREATE TABLE IF NOT EXISTS user_ai_profiles (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      profile_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TEXT NOT NULL
    )
  `);
  await postgresPool.query(`
    CREATE TABLE IF NOT EXISTS ai_recommendation_logs (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      requester_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      target_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      job_id TEXT REFERENCES ai_suggestion_jobs(id) ON DELETE SET NULL,
      mode TEXT NOT NULL,
      provider TEXT NOT NULL,
      context_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      suggestions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      selected_index INTEGER,
      selected_text TEXT,
      sent_message_id TEXT REFERENCES messages(id) ON DELETE SET NULL,
      recipient_replied_at TEXT,
      advanced_to_meal_at TEXT,
      outcome_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  await postgresPool.query("CREATE INDEX IF NOT EXISTS idx_ai_suggestion_jobs_requester ON ai_suggestion_jobs(requester_user_id, created_at)");
  await postgresPool.query("CREATE INDEX IF NOT EXISTS idx_ai_suggestion_jobs_status ON ai_suggestion_jobs(status, created_at)");
  await postgresPool.query("CREATE INDEX IF NOT EXISTS idx_ai_suggestion_cache_expires ON ai_suggestion_cache(expires_at)");
  await postgresPool.query("CREATE INDEX IF NOT EXISTS idx_ai_memory_items_user ON ai_memory_items(user_id, status, updated_at)");
  await postgresPool.query("CREATE INDEX IF NOT EXISTS idx_ai_memory_items_source ON ai_memory_items(source_type, source_id)");
  await postgresPool.query("CREATE INDEX IF NOT EXISTS idx_ai_embedding_jobs_status ON ai_embedding_jobs(status, run_after, priority, created_at)");
  await postgresPool.query("CREATE INDEX IF NOT EXISTS idx_ai_embedding_jobs_target ON ai_embedding_jobs(target_type, target_id)");
  await postgresPool.query("CREATE INDEX IF NOT EXISTS idx_meal_card_recommendation_features_status ON meal_card_recommendation_features(status, updated_at)");
  await postgresPool.query("CREATE INDEX IF NOT EXISTS idx_meal_card_recommendation_cache_user ON meal_card_recommendation_cache(user_id, expires_at, updated_at)");
  await postgresPool.query("CREATE INDEX IF NOT EXISTS idx_meal_card_recommendation_cache_card ON meal_card_recommendation_cache(card_id, updated_at)");
  await postgresPool.query("CREATE INDEX IF NOT EXISTS idx_meal_card_recommendation_events_user ON meal_card_recommendation_events(user_id, created_at)");
  await postgresPool.query("CREATE INDEX IF NOT EXISTS idx_meal_card_recommendation_events_card ON meal_card_recommendation_events(card_id, event_type, created_at)");
  await postgresPool.query("CREATE INDEX IF NOT EXISTS idx_meal_card_recommendation_events_type ON meal_card_recommendation_events(event_type, created_at)");
  await postgresPool.query("CREATE INDEX IF NOT EXISTS idx_ai_recommendation_logs_requester ON ai_recommendation_logs(requester_user_id, created_at)");
  await postgresPool.query("CREATE INDEX IF NOT EXISTS idx_ai_recommendation_logs_conversation ON ai_recommendation_logs(conversation_id, created_at)");
  await postgresPool.query(`
    CREATE TABLE IF NOT EXISTS semantic_tag_mappings (
      id TEXT PRIMARY KEY,
      raw_text TEXT NOT NULL,
      normalized_text TEXT NOT NULL,
      canonical_tag TEXT NOT NULL,
      dimension TEXT NOT NULL,
      confidence DOUBLE PRECISION NOT NULL DEFAULT 0,
      method TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      source TEXT NOT NULL DEFAULT 'unknown',
      source_count INTEGER NOT NULL DEFAULT 0,
      sample_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      taxonomy_version TEXT NOT NULL,
      embedding_model TEXT,
      reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      reviewed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (normalized_text, canonical_tag)
    )
  `);
  await postgresPool.query("CREATE INDEX IF NOT EXISTS idx_semantic_tag_mappings_status ON semantic_tag_mappings(status, updated_at)");
  await postgresPool.query("CREATE INDEX IF NOT EXISTS idx_semantic_tag_mappings_canonical ON semantic_tag_mappings(canonical_tag, status)");
  await postgresPool.query("ALTER TABLE ai_memory_items ADD COLUMN IF NOT EXISTS embedding_json JSONB NOT NULL DEFAULT '[]'::jsonb");
  await postgresPool.query("ALTER TABLE ai_memory_items ADD COLUMN IF NOT EXISTS embedding_model TEXT");
  await postgresPool.query("ALTER TABLE ai_memory_items ADD COLUMN IF NOT EXISTS embedded_at TEXT");
  await postgresPool.query("ALTER TABLE ai_recommendation_logs ADD COLUMN IF NOT EXISTS recipient_replied_at TEXT");
  await postgresPool.query("ALTER TABLE ai_recommendation_logs ADD COLUMN IF NOT EXISTS advanced_to_meal_at TEXT");
  await postgresPool.query("ALTER TABLE ai_recommendation_logs ADD COLUMN IF NOT EXISTS outcome_json JSONB NOT NULL DEFAULT '{}'::jsonb");
  await initializeOptionalPgvector();
  await postgresStore.backfillAiMemoryVectors();
}

export const postgresStore = {
  getDatabaseInfo() {
    return redactDatabaseUrl(databaseUrl);
  },

  async checkDatabaseHealth() {
    const startedAt = Date.now();
    await postgresPool.query("SELECT 1");
    return {
      status: "ok" as const,
      latencyMs: Date.now() - startedAt,
      database: redactDatabaseUrl(databaseUrl),
    };
  },

  async findUserById(id: string) {
    return mapOptional((await postgresPool.query<UserRow>("SELECT * FROM users WHERE id = $1", [id])).rows[0], mapUser);
  },

  async findUserByEmail(email: string) {
    return mapOptional((await postgresPool.query<UserRow>("SELECT * FROM users WHERE email = $1", [email])).rows[0], mapUser);
  },

  async listUsersByIds(userIds: string[]) {
    if (!userIds.length) return [];
    const rows = (await postgresPool.query<UserRow>("SELECT * FROM users WHERE id = ANY($1::text[])", [userIds])).rows;
    return rows.map(mapUser);
  },

  async listUsers(limit = 500) {
    const rows = (
      await postgresPool.query<UserRow>("SELECT * FROM users ORDER BY updated_at DESC LIMIT $1", [Math.max(1, Math.min(2000, limit))])
    ).rows;
    return rows.map(mapUser);
  },

  async listSearchableUsers(limit = 1000) {
    const rows = (
      await postgresPool.query<UserRow>(
        `SELECT u.* FROM users u
         LEFT JOIN user_settings us ON us.user_id = u.id
         WHERE COALESCE((us.settings->>'searchable')::boolean, true) = true
         ORDER BY u.updated_at DESC
         LIMIT $1`,
        [Math.max(1, Math.min(2000, limit))]
      )
    ).rows;
    return rows.map(mapUser);
  },

  async searchUsers(query: string, limit = 10, offset = 0) {
    const likeQuery = `%${query}%`;
    const prefixQuery = `${query}%`;
    const rows = (
      await postgresPool.query<UserRow>(
        `SELECT u.* FROM users u
         LEFT JOIN user_settings us ON us.user_id = u.id
         WHERE COALESCE((us.settings->>'searchable')::boolean, true) = true
           AND (nickname ILIKE $1 OR email ILIKE $1 OR COALESCE(school, '') ILIKE $1 OR COALESCE(bio, '') ILIKE $1)
         ORDER BY
           CASE
             WHEN nickname ILIKE $3 THEN 120
             WHEN email ILIKE $3 THEN 100
             WHEN nickname ILIKE $1 THEN 80
             WHEN COALESCE(school, '') ILIKE $1 THEN 55
             WHEN COALESCE(bio, '') ILIKE $1 THEN 35
             ELSE 10
           END DESC,
           updated_at DESC
         LIMIT $2 OFFSET $4`,
        [likeQuery, limit, prefixQuery, offset]
      )
    ).rows;
    return rows.map(mapUser);
  },

  async createUser(input: {
    id: string;
    email: string;
    passwordHash: string;
    role?: User["role"];
    nickname: string;
    avatarText: string;
    avatarUrl?: string;
    verified?: boolean;
    school?: string;
    bio?: string;
    preferenceTags?: string[];
    profileCompleted?: boolean;
  }) {
    const createdAt = new Date().toISOString();
    await postgresPool.query(
      `INSERT INTO users (
        id, email, password_hash, role, nickname, avatar_text, avatar_url, verified, school, bio,
        preference_tags, profile_completed, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13, $14)`,
      [
        input.id,
        input.email,
        input.passwordHash,
        input.role ?? "user",
        input.nickname,
        input.avatarText,
        input.avatarUrl ?? null,
        input.verified ?? false,
        input.school ?? null,
        input.bio ?? null,
        JSON.stringify(input.preferenceTags ?? []),
        input.profileCompleted ?? true,
        createdAt,
        createdAt,
      ]
    );
    return (await this.findUserById(input.id))!;
  },

  async verifyUser(id: string) {
    await postgresPool.query("UPDATE users SET verified = true, updated_at = $1 WHERE id = $2", [new Date().toISOString(), id]);
    return (await this.findUserById(id))!;
  },

  async updateUser(id: string, patch: Partial<Pick<User, "nickname" | "avatarText" | "avatarUrl" | "school" | "bio" | "preferenceTags" | "profileCompleted">>) {
    const current = await this.findUserById(id);
    if (!current) return undefined;

    const next = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    };

    await postgresPool.query(
      `UPDATE users SET
        nickname = $1, avatar_text = $2, avatar_url = $3, school = $4, bio = $5, preference_tags = $6::jsonb, profile_completed = $7, updated_at = $8
      WHERE id = $9`,
      [
        next.nickname,
        next.avatarText,
        next.avatarUrl ?? null,
        next.school ?? null,
        next.bio ?? null,
        JSON.stringify(next.preferenceTags),
        next.profileCompleted,
        next.updatedAt,
        id,
      ]
    );
    return this.findUserById(id);
  },

  async updateUserPassword(id: string, passwordHash: string) {
    await postgresPool.query("UPDATE users SET password_hash = $1, updated_at = $2 WHERE id = $3", [passwordHash, new Date().toISOString(), id]);
    return this.findUserById(id);
  },

  async deleteUserAccount(userId: string) {
    const client = await postgresPool.connect();
    const updatedAt = new Date().toISOString();
    try {
      await client.query("BEGIN");
      const userRow = (await client.query<UserRow>("SELECT * FROM users WHERE id = $1 FOR UPDATE", [userId])).rows[0];
      if (!userRow) {
        await client.query("ROLLBACK");
        return undefined;
      }

      const affectedConversationIds = (
        await client.query<{ conversation_id: string }>(
          `SELECT DISTINCT conversation_id FROM conversation_members WHERE user_id = $1
           UNION
           SELECT DISTINCT conversation_id FROM messages WHERE sender_user_id = $1`,
          [userId]
        )
      ).rows.map((row) => row.conversation_id);

      await client.query(
        `UPDATE posts p
         SET likes = GREATEST(p.likes - counts.total, 0)
         FROM (SELECT post_id, COUNT(*)::int AS total FROM likes WHERE user_id = $1 GROUP BY post_id) counts
         WHERE p.id = counts.post_id`,
        [userId]
      );
      await client.query(
        `UPDATE posts p
         SET favorites = GREATEST(p.favorites - counts.total, 0)
         FROM (SELECT post_id, COUNT(*)::int AS total FROM favorites WHERE user_id = $1 GROUP BY post_id) counts
         WHERE p.id = counts.post_id`,
        [userId]
      );
      await client.query(
        `UPDATE posts p
         SET comments = GREATEST(p.comments - counts.total, 0)
         FROM (
           SELECT post_id, COUNT(*)::int AS total
           FROM comments
           WHERE author_id = $1 AND status != 'deleted'
           GROUP BY post_id
         ) counts
         WHERE p.id = counts.post_id`,
        [userId]
      );
      await client.query(
        `UPDATE comments c
         SET likes = GREATEST(c.likes - counts.total, 0)
         FROM (SELECT comment_id, COUNT(*)::int AS total FROM comment_likes WHERE user_id = $1 GROUP BY comment_id) counts
         WHERE c.id = counts.comment_id`,
        [userId]
      );
      await client.query(
        `UPDATE comments c
         SET favorites = GREATEST(c.favorites - counts.total, 0)
         FROM (SELECT comment_id, COUNT(*)::int AS total FROM comment_favorites WHERE user_id = $1 GROUP BY comment_id) counts
         WHERE c.id = counts.comment_id`,
        [userId]
      );
      await client.query(
        `DELETE FROM notifications
         WHERE user_id = $1
            OR actor_user_id = $1
            OR (target_type = 'user' AND target_id = $1)
            OR (target_type = 'post' AND target_id IN (SELECT id FROM posts WHERE author_id = $1))
            OR (target_type = 'comment' AND target_id IN (SELECT id FROM comments WHERE author_id = $1))
            OR (target_type = 'meal-card' AND target_id IN (SELECT id FROM meal_cards WHERE user_id = $1))`,
        [userId]
      );
      await client.query(
        `DELETE FROM reports
         WHERE reporter_user_id = $1
            OR (target_type = 'user' AND target_id = $1)
            OR (target_type = 'post' AND target_id IN (SELECT id FROM posts WHERE author_id = $1))
            OR (target_type = 'comment' AND target_id IN (SELECT id FROM comments WHERE author_id = $1))
            OR (target_type = 'meal-card' AND target_id IN (SELECT id FROM meal_cards WHERE user_id = $1))`,
        [userId]
      );
      await client.query("DELETE FROM users WHERE id = $1", [userId]);

      if (affectedConversationIds.length) {
        await client.query(
          `UPDATE conversations c
           SET preview = COALESCE((
             SELECT CASE
               WHEN m.revoked_at IS NOT NULL THEN 'Message recalled'
               WHEN m.type != 'text' THEN 'Media message'
               ELSE m.text
             END
             FROM messages m
             WHERE m.conversation_id = c.id
             ORDER BY m.created_at DESC
             LIMIT 1
           ), ''), updated_at = $2
           WHERE c.id = ANY($1::text[])`,
          [affectedConversationIds, updatedAt]
        );
      }
      await client.query("DELETE FROM conversations c WHERE NOT EXISTS (SELECT 1 FROM conversation_members cm WHERE cm.conversation_id = c.id)");
      await client.query("COMMIT");
      return mapUser(userRow);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  async getUserSettings(userId: string): Promise<UserSettings> {
    const row = (await postgresPool.query<UserSettingsRow>("SELECT * FROM user_settings WHERE user_id = $1", [userId])).rows[0];
    if (row) return mapUserSettings(row);
    return { userId, settings: {}, updatedAt: new Date(0).toISOString() };
  },

  async updateUserSettings(userId: string, settings: Record<string, unknown>): Promise<UserSettings> {
    const updatedAt = new Date().toISOString();
    await postgresPool.query(
      `INSERT INTO user_settings (user_id, settings, updated_at)
       VALUES ($1, $2::jsonb, $3)
       ON CONFLICT (user_id) DO UPDATE SET settings = EXCLUDED.settings, updated_at = EXCLUDED.updated_at`,
      [userId, JSON.stringify(settings), updatedAt]
    );
    return this.getUserSettings(userId);
  },

  async getUserPetState(userId: string): Promise<UserPetState> {
    const row = (await postgresPool.query<UserPetStateRow>("SELECT * FROM user_pet_states WHERE user_id = $1", [userId])).rows[0];
    if (row) return mapUserPetState(row);
    return { userId, state: {}, updatedAt: new Date(0).toISOString() };
  },

  async updateUserPetState(userId: string, state: Record<string, unknown>): Promise<UserPetState> {
    const updatedAt = new Date().toISOString();
    await postgresPool.query(
      `INSERT INTO user_pet_states (user_id, state, updated_at)
       VALUES ($1, $2::jsonb, $3)
       ON CONFLICT (user_id) DO UPDATE SET state = EXCLUDED.state, updated_at = EXCLUDED.updated_at`,
      [userId, JSON.stringify(state), updatedAt]
    );
    return this.getUserPetState(userId);
  },

  async findAiSuggestionCache(cacheKey: string): Promise<AiSuggestionCache | undefined> {
    const row = (await postgresPool.query<AiSuggestionCacheRow>("SELECT * FROM ai_suggestion_cache WHERE cache_key = $1", [cacheKey])).rows[0];
    return mapOptional(row, mapAiSuggestionCache);
  },

  async upsertAiSuggestionCache(input: {
    cacheKey: string;
    mode: AiSuggestionMode;
    provider: string;
    contextHash: string;
    suggestions: string[];
    expiresAt: string;
  }): Promise<AiSuggestionCache> {
    const createdAt = new Date().toISOString();
    await postgresPool.query(
      `INSERT INTO ai_suggestion_cache (cache_key, mode, provider, context_hash, suggestions_json, expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
       ON CONFLICT (cache_key) DO UPDATE SET
         mode = EXCLUDED.mode,
         provider = EXCLUDED.provider,
         context_hash = EXCLUDED.context_hash,
         suggestions_json = EXCLUDED.suggestions_json,
         expires_at = EXCLUDED.expires_at`,
      [input.cacheKey, input.mode, input.provider, input.contextHash, JSON.stringify(input.suggestions), input.expiresAt, createdAt]
    );
    return (await this.findAiSuggestionCache(input.cacheKey))!;
  },

  async createAiSuggestionJob(input: {
    id: string;
    conversationId: string;
    requesterUserId: string;
    targetUserId?: string;
    mode: AiSuggestionMode;
    provider: string;
    input: Record<string, unknown>;
    fallbackSuggestions: string[];
  }): Promise<AiSuggestionJob> {
    const createdAt = new Date().toISOString();
    await postgresPool.query(
      `INSERT INTO ai_suggestion_jobs (
         id, conversation_id, requester_user_id, target_user_id, mode, status, provider,
         input_json, result_json, fallback_json, created_at
       ) VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7::jsonb, '{}'::jsonb, $8::jsonb, $9)`,
      [
        input.id,
        input.conversationId,
        input.requesterUserId,
        input.targetUserId ?? null,
        input.mode,
        input.provider,
        JSON.stringify(input.input),
        JSON.stringify(input.fallbackSuggestions),
        createdAt,
      ]
    );
    return (await this.findAiSuggestionJob(input.id))!;
  },

  async findAiSuggestionJob(jobId: string): Promise<AiSuggestionJob | undefined> {
    const row = (await postgresPool.query<AiSuggestionJobRow>("SELECT * FROM ai_suggestion_jobs WHERE id = $1", [jobId])).rows[0];
    return mapOptional(row, mapAiSuggestionJob);
  },

  async markAiSuggestionJobRunning(jobId: string): Promise<AiSuggestionJob | undefined> {
    const row = (
      await postgresPool.query<AiSuggestionJobRow>(
        `UPDATE ai_suggestion_jobs
         SET status = 'running', started_at = COALESCE(started_at, $2)
         WHERE id = $1 AND status IN ('pending', 'running')
         RETURNING *`,
        [jobId, new Date().toISOString()]
      )
    ).rows[0];
    return mapOptional(row, mapAiSuggestionJob);
  },

  async updateAiSuggestionJobInput(jobId: string, input: Record<string, unknown>): Promise<AiSuggestionJob | undefined> {
    const row = (
      await postgresPool.query<AiSuggestionJobRow>(
        `UPDATE ai_suggestion_jobs
         SET input_json = $2::jsonb
         WHERE id = $1
         RETURNING *`,
        [jobId, JSON.stringify(input)]
      )
    ).rows[0];
    return mapOptional(row, mapAiSuggestionJob);
  },

  async completeAiSuggestionJob(jobId: string, suggestions: string[]): Promise<AiSuggestionJob | undefined> {
    const row = (
      await postgresPool.query<AiSuggestionJobRow>(
        `UPDATE ai_suggestion_jobs
         SET status = 'succeeded', result_json = $2::jsonb, finished_at = $3, error_message = NULL
         WHERE id = $1
         RETURNING *`,
        [jobId, JSON.stringify({ suggestions }), new Date().toISOString()]
      )
    ).rows[0];
    return mapOptional(row, mapAiSuggestionJob);
  },

  async failAiSuggestionJob(jobId: string, errorMessage: string): Promise<AiSuggestionJob | undefined> {
    const row = (
      await postgresPool.query<AiSuggestionJobRow>(
        `UPDATE ai_suggestion_jobs
         SET status = 'failed', error_message = $2, finished_at = $3
         WHERE id = $1
         RETURNING *`,
        [jobId, errorMessage.slice(0, 400), new Date().toISOString()]
      )
    ).rows[0];
    return mapOptional(row, mapAiSuggestionJob);
  },

  async failInterruptedAiSuggestionJobs(errorMessage: string): Promise<number> {
    const result = await postgresPool.query(
      `UPDATE ai_suggestion_jobs
       SET status = 'failed', error_message = $1, finished_at = $2
       WHERE status IN ('pending', 'running') AND finished_at IS NULL`,
      [errorMessage.slice(0, 400), new Date().toISOString()]
    );
    return result.rowCount ?? 0;
  },

  async upsertAiMemoryItem(input: {
    id: string;
    userId: string;
    sourceType: AiMemorySourceType;
    sourceId: string;
    text: string;
    canonicalTags: string[];
    embedding?: number[];
    embeddingModel?: string;
    metadata?: Record<string, unknown>;
    status?: "active" | "deleted";
  }): Promise<AiMemoryItem> {
    const now = new Date().toISOString();
    const row = (
      await postgresPool.query<AiMemoryItemRow>(
        `INSERT INTO ai_memory_items (
           id, user_id, source_type, source_id, text, canonical_tags, embedding_json, embedding_model, embedded_at,
           metadata, visibility, status, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10::jsonb, 'public', $11, $12, $12)
         ON CONFLICT (user_id, source_type, source_id) DO UPDATE SET
           text = EXCLUDED.text,
           canonical_tags = EXCLUDED.canonical_tags,
           embedding_json = EXCLUDED.embedding_json,
           embedding_model = EXCLUDED.embedding_model,
           embedded_at = EXCLUDED.embedded_at,
           metadata = EXCLUDED.metadata,
           status = EXCLUDED.status,
           updated_at = EXCLUDED.updated_at
         RETURNING *`,
        [
          input.id,
          input.userId,
          input.sourceType,
          input.sourceId,
          input.text,
          JSON.stringify(input.canonicalTags),
          JSON.stringify(input.embedding ?? []),
          input.embeddingModel ?? null,
          input.embedding?.length ? now : null,
          JSON.stringify(input.metadata ?? {}),
          input.status ?? "active",
          now,
        ]
      )
    ).rows[0];
    if (input.embedding?.length) {
      await this.updateAiMemoryVector(row.id, input.embedding, input.embeddingModel);
    } else {
      await this.clearAiMemoryVectors(row.id);
    }
    return mapAiMemoryItem(row);
  },

  async updateAiMemoryEmbedding(memoryId: string, embedding: number[], embeddingModel: string): Promise<void> {
    const now = new Date().toISOString();
    await postgresPool.query(
      `UPDATE ai_memory_items
       SET embedding_json = $2::jsonb, embedding_model = $3, embedded_at = $4, updated_at = $4
       WHERE id = $1`,
      [memoryId, JSON.stringify(embedding), embeddingModel, now]
    );
    await this.clearAiMemoryVectors(memoryId);
    await this.updateAiMemoryVector(memoryId, embedding, embeddingModel);
  },

  async updateAiMemoryVector(memoryId: string, embedding: number[], embeddingModel?: string): Promise<void> {
    if (process.env.AI_PGVECTOR_ENABLED === "false") return;
    const column = getEmbeddingVectorColumn(embedding, embeddingModel);
    if (!column) return;
    try {
      await postgresPool.query(`UPDATE ai_memory_items SET ${column} = $2::vector WHERE id = $1`, [
        memoryId,
        toVectorLiteral(embedding),
      ]);
    } catch {
      // pgvector is optional; JSON embeddings remain available for fallback recall.
    }
  },

  async clearAiMemoryVectors(memoryId: string): Promise<void> {
    if (process.env.AI_PGVECTOR_ENABLED === "false") return;
    try {
      await postgresPool.query("UPDATE ai_memory_items SET embedding_vector = NULL WHERE id = $1", [memoryId]);
    } catch {
      // pgvector is optional and old deployments may not have this column yet.
    }
    try {
      await postgresPool.query("UPDATE ai_memory_items SET embedding_vector_v2 = NULL WHERE id = $1", [memoryId]);
    } catch {
      // embedding_vector_v2 is created only after the real embedding gate is enabled.
    }
  },

  async backfillAiMemoryVectors(limit = 500): Promise<number> {
    if (process.env.AI_PGVECTOR_ENABLED === "false") return 0;
    const rows = (
      await postgresPool.query<Pick<AiMemoryItemRow, "id" | "embedding_json" | "embedding_model">>(
        `SELECT id, embedding_json, embedding_model
         FROM ai_memory_items
         WHERE jsonb_array_length(embedding_json) > 0
           AND (to_regclass('public.ai_memory_items') IS NOT NULL)
         ORDER BY updated_at DESC
         LIMIT $1`,
        [limit]
      )
    ).rows;

    let updated = 0;
    for (const row of rows) {
      const embedding = parseNumberArray(row.embedding_json);
      if (!embedding.length) continue;
      await this.updateAiMemoryVector(row.id, embedding, row.embedding_model ?? undefined);
      updated += 1;
    }
    return updated;
  },

  async markAiMemoryItemsDeletedForUser(userId: string): Promise<void> {
    await postgresPool.query(
      "UPDATE ai_memory_items SET status = 'deleted', updated_at = $2 WHERE user_id = $1 AND status != 'deleted'",
      [userId, new Date().toISOString()]
    );
  },

  async listAiMemoryItemsForUsers(userIds: string[], limit = 120): Promise<AiMemoryItem[]> {
    if (!userIds.length) return [];
    const rows = (
      await postgresPool.query<AiMemoryItemRow>(
        `SELECT * FROM ai_memory_items
         WHERE user_id = ANY($1::text[]) AND status = 'active' AND visibility = 'public'
         ORDER BY updated_at DESC
         LIMIT $2`,
        [userIds, limit]
      )
    ).rows;
    return rows.map(mapAiMemoryItem);
  },

  async listAiMemoryItemsForMealCards(cardIds: string[], limit = 300): Promise<AiMemoryItem[]> {
    if (!cardIds.length) return [];
    const rows = (
      await postgresPool.query<AiMemoryItemRow>(
        `SELECT * FROM ai_memory_items
         WHERE source_type = 'meal_card'
           AND source_id = ANY($1::text[])
           AND status = 'active'
           AND visibility = 'public'
         ORDER BY updated_at DESC
         LIMIT $2`,
        [cardIds, limit]
      )
    ).rows;
    return rows.map(mapAiMemoryItem);
  },

  async searchAiMemoryItemsByVector(userIds: string[], embedding: number[], limit = 20, embeddingModel?: string): Promise<AiMemoryItem[]> {
    if (!userIds.length || !embedding.length || process.env.AI_PGVECTOR_ENABLED === "false") return [];
    const column = getEmbeddingVectorColumn(embedding, embeddingModel);
    if (!column) return [];
    try {
      const rows = (
        await postgresPool.query<AiMemoryItemRow>(
          `SELECT * FROM ai_memory_items
           WHERE user_id = ANY($1::text[])
             AND status = 'active'
             AND visibility = 'public'
             AND ${column} IS NOT NULL
             AND ($4::text IS NULL OR embedding_model = $4)
           ORDER BY ${column} <=> $2::vector
           LIMIT $3`,
          [userIds, toVectorLiteral(embedding), limit, embeddingModel ?? null]
        )
      ).rows;
      return rows.map(mapAiMemoryItem);
    } catch {
      return [];
    }
  },

  async listAiMemoryItemsNeedingEmbedding(embeddingModel: string, limit = 100): Promise<AiMemoryItem[]> {
    const rows = (
      await postgresPool.query<AiMemoryItemRow>(
        `SELECT * FROM ai_memory_items
         WHERE status = 'active'
           AND visibility = 'public'
           AND text <> ''
           AND (embedding_model IS DISTINCT FROM $1 OR jsonb_array_length(embedding_json) = 0)
         ORDER BY updated_at DESC
         LIMIT $2`,
        [embeddingModel, limit]
      )
    ).rows;
    return rows.map(mapAiMemoryItem);
  },

  async findAiMemoryItemById(memoryId: string): Promise<AiMemoryItem | undefined> {
    const row = (
      await postgresPool.query<AiMemoryItemRow>(
        `SELECT * FROM ai_memory_items
         WHERE id = $1 AND status = 'active' AND visibility = 'public'
         LIMIT 1`,
        [memoryId]
      )
    ).rows[0];
    return mapOptional(row, mapAiMemoryItem);
  },

  async upsertAiEmbeddingJob(input: {
    id: string;
    targetType: AiEmbeddingJobTargetType;
    targetId: string;
    textHash: string;
    embeddingModel: string;
    priority?: number;
    runAfter?: string;
  }): Promise<AiEmbeddingJob> {
    const now = new Date().toISOString();
    const row = (
      await postgresPool.query<AiEmbeddingJobRow>(
        `INSERT INTO ai_embedding_jobs (
           id, target_type, target_id, text_hash, embedding_model, status, priority, retry_count,
           run_after, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, 'pending', $6, 0, $7, $8, $8)
         ON CONFLICT (target_type, target_id, embedding_model) DO UPDATE SET
           text_hash = EXCLUDED.text_hash,
           status = CASE
             WHEN ai_embedding_jobs.text_hash = EXCLUDED.text_hash AND ai_embedding_jobs.status = 'succeeded'
               THEN ai_embedding_jobs.status
             ELSE 'pending'
           END,
           priority = GREATEST(ai_embedding_jobs.priority, EXCLUDED.priority),
           retry_count = CASE
             WHEN ai_embedding_jobs.text_hash = EXCLUDED.text_hash THEN ai_embedding_jobs.retry_count
             ELSE 0
           END,
           run_after = EXCLUDED.run_after,
           locked_at = NULL,
           locked_by = NULL,
           error_message = CASE
             WHEN ai_embedding_jobs.text_hash = EXCLUDED.text_hash AND ai_embedding_jobs.status = 'succeeded'
               THEN ai_embedding_jobs.error_message
             ELSE NULL
           END,
           updated_at = EXCLUDED.updated_at,
           finished_at = CASE
             WHEN ai_embedding_jobs.text_hash = EXCLUDED.text_hash AND ai_embedding_jobs.status = 'succeeded'
               THEN ai_embedding_jobs.finished_at
             ELSE NULL
           END
         RETURNING *`,
        [
          input.id,
          input.targetType,
          input.targetId,
          input.textHash,
          input.embeddingModel,
          input.priority ?? 0,
          input.runAfter ?? null,
          now,
        ]
      )
    ).rows[0];
    return mapAiEmbeddingJob(row);
  },

  async claimAiEmbeddingJobs(
    embeddingModel: string,
    limit = 50,
    workerId = "embedding-worker",
    targetTypes?: AiEmbeddingJobTargetType[]
  ): Promise<AiEmbeddingJob[]> {
    const client = await postgresPool.connect();
    const now = new Date().toISOString();
    try {
      await client.query("BEGIN");
      const rows = (
        await client.query<AiEmbeddingJobRow>(
          `WITH candidates AS (
             SELECT id
             FROM ai_embedding_jobs
             WHERE embedding_model = $1
               AND status = 'pending'
               AND ($5::text[] IS NULL OR target_type = ANY($5::text[]))
               AND (run_after IS NULL OR run_after <= $2)
             ORDER BY priority DESC, created_at ASC
             LIMIT $3
             FOR UPDATE SKIP LOCKED
           )
           UPDATE ai_embedding_jobs
           SET status = 'running', locked_at = $2, locked_by = $4, updated_at = $2
           WHERE id IN (SELECT id FROM candidates)
           RETURNING *`,
          [embeddingModel, now, limit, workerId, targetTypes?.length ? targetTypes : null]
        )
      ).rows;
      await client.query("COMMIT");
      return rows.map(mapAiEmbeddingJob);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  async completeAiEmbeddingJob(jobId: string): Promise<void> {
    const now = new Date().toISOString();
    await postgresPool.query(
      `UPDATE ai_embedding_jobs
       SET status = 'succeeded',
           locked_at = NULL,
           locked_by = NULL,
           error_message = NULL,
           updated_at = $2,
           finished_at = $2
       WHERE id = $1`,
      [jobId, now]
    );
  },

  async failAiEmbeddingJob(jobId: string, errorMessage: string, options?: { retryDelayMs?: number; final?: boolean }): Promise<void> {
    const now = new Date().toISOString();
    const runAfter = new Date(Date.now() + (options?.retryDelayMs ?? 5 * 60 * 1000)).toISOString();
    await postgresPool.query(
      `UPDATE ai_embedding_jobs
       SET status = $2,
           retry_count = retry_count + 1,
           run_after = $3,
           locked_at = NULL,
           locked_by = NULL,
           error_message = $4,
           updated_at = $5,
           finished_at = CASE WHEN $2 = 'failed' THEN $5 ELSE NULL END
       WHERE id = $1`,
      [jobId, options?.final ? "failed" : "pending", options?.final ? null : runAfter, errorMessage.slice(0, 600), now]
    );
  },

  async resetStaleAiEmbeddingJobs(staleMs = 30 * 60 * 1000): Promise<number> {
    const now = new Date().toISOString();
    const cutoff = new Date(Date.now() - staleMs).toISOString();
    const result = await postgresPool.query(
      `UPDATE ai_embedding_jobs
       SET status = 'pending',
           run_after = $1,
           locked_at = NULL,
           locked_by = NULL,
           updated_at = $1
       WHERE status = 'running'
         AND locked_at IS NOT NULL
         AND locked_at < $2`,
      [now, cutoff]
    );
    return result.rowCount ?? 0;
  },

  async getAiEmbeddingJobStats(embeddingModel?: string): Promise<Array<{ status: AiEmbeddingJobStatus; count: number }>> {
    const rows = (
      await postgresPool.query<{ status: string; count: string }>(
        `SELECT status, COUNT(1)::text AS count
         FROM ai_embedding_jobs
         WHERE ($1::text IS NULL OR embedding_model = $1)
         GROUP BY status
         ORDER BY status`,
        [embeddingModel ?? null]
      )
    ).rows;
    return rows.map((row) => ({ status: parseAiEmbeddingJobStatus(row.status), count: Number(row.count) || 0 }));
  },

  async upsertMealCardRecommendationFeature(input: {
    cardId: string;
    feature: Record<string, unknown>;
    textHash: string;
    modelVersion: string;
    embeddingModel?: string;
    status?: MealCardRecommendationFeature["status"];
  }): Promise<MealCardRecommendationFeature> {
    const now = new Date().toISOString();
    const row = (
      await postgresPool.query<MealCardRecommendationFeatureRow>(
        `INSERT INTO meal_card_recommendation_features (
           card_id, feature_json, text_hash, model_version, embedding_model, status, created_at, updated_at
         ) VALUES ($1, $2::jsonb, $3, $4, $5, $6, $7, $7)
         ON CONFLICT (card_id) DO UPDATE SET
           feature_json = EXCLUDED.feature_json,
           text_hash = EXCLUDED.text_hash,
           model_version = EXCLUDED.model_version,
           embedding_model = EXCLUDED.embedding_model,
           status = EXCLUDED.status,
           updated_at = EXCLUDED.updated_at
         RETURNING *`,
        [
          input.cardId,
          JSON.stringify(input.feature),
          input.textHash,
          input.modelVersion,
          input.embeddingModel ?? null,
          input.status ?? "active",
          now,
        ]
      )
    ).rows[0];
    return mapMealCardRecommendationFeature(row);
  },

  async markMealCardRecommendationFeatureStatus(cardId: string, status: MealCardRecommendationFeature["status"]): Promise<void> {
    await postgresPool.query(
      `UPDATE meal_card_recommendation_features
       SET status = $2, updated_at = $3
       WHERE card_id = $1`,
      [cardId, status, new Date().toISOString()]
    );
  },

  async listMealCardRecommendationFeatures(cardIds: string[]): Promise<MealCardRecommendationFeature[]> {
    if (!cardIds.length) return [];
    const rows = (
      await postgresPool.query<MealCardRecommendationFeatureRow>(
        `SELECT * FROM meal_card_recommendation_features
         WHERE card_id = ANY($1::text[])
           AND status = 'active'`,
        [cardIds]
      )
    ).rows;
    return rows.map(mapMealCardRecommendationFeature);
  },

  async upsertMealCardRecommendationCache(input: {
    userId: string;
    cardId: string;
    semanticScore: number;
    reasonTags: string[];
    featureVersion: string;
    sourceHash: string;
    expiresAt?: string;
  }): Promise<MealCardRecommendationCache> {
    const now = new Date().toISOString();
    const row = (
      await postgresPool.query<MealCardRecommendationCacheRow>(
        `INSERT INTO meal_card_recommendation_cache (
           user_id, card_id, semantic_score, reason_tags, feature_version, source_hash, expires_at, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
         ON CONFLICT (user_id, card_id) DO UPDATE SET
           semantic_score = EXCLUDED.semantic_score,
           reason_tags = EXCLUDED.reason_tags,
           feature_version = EXCLUDED.feature_version,
           source_hash = EXCLUDED.source_hash,
           expires_at = EXCLUDED.expires_at,
           updated_at = EXCLUDED.updated_at
         RETURNING *`,
        [
          input.userId,
          input.cardId,
          input.semanticScore,
          input.reasonTags,
          input.featureVersion,
          input.sourceHash,
          input.expiresAt ?? null,
          now,
        ]
      )
    ).rows[0];
    return mapMealCardRecommendationCache(row);
  },

  async listMealCardRecommendationCacheForUser(userId: string, cardIds: string[], now = new Date().toISOString()): Promise<MealCardRecommendationCache[]> {
    if (!cardIds.length) return [];
    const rows = (
      await postgresPool.query<MealCardRecommendationCacheRow>(
        `SELECT * FROM meal_card_recommendation_cache
         WHERE user_id = $1
           AND card_id = ANY($2::text[])
           AND (expires_at IS NULL OR expires_at > $3)`,
        [userId, cardIds, now]
      )
    ).rows;
    return rows.map(mapMealCardRecommendationCache);
  },

  async deleteMealCardRecommendationCacheForUser(userId: string): Promise<number> {
    const result = await postgresPool.query("DELETE FROM meal_card_recommendation_cache WHERE user_id = $1", [userId]);
    return result.rowCount ?? 0;
  },

  async deleteMealCardRecommendationCacheForCard(cardId: string): Promise<number> {
    const result = await postgresPool.query("DELETE FROM meal_card_recommendation_cache WHERE card_id = $1", [cardId]);
    return result.rowCount ?? 0;
  },

  async createMealCardRecommendationEvent(input: {
    id: string;
    userId: string;
    cardId?: string;
    authorUserId?: string;
    eventType: MealCardRecommendationEventType;
    rank?: number;
    matchScore?: number;
    reason?: string;
    source?: string;
    context?: Record<string, unknown>;
    createdAt?: string;
  }): Promise<MealCardRecommendationEvent> {
    const row = (
      await postgresPool.query<MealCardRecommendationEventRow>(
        `INSERT INTO meal_card_recommendation_events (
           id, user_id, card_id, author_user_id, event_type, rank, match_score, reason, source, context_json, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11)
         RETURNING *`,
        [
          input.id,
          input.userId,
          input.cardId ?? null,
          input.authorUserId ?? null,
          input.eventType,
          input.rank ?? null,
          input.matchScore ?? null,
          input.reason ?? null,
          input.source ?? "home",
          JSON.stringify(input.context ?? {}),
          input.createdAt ?? new Date().toISOString(),
        ]
      )
    ).rows[0];
    return mapMealCardRecommendationEvent(row);
  },

  async createMealCardRecommendationEvents(
    inputs: Array<{
      id: string;
      userId: string;
      cardId?: string;
      authorUserId?: string;
      eventType: MealCardRecommendationEventType;
      rank?: number;
      matchScore?: number;
      reason?: string;
      source?: string;
      context?: Record<string, unknown>;
      createdAt?: string;
    }>
  ): Promise<number> {
    if (!inputs.length) return 0;
    const values: unknown[] = [];
    const placeholders = inputs.map((input, index) => {
      const offset = index * 11;
      values.push(
        input.id,
        input.userId,
        input.cardId ?? null,
        input.authorUserId ?? null,
        input.eventType,
        input.rank ?? null,
        input.matchScore ?? null,
        input.reason ?? null,
        input.source ?? "home",
        JSON.stringify(input.context ?? {}),
        input.createdAt ?? new Date().toISOString()
      );
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}::jsonb, $${offset + 11})`;
    });
    const result = await postgresPool.query(
      `INSERT INTO meal_card_recommendation_events (
         id, user_id, card_id, author_user_id, event_type, rank, match_score, reason, source, context_json, created_at
       ) VALUES ${placeholders.join(", ")}`,
      values
    );
    return result.rowCount ?? 0;
  },

  async getMealCardRecommendationEventStats(since: string): Promise<
    Array<{
      day: string;
      eventType: MealCardRecommendationEventType;
      count: number;
      uniqueUsers: number;
      uniqueCards: number;
      averageRank?: number;
      averageMatchScore?: number;
    }>
  > {
    const rows = (
      await postgresPool.query<{
        day: string;
        event_type: string;
        count: string;
        unique_users: string;
        unique_cards: string;
        avg_rank: string | null;
        avg_match_score: string | null;
      }>(
        `SELECT date_trunc('day', created_at::timestamptz)::date::text AS day,
                event_type,
                COUNT(*)::text AS count,
                COUNT(DISTINCT user_id)::text AS unique_users,
                COUNT(DISTINCT card_id)::text AS unique_cards,
                ROUND(AVG(rank), 2)::text AS avg_rank,
                ROUND(AVG(match_score), 2)::text AS avg_match_score
         FROM meal_card_recommendation_events
         WHERE created_at >= $1
         GROUP BY day, event_type
         ORDER BY day DESC, event_type ASC`,
        [since]
      )
    ).rows;
    return rows.map((row) => ({
      day: row.day,
      eventType: parseMealCardRecommendationEventType(row.event_type),
      count: Number(row.count) || 0,
      uniqueUsers: Number(row.unique_users) || 0,
      uniqueCards: Number(row.unique_cards) || 0,
      averageRank: row.avg_rank === null ? undefined : Number(row.avg_rank),
      averageMatchScore: row.avg_match_score === null ? undefined : Number(row.avg_match_score),
    }));
  },

  async getUserAiProfile(userId: string): Promise<UserAiProfile> {
    const row = (await postgresPool.query<UserAiProfileRow>("SELECT * FROM user_ai_profiles WHERE user_id = $1", [userId])).rows[0];
    if (row) return mapUserAiProfile(row);
    return { userId, profile: {}, updatedAt: new Date(0).toISOString() };
  },

  async updateUserAiProfile(userId: string, profile: Record<string, unknown>): Promise<UserAiProfile> {
    const updatedAt = new Date().toISOString();
    const row = (
      await postgresPool.query<UserAiProfileRow>(
        `INSERT INTO user_ai_profiles (user_id, profile_json, updated_at)
         VALUES ($1, $2::jsonb, $3)
         ON CONFLICT (user_id) DO UPDATE SET profile_json = EXCLUDED.profile_json, updated_at = EXCLUDED.updated_at
         RETURNING *`,
        [userId, JSON.stringify(profile), updatedAt]
      )
    ).rows[0];
    return mapUserAiProfile(row);
  },

  async createAiRecommendationLog(input: {
    id: string;
    conversationId: string;
    requesterUserId: string;
    targetUserId?: string;
    jobId?: string;
    mode: AiSuggestionMode;
    provider: string;
    context: Record<string, unknown>;
    suggestions: string[];
  }): Promise<AiRecommendationLog> {
    const now = new Date().toISOString();
    const row = (
      await postgresPool.query<AiRecommendationLogRow>(
        `INSERT INTO ai_recommendation_logs (
           id, conversation_id, requester_user_id, target_user_id, job_id, mode, provider,
           context_json, suggestions_json, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, $10)
         RETURNING *`,
        [
          input.id,
          input.conversationId,
          input.requesterUserId,
          input.targetUserId ?? null,
          input.jobId ?? null,
          input.mode,
          input.provider,
          JSON.stringify(input.context),
          JSON.stringify(input.suggestions),
          now,
        ]
      )
    ).rows[0];
    return mapAiRecommendationLog(row);
  },

  async findAiRecommendationLog(id: string): Promise<AiRecommendationLog | undefined> {
    const row = (await postgresPool.query<AiRecommendationLogRow>("SELECT * FROM ai_recommendation_logs WHERE id = $1", [id])).rows[0];
    return mapOptional(row, mapAiRecommendationLog);
  },

  async updateAiRecommendationLog(input: {
    id: string;
    requesterUserId: string;
    selectedIndex?: number;
    selectedText?: string;
    sentMessageId?: string;
  }): Promise<AiRecommendationLog | undefined> {
    const current = await this.findAiRecommendationLog(input.id);
    if (!current || current.requesterUserId !== input.requesterUserId) return undefined;

    const row = (
      await postgresPool.query<AiRecommendationLogRow>(
        `UPDATE ai_recommendation_logs
         SET selected_index = COALESCE($3, selected_index),
             selected_text = COALESCE($4, selected_text),
             sent_message_id = COALESCE($5, sent_message_id),
             updated_at = $2
         WHERE id = $1
         RETURNING *`,
        [
          input.id,
          new Date().toISOString(),
          input.selectedIndex ?? null,
          input.selectedText ?? null,
          input.sentMessageId ?? null,
        ]
      )
    ).rows[0];
    return mapOptional(row, mapAiRecommendationLog);
  },

  async markAiRecommendationRecipientReply(input: {
    conversationId: string;
    replierUserId: string;
    repliedAt?: string;
    since?: string;
  }): Promise<number> {
    const repliedAt = input.repliedAt ?? new Date().toISOString();
    const since = input.since ?? new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const result = await postgresPool.query(
      `UPDATE ai_recommendation_logs
       SET recipient_replied_at = COALESCE(recipient_replied_at, $3),
           outcome_json = outcome_json || $5::jsonb,
           updated_at = $3
       WHERE conversation_id = $1
         AND target_user_id = $2
         AND requester_user_id <> $2
         AND sent_message_id IS NOT NULL
         AND recipient_replied_at IS NULL
         AND created_at >= $4`,
      [
        input.conversationId,
        input.replierUserId,
        repliedAt,
        since,
        JSON.stringify({ recipientReply: { repliedAt, replierUserId: input.replierUserId } }),
      ]
    );
    return result.rowCount ?? 0;
  },

  async markAiRecommendationAdvancedToMeal(input: {
    conversationId: string;
    requesterUserId: string;
    advancedAt?: string;
    outcome?: Record<string, unknown>;
    since?: string;
  }): Promise<number> {
    const advancedAt = input.advancedAt ?? new Date().toISOString();
    const since = input.since ?? new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const result = await postgresPool.query(
      `UPDATE ai_recommendation_logs
       SET advanced_to_meal_at = COALESCE(advanced_to_meal_at, $3),
           outcome_json = outcome_json || $5::jsonb,
           updated_at = $3
       WHERE conversation_id = $1
         AND requester_user_id = $2
         AND sent_message_id IS NOT NULL
         AND advanced_to_meal_at IS NULL
         AND created_at >= $4`,
      [
        input.conversationId,
        input.requesterUserId,
        advancedAt,
        since,
        JSON.stringify({ advancedToMeal: { advancedAt, ...(input.outcome ?? {}) } }),
      ]
    );
    return result.rowCount ?? 0;
  },

  async listRecentAiRecommendationLogs(userId: string, limit = 20): Promise<AiRecommendationLog[]> {
    const rows = (
      await postgresPool.query<AiRecommendationLogRow>(
        `SELECT * FROM ai_recommendation_logs
         WHERE requester_user_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [userId, limit]
      )
    ).rows;
    return rows.map(mapAiRecommendationLog);
  },

  async getAiSuggestionGovernanceStats() {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [jobRows, logRows, cacheRows, memoryRows] = await Promise.all([
      postgresPool.query<{
        status: string;
        count: string;
        avg_duration_ms: string | null;
      }>(
        `SELECT status,
                COUNT(*)::text AS count,
                ROUND(AVG(EXTRACT(EPOCH FROM (finished_at::timestamptz - started_at::timestamptz)) * 1000))::text AS avg_duration_ms
         FROM ai_suggestion_jobs
         WHERE created_at >= $1
         GROUP BY status`,
        [since]
      ),
      postgresPool.query<{
        total_exposures: string;
        selected_count: string;
        sent_count: string;
        recipient_reply_count: string;
        advanced_to_meal_count: string;
      }>(
        `SELECT COUNT(*)::text AS total_exposures,
                COUNT(selected_index)::text AS selected_count,
                COUNT(sent_message_id)::text AS sent_count,
                COUNT(recipient_replied_at)::text AS recipient_reply_count,
                COUNT(advanced_to_meal_at)::text AS advanced_to_meal_count
         FROM ai_recommendation_logs
         WHERE created_at >= $1`,
        [since]
      ),
      postgresPool.query<{ active_cache_count: string }>(
        "SELECT COUNT(*)::text AS active_cache_count FROM ai_suggestion_cache WHERE expires_at > $1",
        [new Date().toISOString()]
      ),
      postgresPool.query<{ memory_count: string; vector_count: string }>(
        `SELECT COUNT(*)::text AS memory_count,
                COUNT(NULLIF(embedding_json, '[]'::jsonb))::text AS vector_count
         FROM ai_memory_items
         WHERE status = 'active'`
      ),
    ]);

    const jobsByStatus = jobRows.rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = Number(row.count) || 0;
      return acc;
    }, {});
    const avgDurationMsByStatus = jobRows.rows.reduce<Record<string, number>>((acc, row) => {
      if (row.avg_duration_ms !== null) acc[row.status] = Number(row.avg_duration_ms) || 0;
      return acc;
    }, {});
    const logStats = logRows.rows[0] ?? {
      total_exposures: "0",
      selected_count: "0",
      sent_count: "0",
      recipient_reply_count: "0",
      advanced_to_meal_count: "0",
    };
    const cacheStats = cacheRows.rows[0] ?? { active_cache_count: "0" };
    const memoryStats = memoryRows.rows[0] ?? { memory_count: "0", vector_count: "0" };

    return {
      windowHours: 24,
      jobsByStatus,
      avgDurationMsByStatus,
      activeCacheCount: Number(cacheStats.active_cache_count) || 0,
      recommendationLogs: {
        exposures: Number(logStats.total_exposures) || 0,
        selected: Number(logStats.selected_count) || 0,
        sent: Number(logStats.sent_count) || 0,
        recipientReplies: Number(logStats.recipient_reply_count) || 0,
        advancedToMeal: Number(logStats.advanced_to_meal_count) || 0,
      },
      memory: {
        activeItems: Number(memoryStats.memory_count) || 0,
        vectorizedItems: Number(memoryStats.vector_count) || 0,
      },
    };
  },

  async listActiveMealCards() {
    const rows = (await postgresPool.query<MealCardRow>(`${mealCardSelectSql} WHERE mc.status = 'active' ORDER BY mc.created_at DESC`)).rows;
    return rows.map(mapMealCard);
  },

  async closeHomeExpiredMealCards(now = new Date()) {
    const rows = (await postgresPool.query<MealCardRow>(`${mealCardSelectSql} WHERE mc.status = 'active' ORDER BY mc.created_at DESC`)).rows;
    const expiredCards = rows.map(mapMealCard).filter((card) => !isMealCardVisibleOnHome(card, now));
    if (!expiredCards.length) return { closed: 0, cardIds: [] as string[] };

    const cardIds = expiredCards.map((card) => card.id);
    await postgresPool.query(
      "UPDATE meal_cards SET status = 'closed', updated_at = $1 WHERE id = ANY($2::text[]) AND status = 'active'",
      [now.toISOString(), cardIds]
    );
    return { closed: cardIds.length, cardIds };
  },

  async listMealCardsByUser(userId: string) {
    const rows = (
      await postgresPool.query<MealCardRow>(
        `${mealCardSelectSql} WHERE mc.user_id = $1 AND mc.status != 'deleted' ORDER BY mc.created_at DESC`,
        [userId]
      )
    ).rows;
    return rows.map(mapMealCard);
  },

  async findMealCard(id: string) {
    return mapOptional(
      (await postgresPool.query<MealCardRow>(`${mealCardSelectSql} WHERE mc.id = $1 AND mc.status != 'deleted'`, [id])).rows[0],
      mapMealCard
    );
  },

  async findActiveMealCard(id: string) {
    return mapOptional(
      (await postgresPool.query<MealCardRow>(`${mealCardSelectSql} WHERE mc.id = $1 AND mc.status = 'active'`, [id])).rows[0],
      mapMealCard
    );
  },

  async createMealCard(input: Omit<MealCard, "updatedAt"> & { updatedAt?: string }) {
    const createdAt = input.createdAt ?? new Date().toISOString();
    const updatedAt = input.updatedAt ?? createdAt;
    await postgresPool.query(
      `INSERT INTO meal_cards (
        id, user_id, nickname, avatar_text, verified, text, time, place, people,
        tags, match_score, reason, media_type, media_url, media_mime_type, status, edit_count, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
      [
        input.id,
        input.userId,
        input.nickname,
        input.avatarText,
        input.verified,
        input.text,
        input.time,
        input.place,
        input.people,
        JSON.stringify(input.tags),
        input.matchScore,
        input.reason,
        input.mediaType ?? null,
        input.mediaUrl ?? null,
        input.mediaMimeType ?? null,
        input.status,
        input.editCount ?? 0,
        createdAt,
        updatedAt,
      ]
    );
    return (await this.findMealCard(input.id))!;
  },

  async updateMealCard(
    id: string,
    patch: Partial<Pick<MealCard, "text" | "time" | "place" | "people" | "tags" | "matchScore" | "reason" | "mediaType" | "mediaUrl" | "mediaMimeType" | "status" | "editCount">>
  ) {
    const current = await this.findMealCard(id);
    if (!current) return undefined;

    const next = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    };

    await postgresPool.query(
      `UPDATE meal_cards SET
        text = $1, time = $2, place = $3, people = $4, tags = $5::jsonb,
        match_score = $6, reason = $7, media_type = $8, media_url = $9, media_mime_type = $10, status = $11, edit_count = $12, updated_at = $13
      WHERE id = $14`,
      [
        next.text,
        next.time,
        next.place,
        next.people,
        JSON.stringify(next.tags),
        next.matchScore,
        next.reason,
        next.mediaType ?? null,
        next.mediaUrl ?? null,
        next.mediaMimeType ?? null,
        next.status,
        next.editCount,
        next.updatedAt,
        id,
      ]
    );
    return this.findMealCard(id);
  },

  async listPublishedPosts() {
    const rows = (await postgresPool.query<CommunityPostRow>(`${postSelectSql} WHERE p.status = 'published' ORDER BY p.created_at DESC`)).rows;
    return rows.map(mapCommunityPost);
  },

  async listPublishedPostsByUser(userId: string) {
    const rows = (
      await postgresPool.query<CommunityPostRow>(
        `${postSelectSql} WHERE p.author_id = $1 AND p.status = 'published' ORDER BY p.created_at DESC`,
        [userId]
      )
    ).rows;
    return rows.map(mapCommunityPost);
  },

  async searchPublishedPosts(query: string, limit = 20, offset = 0) {
    const likeQuery = `%${query}%`;
    const prefixQuery = `${query}%`;
    const rows = (
      await postgresPool.query<CommunityPostRow>(
        `${postSelectSql}
         WHERE p.status = 'published'
           AND (
             p.title ILIKE $1 OR p.text ILIKE $1 OR p.author ILIKE $1 OR p.channel ILIKE $1
             OR p.topic ILIKE $1 OR p.place ILIKE $1
           )
         ORDER BY
           CASE
             WHEN p.title ILIKE $3 THEN 140
             WHEN p.author ILIKE $3 THEN 105
             WHEN p.title ILIKE $1 THEN 90
             WHEN p.topic ILIKE $1 OR p.channel ILIKE $1 THEN 70
             WHEN p.place ILIKE $1 THEN 55
             WHEN p.text ILIKE $1 THEN 40
             ELSE 10
           END DESC,
           (p.likes + p.favorites + p.comments * 2 + p.shares) DESC,
           p.created_at DESC
         LIMIT $2 OFFSET $4`,
        [likeQuery, limit, prefixQuery, offset]
      )
    ).rows;
    return rows.map(mapCommunityPost);
  },

  async searchActiveMealCards(query: string, limit = 20, offset = 0) {
    const likeQuery = `%${query}%`;
    const prefixQuery = `${query}%`;
    const rows = (
      await postgresPool.query<MealCardRow>(
        `${mealCardSelectSql}
         WHERE mc.status = 'active'
           AND (
             mc.nickname ILIKE $1 OR mc.text ILIKE $1 OR mc.time ILIKE $1 OR mc.place ILIKE $1
             OR mc.people ILIKE $1 OR mc.reason ILIKE $1 OR mc.tags::text ILIKE $1
           )
         ORDER BY
           CASE
             WHEN mc.nickname ILIKE $3 THEN 125
             WHEN mc.place ILIKE $3 THEN 105
             WHEN mc.tags::text ILIKE $1 THEN 85
             WHEN mc.text ILIKE $1 THEN 65
             WHEN mc.time ILIKE $1 OR mc.people ILIKE $1 THEN 45
             ELSE 10
           END DESC,
           mc.match_score DESC,
           mc.created_at DESC
         LIMIT $2 OFFSET $4`,
        [likeQuery, limit, prefixQuery, offset]
      )
    ).rows;
    return rows.map(mapMealCard);
  },

  async listSearchCandidates(limit = 200) {
    const [users, posts, cards] = await Promise.all([
      postgresPool.query<{ term: string }>(
        `SELECT DISTINCT term FROM (
          SELECT nickname AS term FROM users
          UNION ALL SELECT email AS term FROM users
          UNION ALL SELECT school AS term FROM users WHERE school IS NOT NULL
        ) t WHERE term IS NOT NULL AND term <> '' LIMIT $1`,
        [limit]
      ),
      postgresPool.query<{ term: string }>(
        `SELECT DISTINCT term FROM (
          SELECT title AS term FROM posts WHERE status = 'published'
          UNION ALL SELECT topic AS term FROM posts WHERE status = 'published'
          UNION ALL SELECT channel AS term FROM posts WHERE status = 'published'
          UNION ALL SELECT place AS term FROM posts WHERE status = 'published'
        ) t WHERE term IS NOT NULL AND term <> '' LIMIT $1`,
        [limit]
      ),
      postgresPool.query<{ term: string }>(
        `SELECT DISTINCT term FROM (
          SELECT nickname AS term FROM meal_cards WHERE status = 'active'
          UNION ALL SELECT place AS term FROM meal_cards WHERE status = 'active'
          UNION ALL SELECT jsonb_array_elements_text(tags) AS term FROM meal_cards WHERE status = 'active'
        ) t WHERE term IS NOT NULL AND term <> '' LIMIT $1`,
        [limit]
      ),
    ]);

    return [...users.rows, ...posts.rows, ...cards.rows].map((row) => row.term);
  },

  async listPostsByUser(userId: string) {
    const rows = (
      await postgresPool.query<CommunityPostRow>(
        `${postSelectSql} WHERE p.author_id = $1 AND p.status != 'deleted' ORDER BY p.created_at DESC`,
        [userId]
      )
    ).rows;
    return rows.map(mapCommunityPost);
  },

  async listLikedPostsByUser(userId: string) {
    const rows = (
      await postgresPool.query<CommunityPostRow>(
        `${postSelectColumnsSql}
         FROM likes l
         JOIN posts p ON p.id = l.post_id
         JOIN users u ON u.id = p.author_id
         WHERE l.user_id = $1 AND p.status = 'published'
         ORDER BY l.created_at DESC`,
        [userId]
      )
    ).rows;
    return rows.map(mapCommunityPost);
  },

  async listFavoritePostsByUser(userId: string) {
    const rows = (
      await postgresPool.query<CommunityPostRow>(
        `${postSelectColumnsSql}
         FROM favorites f
         JOIN posts p ON p.id = f.post_id
         JOIN users u ON u.id = p.author_id
         WHERE f.user_id = $1 AND p.status = 'published'
         ORDER BY f.created_at DESC`,
        [userId]
      )
    ).rows;
    return rows.map(mapCommunityPost);
  },

  async findPost(id: string) {
    return mapOptional(
      (await postgresPool.query<CommunityPostRow>(`${postSelectSql} WHERE p.id = $1 AND p.status != 'deleted'`, [id])).rows[0],
      mapCommunityPost
    );
  },

  async findPublishedPost(id: string) {
    return mapOptional(
      (await postgresPool.query<CommunityPostRow>(`${postSelectSql} WHERE p.id = $1 AND p.status = 'published'`, [id])).rows[0],
      mapCommunityPost
    );
  },

  async createPost(input: CommunityPost) {
    await postgresPool.query(
      `INSERT INTO posts (
        id, author_id, title, text, author, avatar, channel, topic, media_type,
        media_source, media_url, media_urls, media_poster_url, media_mime_type, place, likes, favorites, comments, shares, verified, hot,
        followed, nearby, status, edit_count, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)`,
      [
        input.id,
        input.authorId,
        input.title,
        input.text,
        input.author,
        input.avatar,
        input.channel,
        input.topic,
        input.mediaType,
        input.mediaSource,
        input.mediaUrl ?? null,
        JSON.stringify(input.mediaUrls ?? (input.mediaUrl ? [input.mediaUrl] : [])),
        input.mediaPosterUrl ?? null,
        input.mediaMimeType ?? null,
        input.place,
        input.likes,
        input.favorites,
        input.comments,
        input.shares,
        input.verified ?? false,
        input.hot ?? false,
        input.followed ?? false,
        input.nearby ?? false,
        input.status,
        input.editCount ?? 0,
        input.createdAt,
        input.updatedAt,
      ]
    );
    return (await this.findPost(input.id))!;
  },

  async updatePost(
    id: string,
    patch: Partial<
      Pick<
        CommunityPost,
        | "title"
        | "text"
        | "channel"
        | "topic"
        | "mediaType"
        | "mediaSource"
        | "mediaUrl"
        | "mediaUrls"
        | "mediaPosterUrl"
        | "mediaMimeType"
        | "place"
        | "likes"
        | "favorites"
        | "comments"
        | "shares"
        | "hot"
        | "followed"
        | "nearby"
        | "status"
        | "editCount"
      >
    >
  ) {
    const current = await this.findPost(id);
    if (!current) return undefined;

    const next = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    };

    await postgresPool.query(
      `UPDATE posts SET
        title = $1, text = $2, channel = $3, topic = $4, media_type = $5, media_source = $6,
        media_url = $7, media_urls = $8::jsonb, media_poster_url = $9, media_mime_type = $10, place = $11, likes = $12, favorites = $13, comments = $14, shares = $15, hot = $16,
        followed = $17, nearby = $18, status = $19, edit_count = $20, updated_at = $21
      WHERE id = $22`,
      [
        next.title,
        next.text,
        next.channel,
        next.topic,
        next.mediaType,
        next.mediaSource,
        next.mediaUrl ?? null,
        JSON.stringify(next.mediaUrls ?? (next.mediaUrl ? [next.mediaUrl] : [])),
        next.mediaPosterUrl ?? null,
        next.mediaMimeType ?? null,
        next.place,
        next.likes,
        next.favorites,
        next.comments,
        next.shares,
        next.hot ?? false,
        next.followed ?? false,
        next.nearby ?? false,
        next.status,
        next.editCount,
        next.updatedAt,
        id,
      ]
    );
    return this.findPost(id);
  },

  async listPublishedComments(postId: string) {
    const rows = (
      await postgresPool.query<CommunityCommentRow>(
        `${commentSelectSql} WHERE c.post_id = $1 AND c.status = 'published' ORDER BY c.created_at ASC`,
        [postId]
      )
    ).rows;
    return rows.map(mapCommunityComment);
  },

  async findComment(id: string) {
    return mapOptional(
      (await postgresPool.query<CommunityCommentRow>(`${commentSelectSql} WHERE c.id = $1 AND c.status != 'deleted'`, [id])).rows[0],
      mapCommunityComment
    );
  },

  async listCommentsByUser(userId: string) {
    const rows = (
      await postgresPool.query<CommunityCommentRow>(
        `${commentSelectSql} WHERE c.author_id = $1 AND c.status = 'published' ORDER BY c.created_at DESC`,
        [userId]
      )
    ).rows;
    return rows.map(mapCommunityComment);
  },

  async listLikedCommentsByUser(userId: string) {
    const rows = (
      await postgresPool.query<CommunityCommentRow>(
        `${commentSelectColumnsSql}
         FROM comment_likes l
         JOIN comments c ON c.id = l.comment_id
         JOIN users u ON u.id = c.author_id
         WHERE l.user_id = $1 AND c.status = 'published'
         ORDER BY l.created_at DESC`,
        [userId]
      )
    ).rows;
    return rows.map(mapCommunityComment);
  },

  async listFavoriteCommentsByUser(userId: string) {
    const rows = (
      await postgresPool.query<CommunityCommentRow>(
        `${commentSelectColumnsSql}
         FROM comment_favorites f
         JOIN comments c ON c.id = f.comment_id
         JOIN users u ON u.id = c.author_id
         WHERE f.user_id = $1 AND c.status = 'published'
         ORDER BY f.created_at DESC`,
        [userId]
      )
    ).rows;
    return rows.map(mapCommunityComment);
  },

  async getInteractionIds(userId: string) {
    const [likedPosts, favoritePosts, likedComments, favoriteComments] = await Promise.all([
      postgresPool.query<{ id: string }>("SELECT post_id AS id FROM likes WHERE user_id = $1", [userId]),
      postgresPool.query<{ id: string }>("SELECT post_id AS id FROM favorites WHERE user_id = $1", [userId]),
      postgresPool.query<{ id: string }>("SELECT comment_id AS id FROM comment_likes WHERE user_id = $1", [userId]),
      postgresPool.query<{ id: string }>("SELECT comment_id AS id FROM comment_favorites WHERE user_id = $1", [userId]),
    ]);
    return {
      likedPostIds: likedPosts.rows.map((row) => row.id),
      favoritePostIds: favoritePosts.rows.map((row) => row.id),
      likedCommentIds: likedComments.rows.map((row) => row.id),
      favoriteCommentIds: favoriteComments.rows.map((row) => row.id),
    };
  },

  async createComment(input: CommunityComment) {
    await postgresPool.query(
      `INSERT INTO comments (
        id, post_id, author_id, author, avatar, text, parent_comment_id, reply_to_user_id, reply_to_author,
        likes, favorites, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        input.id,
        input.postId,
        input.authorId,
        input.author,
        input.avatar,
        input.text,
        input.parentCommentId ?? null,
        input.replyToUserId ?? null,
        input.replyToAuthor ?? null,
        input.likes,
        input.favorites ?? 0,
        input.status,
        input.createdAt,
        input.updatedAt,
      ]
    );
    return (await this.findComment(input.id))!;
  },

  async updateComment(id: string, patch: Partial<Pick<CommunityComment, "text" | "likes" | "favorites" | "status">>) {
    const current = await this.findComment(id);
    if (!current) return undefined;

    const next = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    };

    await postgresPool.query("UPDATE comments SET text = $1, likes = $2, favorites = $3, status = $4, updated_at = $5 WHERE id = $6", [
      next.text,
      next.likes,
      next.favorites ?? 0,
      next.status,
      next.updatedAt,
      id,
    ]);
    return this.findComment(id);
  },

  async setCommentLike(userId: string, commentId: string, enabled: boolean) {
    const comment = await this.findComment(commentId);
    if (!comment) return undefined;

    const createdAt = new Date().toISOString();
    if (enabled) {
      const inserted = await postgresPool.query(
        "INSERT INTO comment_likes (user_id, comment_id, created_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING comment_id",
        [userId, commentId, createdAt]
      );
      if (inserted.rowCount) {
        await postgresPool.query("UPDATE comments SET likes = likes + 1, updated_at = $1 WHERE id = $2", [createdAt, commentId]);
      }
    } else {
      const deleted = await postgresPool.query("DELETE FROM comment_likes WHERE user_id = $1 AND comment_id = $2 RETURNING comment_id", [
        userId,
        commentId,
      ]);
      if (deleted.rowCount) {
        await postgresPool.query("UPDATE comments SET likes = GREATEST(0, likes - 1), updated_at = $1 WHERE id = $2", [createdAt, commentId]);
      }
    }

    return this.findComment(commentId);
  },

  async setCommentFavorite(userId: string, commentId: string, enabled: boolean) {
    const comment = await this.findComment(commentId);
    if (!comment) return undefined;

    const createdAt = new Date().toISOString();
    if (enabled) {
      const inserted = await postgresPool.query(
        "INSERT INTO comment_favorites (user_id, comment_id, created_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING comment_id",
        [userId, commentId, createdAt]
      );
      if (inserted.rowCount) {
        await postgresPool.query("UPDATE comments SET favorites = favorites + 1, updated_at = $1 WHERE id = $2", [createdAt, commentId]);
      }
    } else {
      const deleted = await postgresPool.query(
        "DELETE FROM comment_favorites WHERE user_id = $1 AND comment_id = $2 RETURNING comment_id",
        [userId, commentId]
      );
      if (deleted.rowCount) {
        await postgresPool.query("UPDATE comments SET favorites = GREATEST(0, favorites - 1), updated_at = $1 WHERE id = $2", [
          createdAt,
          commentId,
        ]);
      }
    }

    return this.findComment(commentId);
  },

  async getFollowSummary(viewerUserId: string, targetUserId: string) {
    const [following, followedBy, followerCount, followingCount] = await Promise.all([
      postgresPool.query("SELECT 1 FROM follows WHERE follower_user_id = $1 AND following_user_id = $2", [viewerUserId, targetUserId]),
      postgresPool.query("SELECT 1 FROM follows WHERE follower_user_id = $1 AND following_user_id = $2", [targetUserId, viewerUserId]),
      postgresPool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM follows WHERE following_user_id = $1", [targetUserId]),
      postgresPool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM follows WHERE follower_user_id = $1", [targetUserId]),
    ]);
    return {
      following: Boolean(following.rows[0]),
      followedBy: Boolean(followedBy.rows[0]),
      mutual: Boolean(following.rows[0] && followedBy.rows[0]),
      followerCount: Number(followerCount.rows[0]?.count ?? 0),
      followingCount: Number(followingCount.rows[0]?.count ?? 0),
    };
  },

  async listBlockedUserIdsFor(userId: string) {
    const rows = (
      await postgresPool.query<{ blocked_user_id: string }>(
        "SELECT blocked_user_id FROM blocks WHERE blocker_user_id = $1",
        [userId]
      )
    ).rows;
    return rows.map((row) => row.blocked_user_id);
  },

  async listRelatedBlockedUserIdsFor(userId: string) {
    const rows = (
      await postgresPool.query<{ user_id: string }>(
        `SELECT blocked_user_id AS user_id FROM blocks WHERE blocker_user_id = $1
         UNION
         SELECT blocker_user_id AS user_id FROM blocks WHERE blocked_user_id = $1`,
        [userId]
      )
    ).rows;
    return rows.map((row) => row.user_id);
  },

  async listBlockedUsersFor(userId: string) {
    const rows = (
      await postgresPool.query<UserRow & { blocked_at: string }>(
        `SELECT u.*, b.created_at AS blocked_at
         FROM blocks b
         JOIN users u ON u.id = b.blocked_user_id
         WHERE b.blocker_user_id = $1
         ORDER BY b.created_at DESC`,
        [userId]
      )
    ).rows;
    return rows.map((row) => ({
      user: mapUser(row),
      blockedAt: row.blocked_at,
    }));
  },

  async getBlockSummary(viewerUserId: string, targetUserId: string) {
    const [blocked, blockedBy] = await Promise.all([
      postgresPool.query("SELECT 1 FROM blocks WHERE blocker_user_id = $1 AND blocked_user_id = $2", [viewerUserId, targetUserId]),
      postgresPool.query("SELECT 1 FROM blocks WHERE blocker_user_id = $1 AND blocked_user_id = $2", [targetUserId, viewerUserId]),
    ]);
    return {
      blocked: Boolean(blocked.rows[0]),
      blockedBy: Boolean(blockedBy.rows[0]),
      blockedEither: Boolean(blocked.rows[0] || blockedBy.rows[0]),
    };
  },

  async hasDirectMessageBetween(userAId: string, userBId: string) {
    const row = (
      await postgresPool.query<{ exists: number }>(
        `SELECT 1 AS exists
         FROM conversations c
         JOIN conversation_members cma ON cma.conversation_id = c.id AND cma.user_id = $1
         JOIN conversation_members cmb ON cmb.conversation_id = c.id AND cmb.user_id = $2
         JOIN messages m ON m.conversation_id = c.id
         WHERE c.conversation_type = 'direct'
         LIMIT 1`,
        [userAId, userBId]
      )
    ).rows[0];
    return Boolean(row);
  },

  async countReportsForTargets(targetType: Report["targetType"], targetIds: string[]) {
    if (!targetIds.length) return {};
    const rows = (
      await postgresPool.query<{ target_id: string; count: string }>(
        `SELECT target_id, COUNT(*)::text AS count
         FROM reports
         WHERE target_type = $1 AND target_id = ANY($2::text[]) AND status IN ('pending', 'approved')
         GROUP BY target_id`,
        [targetType, targetIds]
      )
    ).rows;

    return Object.fromEntries(rows.map((row) => [row.target_id, Number(row.count)]));
  },

  async setPostLike(userId: string, postId: string, enabled: boolean) {
    const post = await this.findPublishedPost(postId);
    if (!post) return undefined;

    const createdAt = new Date().toISOString();
    if (enabled) {
      const inserted = await postgresPool.query(
        "INSERT INTO likes (user_id, post_id, created_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING post_id",
        [userId, postId, createdAt]
      );
      if (inserted.rowCount) {
        await postgresPool.query("UPDATE posts SET likes = likes + 1, updated_at = $1 WHERE id = $2", [createdAt, postId]);
      }
    } else {
      const deleted = await postgresPool.query("DELETE FROM likes WHERE user_id = $1 AND post_id = $2 RETURNING post_id", [
        userId,
        postId,
      ]);
      if (deleted.rowCount) {
        await postgresPool.query("UPDATE posts SET likes = GREATEST(0, likes - 1), updated_at = $1 WHERE id = $2", [createdAt, postId]);
      }
    }

    return this.findPublishedPost(postId);
  },

  async setPostFavorite(userId: string, postId: string, enabled: boolean) {
    const post = await this.findPublishedPost(postId);
    if (!post) return undefined;

    const createdAt = new Date().toISOString();
    if (enabled) {
      const inserted = await postgresPool.query(
        "INSERT INTO favorites (user_id, post_id, created_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING post_id",
        [userId, postId, createdAt]
      );
      if (inserted.rowCount) {
        await postgresPool.query("UPDATE posts SET favorites = favorites + 1, updated_at = $1 WHERE id = $2", [createdAt, postId]);
      }
    } else {
      const deleted = await postgresPool.query("DELETE FROM favorites WHERE user_id = $1 AND post_id = $2 RETURNING post_id", [
        userId,
        postId,
      ]);
      if (deleted.rowCount) {
        await postgresPool.query("UPDATE posts SET favorites = GREATEST(0, favorites - 1), updated_at = $1 WHERE id = $2", [
          createdAt,
          postId,
        ]);
      }
    }

    return this.findPublishedPost(postId);
  },

  async setFollow(followerUserId: string, followingUserId: string, enabled: boolean) {
    if (enabled) {
      await postgresPool.query(
        "INSERT INTO follows (follower_user_id, following_user_id, created_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
        [followerUserId, followingUserId, new Date().toISOString()]
      );
      return;
    }

    await postgresPool.query("DELETE FROM follows WHERE follower_user_id = $1 AND following_user_id = $2", [
      followerUserId,
      followingUserId,
    ]);
  },

  async listFollowedUsers(userId: string) {
    const rows = (
      await postgresPool.query<UserRow>(
        `SELECT u.*
         FROM follows f
         JOIN users u ON u.id = f.following_user_id
         WHERE f.follower_user_id = $1
         ORDER BY f.created_at DESC`,
        [userId]
      )
    ).rows;
    return rows.map(mapUser);
  },

  async listFollowers(userId: string) {
    const rows = (
      await postgresPool.query<UserRow>(
        `SELECT u.*
         FROM follows f
         JOIN users u ON u.id = f.follower_user_id
         WHERE f.following_user_id = $1
         ORDER BY f.created_at DESC`,
        [userId]
      )
    ).rows;
    return rows.map(mapUser);
  },

  async setBlock(blockerUserId: string, blockedUserId: string, enabled: boolean) {
    if (enabled) {
      const client = await postgresPool.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          "INSERT INTO blocks (blocker_user_id, blocked_user_id, created_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
          [blockerUserId, blockedUserId, new Date().toISOString()]
        );
        await client.query(
          `DELETE FROM follows
           WHERE (follower_user_id = $1 AND following_user_id = $2)
              OR (follower_user_id = $2 AND following_user_id = $1)`,
          [blockerUserId, blockedUserId]
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
      return;
    }

    await postgresPool.query("DELETE FROM blocks WHERE blocker_user_id = $1 AND blocked_user_id = $2", [
      blockerUserId,
      blockedUserId,
    ]);
  },

  async createReport(input: Report) {
    await postgresPool.query(
      `INSERT INTO reports (
        id, reporter_user_id, target_type, target_id, reason, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        input.id,
        input.reporterUserId,
        input.targetType,
        input.targetId,
        input.reason,
        input.status,
        input.createdAt,
        input.updatedAt,
      ]
    );
    return (await this.findReport(input.id))!;
  },

  async listReports() {
    const rows = (await postgresPool.query<ReportRow>("SELECT * FROM reports ORDER BY created_at DESC")).rows;
    return rows.map(mapReport);
  },

  async findReport(id: string) {
    return mapOptional((await postgresPool.query<ReportRow>("SELECT * FROM reports WHERE id = $1", [id])).rows[0], mapReport);
  },

  async updateReport(id: string, patch: Pick<Report, "status">) {
    const current = await this.findReport(id);
    if (!current) return undefined;

    await postgresPool.query("UPDATE reports SET status = $1, updated_at = $2 WHERE id = $3", [
      patch.status,
      new Date().toISOString(),
      id,
    ]);
    return this.findReport(id);
  },

  async createNotification(input: Notification) {
    await postgresPool.query(
      `INSERT INTO notifications (
        id, user_id, type, actor_user_id, target_type, target_id, text, created_at, read_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        input.id,
        input.userId,
        input.type,
        input.actorUserId ?? null,
        input.targetType ?? null,
        input.targetId ?? null,
        input.text,
        input.createdAt,
        input.readAt ?? null,
      ]
    );
    return this.findNotification(input.id);
  },

  async listNotifications(userId: string) {
    const rows = (
      await postgresPool.query<NotificationRow>("SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC", [
        userId,
      ])
    ).rows;
    return enrichNotifications(rows.map(mapNotification));
  },

  async findNotification(id: string) {
    const row = (await postgresPool.query<NotificationRow>("SELECT * FROM notifications WHERE id = $1", [id])).rows[0];
    if (!row) return undefined;
    const [notification] = await enrichNotifications([mapNotification(row)]);
    return notification;
  },

  async markNotificationRead(id: string, userId: string) {
    const readAt = new Date().toISOString();
    await postgresPool.query("UPDATE notifications SET read_at = COALESCE(read_at, $1) WHERE id = $2 AND user_id = $3", [
      readAt,
      id,
      userId,
    ]);
    return this.findNotification(id);
  },

  async markAllNotificationsRead(userId: string) {
    const readAt = new Date().toISOString();
    await postgresPool.query("UPDATE notifications SET read_at = COALESCE(read_at, $1) WHERE user_id = $2", [readAt, userId]);
    return this.listNotifications(userId);
  },

  async listConversationsForUser(userId: string) {
    const rows = (
      await postgresPool.query<ConversationRow>(
        `SELECT c.*
         FROM conversations c
         JOIN conversation_members cm ON cm.conversation_id = c.id
         WHERE cm.user_id = $1
         ORDER BY c.updated_at DESC`,
        [userId]
      )
    ).rows;
    return Promise.all(rows.map(async (row) => mapConversation(row, await this.listConversationMembers(row.id))));
  },

  async findConversation(id: string) {
    const row = (await postgresPool.query<ConversationRow>("SELECT * FROM conversations WHERE id = $1", [id])).rows[0];
    return row ? mapConversation(row, await this.listConversationMembers(row.id)) : undefined;
  },

  async findConversationForMembers(memberUserIds: string[]) {
    const sortedIds = [...new Set(memberUserIds)].sort();
    const rows = (await postgresPool.query<ConversationRow>("SELECT * FROM conversations WHERE conversation_type = 'direct'")).rows;
    for (const row of rows) {
      const members = (await this.listConversationMembers(row.id)).map((member) => member.user_id).sort();
      if (members.length === sortedIds.length && members.every((memberId, index) => memberId === sortedIds[index])) {
        return mapConversation(row, await this.listConversationMembers(row.id));
      }
    }
    return undefined;
  },

  async createConversation(input: {
    id: string;
    memberUserIds: string[];
    title: string;
    preview?: string;
    createdAt?: string;
    conversationType?: Conversation["conversationType"];
    avatarText?: string;
    avatarUrl?: string;
    description?: string;
    category?: string;
    location?: string;
    joinQuestion?: string;
    isPublic?: boolean;
    ownerUserId?: string;
  }) {
    const createdAt = input.createdAt ?? new Date().toISOString();
    const memberUserIds = Array.from(new Set(input.memberUserIds));
    const client = await postgresPool.connect();

    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO conversations (
          id, title, preview, conversation_type, avatar_text, avatar_url, description, category, location,
          join_question, is_public, owner_user_id, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          input.id,
          input.title,
          input.preview ?? "",
          input.conversationType ?? "direct",
          input.avatarText ?? null,
          input.avatarUrl ?? null,
          input.description ?? null,
          input.category ?? null,
          input.location ?? null,
          input.joinQuestion ?? null,
          input.isPublic ?? false,
          input.ownerUserId ?? null,
          createdAt,
          createdAt,
        ]
      );
      for (const userId of memberUserIds) {
        await client.query(
          "INSERT INTO conversation_members (conversation_id, user_id, unread_count, joined_at) VALUES ($1, $2, 0, $3)",
          [input.id, userId, createdAt]
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    return (await this.findConversation(input.id))!;
  },

  async updateConversation(
    id: string,
    patch: Partial<Pick<Conversation, "title" | "avatarText" | "avatarUrl" | "description" | "category" | "location" | "joinQuestion" | "isPublic">>
  ) {
    const current = await this.findConversation(id);
    if (!current) return undefined;

    const next = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    };

    await postgresPool.query(
      `UPDATE conversations SET
        title = $1, avatar_text = $2, avatar_url = $3, description = $4, category = $5,
        location = $6, join_question = $7, is_public = $8, updated_at = $9
      WHERE id = $10`,
      [
        next.title,
        next.avatarText ?? null,
        next.avatarUrl ?? null,
        next.description ?? null,
        next.category ?? null,
        next.location ?? null,
        next.joinQuestion ?? null,
        next.isPublic ?? false,
        next.updatedAt,
        id,
      ]
    );
    return this.findConversation(id);
  },

  async listPublicGroupConversations(query = "", category = "", limit = 30) {
    const likeQuery = `%${query}%`;
    const categoryQuery = category.trim();
    const rows = (
      await postgresPool.query<ConversationRow>(
        `SELECT * FROM conversations
         WHERE conversation_type = 'group'
           AND is_public = true
           AND ($1 = '' OR title ILIKE $2 OR COALESCE(description, '') ILIKE $2 OR COALESCE(category, '') ILIKE $2 OR COALESCE(location, '') ILIKE $2)
           AND ($3 = '' OR category = $3)
         ORDER BY updated_at DESC
         LIMIT $4`,
        [query.trim(), likeQuery, categoryQuery, limit]
      )
    ).rows;
    return Promise.all(rows.map(async (row) => mapConversation(row, await this.listConversationMembers(row.id))));
  },

  async addConversationMember(conversationId: string, userId: string) {
    const joinedAt = new Date().toISOString();
    await postgresPool.query(
      `INSERT INTO conversation_members (conversation_id, user_id, unread_count, joined_at)
       VALUES ($1, $2, 0, $3)
       ON CONFLICT DO NOTHING`,
      [conversationId, userId, joinedAt]
    );
    await postgresPool.query("UPDATE conversations SET updated_at = $1 WHERE id = $2", [joinedAt, conversationId]);
    return this.findConversation(conversationId);
  },

  async removeConversationMember(conversationId: string, userId: string) {
    const current = await this.findConversation(conversationId);
    if (!current) return undefined;

    const updatedAt = new Date().toISOString();
    const client = await postgresPool.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM conversation_members WHERE conversation_id = $1 AND user_id = $2", [conversationId, userId]);
      const remaining = (
        await client.query<ConversationMemberRow>(
          "SELECT * FROM conversation_members WHERE conversation_id = $1 ORDER BY joined_at ASC",
          [conversationId]
        )
      ).rows;
      const nextOwnerUserId =
        current.ownerUserId === userId
          ? remaining[0]?.user_id ?? null
          : current.ownerUserId ?? null;
      await client.query(
        "UPDATE conversations SET owner_user_id = $1, is_public = CASE WHEN $2::int = 0 THEN false ELSE is_public END, updated_at = $3 WHERE id = $4",
        [nextOwnerUserId, remaining.length, updatedAt, conversationId]
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    return this.findConversation(conversationId);
  },

  async listConversationMemberUsers(conversationId: string) {
    const rows = (
      await postgresPool.query<UserRow>(
        `SELECT u.*
         FROM conversation_members cm
         JOIN users u ON u.id = cm.user_id
         WHERE cm.conversation_id = $1
         ORDER BY cm.joined_at ASC`,
        [conversationId]
      )
    ).rows;
    return rows.map(mapUser);
  },

  async listConversationMembers(conversationId: string) {
    const rows = (
      await postgresPool.query<ConversationMemberRow>(
        "SELECT * FROM conversation_members WHERE conversation_id = $1 ORDER BY joined_at ASC",
        [conversationId]
      )
    ).rows;
    return rows;
  },

  async isConversationMember(conversationId: string, userId: string) {
    return Boolean(
      (await postgresPool.query("SELECT 1 FROM conversation_members WHERE conversation_id = $1 AND user_id = $2", [
        conversationId,
        userId,
      ])).rows[0]
    );
  },

  async listMessages(conversationId: string) {
    const rows = (
      await postgresPool.query<MessageRow>("SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC", [
        conversationId,
      ])
    ).rows;
    return Promise.all(rows.map(async (row) => mapMessage(row, await this.listMessageReadUserIds(row.id))));
  },

  async deleteMessages(conversationId: string, messageIds: string[]) {
    if (!messageIds.length) return 0;
    const client = await postgresPool.connect();
    try {
      await client.query("BEGIN");
      const deleted = await client.query(
        "DELETE FROM messages WHERE conversation_id = $1 AND id = ANY($2::text[])",
        [conversationId, messageIds]
      );
      await refreshConversationPreview(client, conversationId);
      await client.query("COMMIT");
      return deleted.rowCount ?? 0;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  async deleteAllMessages(conversationId: string) {
    const client = await postgresPool.connect();
    try {
      await client.query("BEGIN");
      const deleted = await client.query("DELETE FROM messages WHERE conversation_id = $1", [conversationId]);
      await client.query("UPDATE conversations SET preview = '', updated_at = $1 WHERE id = $2", [
        new Date().toISOString(),
        conversationId,
      ]);
      await client.query("UPDATE conversation_members SET unread_count = 0 WHERE conversation_id = $1", [conversationId]);
      await client.query("COMMIT");
      return deleted.rowCount ?? 0;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  async createMessage(input: {
    id: string;
    conversationId: string;
    senderUserId: string;
    type: MessageType;
    text: string;
    metadata?: Record<string, unknown>;
    createdAt?: string;
  }) {
    const createdAt = input.createdAt ?? new Date().toISOString();
    const client = await postgresPool.connect();

    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO messages (id, conversation_id, sender_user_id, type, text, metadata, created_at, revoked_at)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, NULL)`,
        [
          input.id,
          input.conversationId,
          input.senderUserId,
          input.type,
          input.text,
          JSON.stringify(input.metadata ?? {}),
          createdAt,
        ]
      );
      await client.query(
        "INSERT INTO message_reads (message_id, user_id, read_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
        [input.id, input.senderUserId, createdAt]
      );
      await client.query("UPDATE conversations SET preview = $1, updated_at = $2 WHERE id = $3", [
        input.text,
        createdAt,
        input.conversationId,
      ]);
      await client.query(
        "UPDATE conversation_members SET unread_count = unread_count + 1 WHERE conversation_id = $1 AND user_id != $2",
        [input.conversationId, input.senderUserId]
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    return (await this.findMessage(input.id))!;
  },

  async findMessage(id: string) {
    const row = (await postgresPool.query<MessageRow>("SELECT * FROM messages WHERE id = $1", [id])).rows[0];
    return row ? mapMessage(row, await this.listMessageReadUserIds(row.id)) : undefined;
  },

  async listMessageReadUserIds(messageId: string) {
    const rows = (await postgresPool.query<{ user_id: string }>("SELECT user_id FROM message_reads WHERE message_id = $1", [messageId])).rows;
    return rows.map((row) => row.user_id);
  },

  async markConversationRead(conversationId: string, userId: string) {
    const readAt = new Date().toISOString();
    await postgresPool.query(
      `INSERT INTO message_reads (message_id, user_id, read_at)
       SELECT id, $1, $2 FROM messages WHERE conversation_id = $3
       ON CONFLICT DO NOTHING`,
      [userId, readAt, conversationId]
    );
    await postgresPool.query("UPDATE conversation_members SET unread_count = 0 WHERE conversation_id = $1 AND user_id = $2", [
      conversationId,
      userId,
    ]);
    return this.findConversation(conversationId);
  },

  async revokeMessage(messageId: string, userId: string) {
    const message = await this.findMessage(messageId);
    if (!message || message.senderUserId !== userId || message.revokedAt) return message;

    const revokedAt = new Date().toISOString();
    await postgresPool.query(
      "UPDATE messages SET text = '', metadata = '{}'::jsonb, revoked_at = $1 WHERE id = $2 AND sender_user_id = $3",
      [revokedAt, messageId, userId]
    );
    return this.findMessage(messageId);
  },

  async createExchangeRequest(input: MealExchangeRequest) {
    await postgresPool.query(
      `INSERT INTO exchange_requests (
        id, sender_user_id, receiver_user_id, target_card_id, own_card_id,
        conversation_id, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        input.id,
        input.senderUserId,
        input.receiverUserId,
        input.targetCardId,
        input.ownCardId ?? null,
        input.conversationId,
        input.status,
        input.createdAt,
        input.updatedAt,
      ]
    );
    return (await this.findExchangeRequest(input.id))!;
  },

  async findExchangeRequest(id: string) {
    return mapOptional(
      (await postgresPool.query<ExchangeRequestRow>("SELECT * FROM exchange_requests WHERE id = $1", [id])).rows[0],
      mapExchangeRequest
    );
  },

  async listExchangeRequestsForConversation(conversationId: string) {
    const rows = (
      await postgresPool.query<ExchangeRequestRow>(
        "SELECT * FROM exchange_requests WHERE conversation_id = $1 ORDER BY created_at ASC",
        [conversationId]
      )
    ).rows;
    return rows.map(mapExchangeRequest);
  },

  async listExchangeRequestsForUser(userId: string) {
    const rows = (
      await postgresPool.query<ExchangeRequestRow>(
        `SELECT * FROM exchange_requests
         WHERE sender_user_id = $1 OR receiver_user_id = $1
         ORDER BY updated_at DESC
         LIMIT 200`,
        [userId]
      )
    ).rows;
    return rows.map(mapExchangeRequest);
  },

  async updateExchangeRequestStatus(id: string, status: "accepted" | "rejected") {
    await postgresPool.query("UPDATE exchange_requests SET status = $1, updated_at = $2 WHERE id = $3", [
      status,
      new Date().toISOString(),
      id,
    ]);
    return this.findExchangeRequest(id);
  },
};

async function initializeOptionalPgvector() {
  if (process.env.AI_PGVECTOR_ENABLED === "false") return;

  try {
    await postgresPool.query("CREATE EXTENSION IF NOT EXISTS vector");
    await postgresPool.query("ALTER TABLE ai_memory_items ADD COLUMN IF NOT EXISTS embedding_vector vector(64)");
    await postgresPool.query(
      "CREATE INDEX IF NOT EXISTS idx_ai_memory_items_embedding_vector ON ai_memory_items USING hnsw (embedding_vector vector_cosine_ops)"
    );
    const realEmbeddingDimensions = getRealEmbeddingVectorDimensions();
    if (realEmbeddingDimensions > 0) {
      await postgresPool.query(`ALTER TABLE ai_memory_items ADD COLUMN IF NOT EXISTS embedding_vector_v2 vector(${realEmbeddingDimensions})`);
      await postgresPool.query(
        "CREATE INDEX IF NOT EXISTS idx_ai_memory_items_embedding_vector_v2 ON ai_memory_items USING hnsw (embedding_vector_v2 vector_cosine_ops)"
      );
    }
  } catch (error) {
    console.warn("pgvector is not available; AI memory recall will use JSON embeddings fallback.", error);
  }
}

function redactDatabaseUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.password) parsed.password = "*****";
    return `${parsed.protocol}//${parsed.username ? `${parsed.username}@` : ""}${parsed.host}${parsed.pathname}`;
  } catch {
    return "postgresql://configured";
  }
}

function toVectorLiteral(embedding: number[]) {
  return `[${embedding.map((value) => Number(value).toFixed(6)).join(",")}]`;
}

function getEmbeddingVectorColumn(embedding: number[], embeddingModel?: string) {
  if (embedding.length === 64 && (!embeddingModel || embeddingModel === "local-hash-embedding-v1")) return "embedding_vector";
  const realEmbeddingDimensions = getRealEmbeddingVectorDimensions();
  if (realEmbeddingDimensions > 0 && embedding.length === realEmbeddingDimensions && embeddingModel?.startsWith("ollama:")) {
    return "embedding_vector_v2";
  }
  return undefined;
}

function getRealEmbeddingVectorDimensions() {
  const configured = readPositiveInteger(process.env.AI_EMBEDDING_VECTOR_DIMENSIONS, 0);
  if (configured > 0) return configured;
  if ((process.env.OLLAMA_EMBEDDING_MODEL || "bge-m3") === "bge-m3") return 1024;
  return 0;
}

function readPositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

async function refreshConversationPreview(client: pg.PoolClient, conversationId: string) {
  const latest = (
    await client.query<MessageRow>(
      "SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 1",
      [conversationId]
    )
  ).rows[0];
  await client.query("UPDATE conversations SET preview = $1, updated_at = $2 WHERE id = $3", [
    latest?.text ?? "",
    latest?.created_at ?? new Date().toISOString(),
    conversationId,
  ]);
}

async function enrichNotifications(notifications: Notification[]) {
  return Promise.all(
    notifications.map(async (notification) => {
      const [actor, targetPost, commentContext] = await Promise.all([
        notification.actorUserId ? postgresStore.findUserById(notification.actorUserId) : undefined,
        notification.targetType === "post" && notification.targetId ? postgresStore.findPost(notification.targetId) : undefined,
        resolveNotificationCommentContext(notification),
      ]);

      const resolvedPost = commentContext.targetPost ?? targetPost;
      return {
        ...notification,
        actor: actor
          ? {
              id: actor.id,
              nickname: actor.nickname,
              avatarText: actor.avatarText,
              avatarUrl: actor.avatarUrl,
              verified: actor.verified,
            }
          : undefined,
        targetPost: resolvedPost,
        targetComment: commentContext.targetComment,
        parentComment: commentContext.parentComment,
      };
    })
  );
}

async function resolveNotificationCommentContext(notification: Notification) {
  let targetComment: CommunityComment | undefined;

  if (notification.targetType === "comment" && notification.targetId) {
    targetComment = await postgresStore.findComment(notification.targetId);
  }

  if (!targetComment && notification.type === "comment" && notification.targetType === "post" && notification.targetId && notification.actorUserId) {
    targetComment = await findNearestNotificationComment({
      postId: notification.targetId,
      actorUserId: notification.actorUserId,
      createdAt: notification.createdAt,
    });
  }

  const [targetPost, parentComment] = await Promise.all([
    targetComment ? postgresStore.findPost(targetComment.postId) : undefined,
    targetComment?.parentCommentId ? postgresStore.findComment(targetComment.parentCommentId) : undefined,
  ]);

  return { targetComment, parentComment, targetPost };
}

async function findNearestNotificationComment(input: { postId: string; actorUserId: string; createdAt: string }) {
  const row = (
    await postgresPool.query<CommunityCommentRow>(
      `${commentSelectSql}
       WHERE c.post_id = $1
         AND c.author_id = $2
         AND c.status = 'published'
       ORDER BY ABS(EXTRACT(EPOCH FROM (c.created_at::timestamptz - $3::timestamptz))) ASC
       LIMIT 1`,
      [input.postId, input.actorUserId, input.createdAt]
    )
  ).rows[0];
  return mapOptional(row, mapCommunityComment);
}

