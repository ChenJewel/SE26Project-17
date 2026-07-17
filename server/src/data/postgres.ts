import pg from "pg";
import type {
  CommunityComment,
  CommunityPost,
  Conversation,
  MealCard,
  MealExchangeRequest,
  Message,
  MessageType,
  Notification,
  Report,
  User,
  UserSettings,
} from "../types.js";

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
    CREATE INDEX IF NOT EXISTS idx_conversation_members_user_id ON conversation_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_messages_conversation_created_at ON messages(conversation_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_exchange_requests_conversation_id ON exchange_requests(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_exchange_requests_receiver ON exchange_requests(receiver_user_id, status);
  `);

  await postgresPool.query("ALTER TABLE comments ADD COLUMN IF NOT EXISTS favorites INTEGER NOT NULL DEFAULT 0");
  await postgresPool.query("ALTER TABLE messages ADD COLUMN IF NOT EXISTS revoked_at TEXT");
  await postgresPool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT");
  await postgresPool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'");
  await postgresPool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN NOT NULL DEFAULT true");
  await postgresPool.query("ALTER TABLE posts ADD COLUMN IF NOT EXISTS media_url TEXT");
  await postgresPool.query("ALTER TABLE posts ADD COLUMN IF NOT EXISTS media_urls JSONB NOT NULL DEFAULT '[]'::jsonb");
  await postgresPool.query("ALTER TABLE posts ADD COLUMN IF NOT EXISTS media_mime_type TEXT");
  await postgresPool.query("ALTER TABLE comments ADD COLUMN IF NOT EXISTS parent_comment_id TEXT REFERENCES comments(id) ON DELETE SET NULL");
  await postgresPool.query("ALTER TABLE comments ADD COLUMN IF NOT EXISTS reply_to_user_id TEXT REFERENCES users(id) ON DELETE SET NULL");
  await postgresPool.query("ALTER TABLE comments ADD COLUMN IF NOT EXISTS reply_to_author TEXT");
  await postgresPool.query("ALTER TABLE meal_cards ADD COLUMN IF NOT EXISTS media_type TEXT");
  await postgresPool.query("ALTER TABLE meal_cards ADD COLUMN IF NOT EXISTS media_url TEXT");
  await postgresPool.query("ALTER TABLE meal_cards ADD COLUMN IF NOT EXISTS media_mime_type TEXT");
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
}

export const postgresStore = {
  getDatabaseInfo() {
    return redactDatabaseUrl(databaseUrl);
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

  async listActiveMealCards() {
    const rows = (await postgresPool.query<MealCardRow>(`${mealCardSelectSql} WHERE mc.status = 'active' ORDER BY mc.created_at DESC`)).rows;
    return rows.map(mapMealCard);
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
        tags, match_score, reason, media_type, media_url, media_mime_type, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, $13, $14, $15, $16, $17, $18)`,
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
        createdAt,
        updatedAt,
      ]
    );
    return (await this.findMealCard(input.id))!;
  },

  async updateMealCard(
    id: string,
    patch: Partial<Pick<MealCard, "text" | "time" | "place" | "people" | "tags" | "matchScore" | "reason" | "mediaType" | "mediaUrl" | "mediaMimeType" | "status">>
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
        match_score = $6, reason = $7, media_type = $8, media_url = $9, media_mime_type = $10, status = $11, updated_at = $12
      WHERE id = $13`,
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
        media_source, media_url, media_urls, media_mime_type, place, likes, favorites, comments, shares, verified, hot,
        followed, nearby, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)`,
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
        media_url = $7, media_urls = $8::jsonb, media_mime_type = $9, place = $10, likes = $11, favorites = $12, comments = $13, shares = $14, hot = $15,
        followed = $16, nearby = $17, status = $18, updated_at = $19
      WHERE id = $20`,
      [
        next.title,
        next.text,
        next.channel,
        next.topic,
        next.mediaType,
        next.mediaSource,
        next.mediaUrl ?? null,
        JSON.stringify(next.mediaUrls ?? (next.mediaUrl ? [next.mediaUrl] : [])),
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
      await postgresPool.query(
        "INSERT INTO blocks (blocker_user_id, blocked_user_id, created_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
        [blockerUserId, blockedUserId, new Date().toISOString()]
      );
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
    return rows.map(mapNotification);
  },

  async findNotification(id: string) {
    return mapOptional(
      (await postgresPool.query<NotificationRow>("SELECT * FROM notifications WHERE id = $1", [id])).rows[0],
      mapNotification
    );
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

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  role: string;
  nickname: string;
  avatar_text: string;
  avatar_url: string | null;
  verified: boolean;
  school: string | null;
  bio: string | null;
  preference_tags: unknown;
  profile_completed: boolean;
  created_at: string;
  updated_at: string;
}

interface MealCardRow {
  id: string;
  user_id: string;
  nickname: string;
  avatar_text: string;
  verified: boolean;
  text: string;
  time: string;
  place: string;
  people: string;
  tags: unknown;
  match_score: number;
  reason: string;
  media_type: "photo" | "video" | null;
  media_url: string | null;
  media_mime_type: string | null;
  status: "active" | "closed" | "deleted";
  created_at: string;
  updated_at: string;
  user_nickname?: string;
  user_avatar_text?: string;
  user_avatar_url?: string | null;
  user_verified?: boolean;
}

interface CommunityPostRow {
  id: string;
  author_id: string;
  title: string;
  text: string;
  author: string;
  avatar: string;
  channel: string;
  topic: string;
  media_type: "text" | "photo" | "video";
  media_source: "text" | "album" | "camera";
  media_url: string | null;
  media_urls: unknown;
  media_mime_type: string | null;
  place: string;
  likes: number;
  favorites: number;
  comments: number;
  shares: number;
  verified: boolean;
  hot: boolean;
  followed: boolean;
  nearby: boolean;
  status: "published" | "deleted";
  created_at: string;
  updated_at: string;
  user_nickname?: string;
  user_avatar_text?: string;
  user_avatar_url?: string | null;
  user_verified?: boolean;
}

interface CommunityCommentRow {
  id: string;
  post_id: string;
  author_id: string;
  author: string;
  avatar: string;
  text: string;
  parent_comment_id: string | null;
  reply_to_user_id: string | null;
  reply_to_author: string | null;
  likes: number;
  favorites: number;
  status: "published" | "deleted";
  created_at: string;
  updated_at: string;
  user_nickname?: string;
  user_avatar_text?: string;
  user_avatar_url?: string | null;
}

interface ReportRow {
  id: string;
  reporter_user_id: string;
  target_type: "post" | "comment" | "meal-card" | "user";
  target_id: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  updated_at: string;
}

interface NotificationRow {
  id: string;
  user_id: string;
  type: "follow" | "comment" | "like" | "favorite" | "report" | "message";
  actor_user_id: string | null;
  target_type: "post" | "comment" | "meal-card" | "conversation" | "user" | null;
  target_id: string | null;
  text: string;
  created_at: string;
  read_at: string | null;
}

interface ConversationRow {
  id: string;
  title: string;
  preview: string;
  conversation_type: "direct" | "group";
  avatar_text: string | null;
  avatar_url: string | null;
  description: string | null;
  category: string | null;
  location: string | null;
  join_question: string | null;
  is_public: boolean;
  owner_user_id: string | null;
  created_at: string;
  updated_at: string;
}

interface ConversationMemberRow {
  conversation_id: string;
  user_id: string;
  unread_count: number;
  joined_at: string;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  sender_user_id: string;
  type: MessageType;
  text: string;
  metadata: unknown;
  created_at: string;
  revoked_at: string | null;
}

interface ExchangeRequestRow {
  id: string;
  sender_user_id: string;
  receiver_user_id: string;
  target_card_id: string;
  own_card_id: string | null;
  conversation_id: string;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
  updated_at: string;
}

interface UserSettingsRow {
  user_id: string;
  settings: unknown;
  updated_at: string;
}

function mapOptional<Row, Entity>(row: Row | undefined, mapper: (row: Row) => Entity) {
  return row ? mapper(row) : undefined;
}

function mapUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role === "admin" ? "admin" : "user",
    nickname: row.nickname,
    avatarText: row.avatar_text,
    avatarUrl: row.avatar_url ?? undefined,
    verified: row.verified,
    school: row.school ?? undefined,
    bio: row.bio ?? undefined,
    preferenceTags: parseStringArray(row.preference_tags),
    profileCompleted: row.profile_completed,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMealCard(row: MealCardRow): MealCard {
  return {
    id: row.id,
    userId: row.user_id,
    nickname: row.user_nickname ?? row.nickname,
    avatarText: row.user_avatar_text ?? row.avatar_text,
    avatarUrl: row.user_avatar_url ?? undefined,
    verified: row.user_verified ?? row.verified,
    text: row.text,
    time: row.time,
    place: row.place,
    people: row.people,
    tags: parseStringArray(row.tags),
    matchScore: row.match_score,
    reason: row.reason,
    mediaType: row.media_type ?? undefined,
    mediaUrl: row.media_url ?? undefined,
    mediaMimeType: row.media_mime_type ?? undefined,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCommunityPost(row: CommunityPostRow): CommunityPost {
  return {
    id: row.id,
    authorId: row.author_id,
    title: row.title,
    text: row.text,
    author: row.user_nickname ?? row.author,
    avatar: row.user_avatar_text ?? row.avatar,
    avatarUrl: row.user_avatar_url ?? undefined,
    channel: row.channel,
    topic: row.topic,
    mediaType: row.media_type,
    mediaSource: row.media_source,
    mediaUrl: row.media_url ?? undefined,
    mediaUrls: parseStringArray(row.media_urls),
    mediaMimeType: row.media_mime_type ?? undefined,
    place: row.place,
    likes: row.likes,
    favorites: row.favorites,
    comments: row.comments,
    shares: row.shares,
    verified: row.user_verified ?? row.verified,
    hot: row.hot,
    followed: row.followed,
    nearby: row.nearby,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCommunityComment(row: CommunityCommentRow): CommunityComment {
  return {
    id: row.id,
    postId: row.post_id,
    authorId: row.author_id,
    author: row.user_nickname ?? row.author,
    avatar: row.user_avatar_text ?? row.avatar,
    avatarUrl: row.user_avatar_url ?? undefined,
    text: row.text,
    parentCommentId: row.parent_comment_id ?? undefined,
    replyToUserId: row.reply_to_user_id ?? undefined,
    replyToAuthor: row.reply_to_author ?? undefined,
    likes: row.likes,
    favorites: row.favorites,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapReport(row: ReportRow): Report {
  return {
    id: row.id,
    reporterUserId: row.reporter_user_id,
    targetType: row.target_type,
    targetId: row.target_id,
    reason: row.reason,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    actorUserId: row.actor_user_id ?? undefined,
    targetType: row.target_type ?? undefined,
    targetId: row.target_id ?? undefined,
    text: row.text,
    createdAt: row.created_at,
    readAt: row.read_at ?? undefined,
  };
}

function mapConversation(row: ConversationRow, members: ConversationMemberRow[]): Conversation {
  return {
    id: row.id,
    memberUserIds: members.map((member) => member.user_id),
    title: row.title,
    preview: row.preview,
    conversationType: row.conversation_type === "group" ? "group" : "direct",
    avatarText: row.avatar_text ?? undefined,
    avatarUrl: row.avatar_url ?? undefined,
    description: row.description ?? undefined,
    category: row.category ?? undefined,
    location: row.location ?? undefined,
    joinQuestion: row.join_question ?? undefined,
    isPublic: row.is_public,
    ownerUserId: row.owner_user_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    unreadByUserId: Object.fromEntries(members.map((member) => [member.user_id, member.unread_count])),
  };
}

function mapMessage(row: MessageRow, readByUserIds: string[]): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderUserId: row.sender_user_id,
    type: row.type,
    text: row.text,
    metadata: parseRecord(row.metadata),
    createdAt: row.created_at,
    readByUserIds,
    ...(row.revoked_at ? { revokedAt: row.revoked_at } : {}),
  };
}

function mapExchangeRequest(row: ExchangeRequestRow): MealExchangeRequest {
  return {
    id: row.id,
    senderUserId: row.sender_user_id,
    receiverUserId: row.receiver_user_id,
    targetCardId: row.target_card_id,
    ownCardId: row.own_card_id ?? undefined,
    conversationId: row.conversation_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapUserSettings(row: UserSettingsRow): UserSettings {
  return {
    userId: row.user_id,
    settings: parseRecord(row.settings),
    updatedAt: row.updated_at,
  };
}

function parseStringArray(value: unknown) {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value !== "string") return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function parseRecord(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== "string") return {};

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
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

