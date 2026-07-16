import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { CommunityComment, CommunityPost, Conversation, MealCard, MealExchangeRequest, Message, MessageType, Notification, Report, User } from "../types.js";

export const sqliteDatabasePath = resolve(process.cwd(), "data", "ueat-dev.sqlite");

mkdirSync(dirname(sqliteDatabasePath), { recursive: true });

const database = new DatabaseSync(sqliteDatabasePath);
database.exec("PRAGMA foreign_keys = ON;");

database.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    nickname TEXT NOT NULL,
    avatar_text TEXT NOT NULL,
    avatar_url TEXT,
    verified INTEGER NOT NULL DEFAULT 0,
    school TEXT,
    bio TEXT,
    preference_tags TEXT NOT NULL DEFAULT '[]',
    profile_completed INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS meal_cards (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    nickname TEXT NOT NULL,
    avatar_text TEXT NOT NULL,
    verified INTEGER NOT NULL DEFAULT 0,
    text TEXT NOT NULL,
    time TEXT NOT NULL,
    place TEXT NOT NULL,
    people TEXT NOT NULL,
    tags TEXT NOT NULL DEFAULT '[]',
    match_score INTEGER NOT NULL DEFAULT 80,
    reason TEXT NOT NULL,
    media_type TEXT,
    media_url TEXT,
    media_mime_type TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_meal_cards_user_id ON meal_cards(user_id);
  CREATE INDEX IF NOT EXISTS idx_meal_cards_status ON meal_cards(status);

  CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    author_id TEXT NOT NULL,
    title TEXT NOT NULL,
    text TEXT NOT NULL,
    author TEXT NOT NULL,
    avatar TEXT NOT NULL,
    channel TEXT NOT NULL,
    topic TEXT NOT NULL,
    media_type TEXT NOT NULL DEFAULT 'text',
    media_source TEXT NOT NULL DEFAULT 'text',
    media_url TEXT,
    media_mime_type TEXT,
    place TEXT NOT NULL,
    likes INTEGER NOT NULL DEFAULT 0,
    favorites INTEGER NOT NULL DEFAULT 0,
    comments INTEGER NOT NULL DEFAULT 0,
    shares INTEGER NOT NULL DEFAULT 0,
    verified INTEGER NOT NULL DEFAULT 0,
    hot INTEGER NOT NULL DEFAULT 0,
    followed INTEGER NOT NULL DEFAULT 0,
    nearby INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'published',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL,
    author_id TEXT NOT NULL,
    author TEXT NOT NULL,
    avatar TEXT NOT NULL,
    text TEXT NOT NULL,
    likes INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'published',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_posts_author_id ON posts(author_id);
  CREATE INDEX IF NOT EXISTS idx_posts_status_created_at ON posts(status, created_at);
  CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
  CREATE INDEX IF NOT EXISTS idx_comments_status ON comments(status);

  CREATE TABLE IF NOT EXISTS likes (
    user_id TEXT NOT NULL,
    post_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, post_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS favorites (
    user_id TEXT NOT NULL,
    post_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, post_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS follows (
    follower_user_id TEXT NOT NULL,
    following_user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (follower_user_id, following_user_id),
    FOREIGN KEY (follower_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (following_user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS blocks (
    blocker_user_id TEXT NOT NULL,
    blocked_user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (blocker_user_id, blocked_user_id),
    FOREIGN KEY (blocker_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (blocked_user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    reporter_user_id TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (reporter_user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    actor_user_id TEXT,
    target_type TEXT,
    target_id TEXT,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL,
    read_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_likes_post_id ON likes(post_id);
  CREATE INDEX IF NOT EXISTS idx_favorites_post_id ON favorites(post_id);
  CREATE INDEX IF NOT EXISTS idx_follows_following_user_id ON follows(following_user_id);
  CREATE INDEX IF NOT EXISTS idx_blocks_blocked_user_id ON blocks(blocked_user_id);
  CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
  CREATE INDEX IF NOT EXISTS idx_notifications_user_created_at ON notifications(user_id, created_at);

  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    preview TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS conversation_members (
    conversation_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    unread_count INTEGER NOT NULL DEFAULT 0,
    joined_at TEXT NOT NULL,
    PRIMARY KEY (conversation_id, user_id),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    sender_user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    text TEXT NOT NULL,
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS message_reads (
    message_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    read_at TEXT NOT NULL,
    PRIMARY KEY (message_id, user_id),
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS exchange_requests (
    id TEXT PRIMARY KEY,
    sender_user_id TEXT NOT NULL,
    receiver_user_id TEXT NOT NULL,
    target_card_id TEXT NOT NULL,
    own_card_id TEXT,
    conversation_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (sender_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (receiver_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (target_card_id) REFERENCES meal_cards(id) ON DELETE CASCADE,
    FOREIGN KEY (own_card_id) REFERENCES meal_cards(id) ON DELETE SET NULL,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_conversation_members_user_id ON conversation_members(user_id);
  CREATE INDEX IF NOT EXISTS idx_messages_conversation_created_at ON messages(conversation_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_exchange_requests_conversation_id ON exchange_requests(conversation_id);
  CREATE INDEX IF NOT EXISTS idx_exchange_requests_receiver ON exchange_requests(receiver_user_id, status);
`);

try {
  database.exec("ALTER TABLE users ADD COLUMN avatar_url TEXT;");
} catch {
  // Column already exists in an upgraded local database.
}

try {
  database.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';");
} catch {
  // Column already exists in an upgraded local database.
}

try {
  database.exec("ALTER TABLE users ADD COLUMN profile_completed INTEGER NOT NULL DEFAULT 1;");
} catch {
  // Column already exists in an upgraded local database.
}

try {
  database.exec("ALTER TABLE posts ADD COLUMN media_url TEXT;");
} catch {
  // Column already exists in an upgraded local database.
}

try {
  database.exec("ALTER TABLE posts ADD COLUMN media_mime_type TEXT;");
} catch {
  // Column already exists in an upgraded local database.
}

try {
  database.exec("ALTER TABLE meal_cards ADD COLUMN media_type TEXT;");
} catch {
  // Column already exists in an upgraded local database.
}

try {
  database.exec("ALTER TABLE meal_cards ADD COLUMN media_url TEXT;");
} catch {
  // Column already exists in an upgraded local database.
}

try {
  database.exec("ALTER TABLE meal_cards ADD COLUMN media_mime_type TEXT;");
} catch {
  // Column already exists in an upgraded local database.
}

export const sqliteStore = {
  getDatabasePath() {
    return sqliteDatabasePath;
  },

  findUserById(id: string) {
    const row = database.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
    return row ? mapUser(row) : undefined;
  },

  findUserByEmail(email: string) {
    const row = database.prepare("SELECT * FROM users WHERE email = ?").get(email) as UserRow | undefined;
    return row ? mapUser(row) : undefined;
  },

  createUser(input: {
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
    database
      .prepare(
        `INSERT INTO users (
          id, email, password_hash, role, nickname, avatar_text, avatar_url, verified, school, bio,
          preference_tags, profile_completed, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.id,
        input.email,
        input.passwordHash,
        input.role ?? "user",
        input.nickname,
        input.avatarText,
        input.avatarUrl ?? null,
        input.verified ? 1 : 0,
        input.school ?? null,
        input.bio ?? null,
        JSON.stringify(input.preferenceTags ?? []),
        input.profileCompleted === false ? 0 : 1,
        createdAt,
        createdAt
      );

    return this.findUserById(input.id)!;
  },

  verifyUser(id: string) {
    database
      .prepare("UPDATE users SET verified = 1, updated_at = ? WHERE id = ?")
      .run(new Date().toISOString(), id);
    return this.findUserById(id)!;
  },

  updateUser(
    id: string,
    patch: Partial<Pick<User, "nickname" | "avatarText" | "avatarUrl" | "school" | "bio" | "preferenceTags" | "profileCompleted">>
  ) {
    const current = this.findUserById(id);
    if (!current) return undefined;

    const next = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    };

    database
      .prepare(
        `UPDATE users SET
          nickname = ?, avatar_text = ?, avatar_url = ?, school = ?, bio = ?, preference_tags = ?, profile_completed = ?, updated_at = ?
        WHERE id = ?`
      )
      .run(
        next.nickname,
        next.avatarText,
        next.avatarUrl ?? null,
        next.school ?? null,
        next.bio ?? null,
        JSON.stringify(next.preferenceTags),
        next.profileCompleted ? 1 : 0,
        next.updatedAt,
        id
      );

    return this.findUserById(id);
  },

  listActiveMealCards() {
    const rows = database
      .prepare("SELECT * FROM meal_cards WHERE status = 'active' ORDER BY created_at DESC")
      .all() as unknown as MealCardRow[];
    return rows.map(mapMealCard);
  },

  listMealCardsByUser(userId: string) {
    const rows = database
      .prepare("SELECT * FROM meal_cards WHERE user_id = ? AND status != 'deleted' ORDER BY created_at DESC")
      .all(userId) as unknown as MealCardRow[];
    return rows.map(mapMealCard);
  },

  findMealCard(id: string) {
    const row = database
      .prepare("SELECT * FROM meal_cards WHERE id = ? AND status != 'deleted'")
      .get(id) as MealCardRow | undefined;
    return row ? mapMealCard(row) : undefined;
  },

  findActiveMealCard(id: string) {
    const row = database
      .prepare("SELECT * FROM meal_cards WHERE id = ? AND status = 'active'")
      .get(id) as MealCardRow | undefined;
    return row ? mapMealCard(row) : undefined;
  },

  createMealCard(input: Omit<MealCard, "updatedAt"> & { updatedAt?: string }) {
    const createdAt = input.createdAt ?? new Date().toISOString();
    const updatedAt = input.updatedAt ?? createdAt;
    database
      .prepare(
        `INSERT INTO meal_cards (
          id, user_id, nickname, avatar_text, verified, text, time, place, people,
          tags, match_score, reason, media_type, media_url, media_mime_type, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.id,
        input.userId,
        input.nickname,
        input.avatarText,
        input.verified ? 1 : 0,
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
        updatedAt
      );

    return this.findMealCard(input.id)!;
  },

  updateMealCard(id: string, patch: Partial<Pick<MealCard, "text" | "time" | "place" | "people" | "tags" | "matchScore" | "reason" | "mediaType" | "mediaUrl" | "mediaMimeType" | "status">>) {
    const current = this.findMealCard(id);
    if (!current) return undefined;

    const next = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    };

    database
      .prepare(
        `UPDATE meal_cards SET
          text = ?, time = ?, place = ?, people = ?, tags = ?, match_score = ?,
          reason = ?, media_type = ?, media_url = ?, media_mime_type = ?, status = ?, updated_at = ?
        WHERE id = ?`
      )
      .run(
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
        id
      );

    return this.findMealCard(id);
  },

  listPublishedPosts() {
    const rows = database
      .prepare("SELECT * FROM posts WHERE status = 'published' ORDER BY created_at DESC")
      .all() as unknown as CommunityPostRow[];
    return rows.map(mapCommunityPost);
  },

  listPostsByUser(userId: string) {
    const rows = database
      .prepare("SELECT * FROM posts WHERE author_id = ? AND status != 'deleted' ORDER BY created_at DESC")
      .all(userId) as unknown as CommunityPostRow[];
    return rows.map(mapCommunityPost);
  },

  findPost(id: string) {
    const row = database
      .prepare("SELECT * FROM posts WHERE id = ? AND status != 'deleted'")
      .get(id) as CommunityPostRow | undefined;
    return row ? mapCommunityPost(row) : undefined;
  },

  findPublishedPost(id: string) {
    const row = database
      .prepare("SELECT * FROM posts WHERE id = ? AND status = 'published'")
      .get(id) as CommunityPostRow | undefined;
    return row ? mapCommunityPost(row) : undefined;
  },

  createPost(input: CommunityPost) {
    database
      .prepare(
        `INSERT INTO posts (
          id, author_id, title, text, author, avatar, channel, topic, media_type,
          media_source, media_url, media_mime_type, place, likes, favorites, comments, shares, verified, hot,
          followed, nearby, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
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
        input.mediaMimeType ?? null,
        input.place,
        input.likes,
        input.favorites,
        input.comments,
        input.shares,
        input.verified ? 1 : 0,
        input.hot ? 1 : 0,
        input.followed ? 1 : 0,
        input.nearby ? 1 : 0,
        input.status,
        input.createdAt,
        input.updatedAt
      );

    return this.findPost(input.id)!;
  },

  updatePost(
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
    const current = this.findPost(id);
    if (!current) return undefined;

    const next = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    };

    database
      .prepare(
        `UPDATE posts SET
          title = ?, text = ?, channel = ?, topic = ?, media_type = ?, media_source = ?,
          media_url = ?, media_mime_type = ?, place = ?, likes = ?, favorites = ?, comments = ?, shares = ?, hot = ?,
          followed = ?, nearby = ?, status = ?, updated_at = ?
        WHERE id = ?`
      )
      .run(
        next.title,
        next.text,
        next.channel,
        next.topic,
        next.mediaType,
        next.mediaSource,
        next.mediaUrl ?? null,
        next.mediaMimeType ?? null,
        next.place,
        next.likes,
        next.favorites,
        next.comments,
        next.shares,
        next.hot ? 1 : 0,
        next.followed ? 1 : 0,
        next.nearby ? 1 : 0,
        next.status,
        next.updatedAt,
        id
      );

    return this.findPost(id);
  },

  listPublishedComments(postId: string) {
    const rows = database
      .prepare("SELECT * FROM comments WHERE post_id = ? AND status = 'published' ORDER BY created_at ASC")
      .all(postId) as unknown as CommunityCommentRow[];
    return rows.map(mapCommunityComment);
  },

  findComment(id: string) {
    const row = database
      .prepare("SELECT * FROM comments WHERE id = ? AND status != 'deleted'")
      .get(id) as CommunityCommentRow | undefined;
    return row ? mapCommunityComment(row) : undefined;
  },

  createComment(input: CommunityComment) {
    database
      .prepare(
        `INSERT INTO comments (
          id, post_id, author_id, author, avatar, text, likes, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.id,
        input.postId,
        input.authorId,
        input.author,
        input.avatar,
        input.text,
        input.likes,
        input.status,
        input.createdAt,
        input.updatedAt
      );

    return this.findComment(input.id)!;
  },

  updateComment(id: string, patch: Partial<Pick<CommunityComment, "text" | "likes" | "status">>) {
    const current = this.findComment(id);
    if (!current) return undefined;

    const next = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    };

    database
      .prepare("UPDATE comments SET text = ?, likes = ?, status = ?, updated_at = ? WHERE id = ?")
      .run(next.text, next.likes, next.status, next.updatedAt, id);

    return this.findComment(id);
  },

  setPostLike(userId: string, postId: string, enabled: boolean) {
    const post = this.findPublishedPost(postId);
    if (!post) return undefined;

    const hadValue = Boolean(
      database.prepare("SELECT 1 FROM likes WHERE user_id = ? AND post_id = ?").get(userId, postId)
    );
    if (enabled && !hadValue) {
      database.prepare("INSERT INTO likes (user_id, post_id, created_at) VALUES (?, ?, ?)").run(userId, postId, new Date().toISOString());
      return this.updatePost(postId, { likes: post.likes + 1 });
    }

    if (!enabled && hadValue) {
      database.prepare("DELETE FROM likes WHERE user_id = ? AND post_id = ?").run(userId, postId);
      return this.updatePost(postId, { likes: Math.max(0, post.likes - 1) });
    }

    return post;
  },

  setPostFavorite(userId: string, postId: string, enabled: boolean) {
    const post = this.findPublishedPost(postId);
    if (!post) return undefined;

    const hadValue = Boolean(
      database.prepare("SELECT 1 FROM favorites WHERE user_id = ? AND post_id = ?").get(userId, postId)
    );
    if (enabled && !hadValue) {
      database.prepare("INSERT INTO favorites (user_id, post_id, created_at) VALUES (?, ?, ?)").run(userId, postId, new Date().toISOString());
      return this.updatePost(postId, { favorites: post.favorites + 1 });
    }

    if (!enabled && hadValue) {
      database.prepare("DELETE FROM favorites WHERE user_id = ? AND post_id = ?").run(userId, postId);
      return this.updatePost(postId, { favorites: Math.max(0, post.favorites - 1) });
    }

    return post;
  },

  setFollow(followerUserId: string, followingUserId: string, enabled: boolean) {
    if (enabled) {
      database
        .prepare("INSERT OR IGNORE INTO follows (follower_user_id, following_user_id, created_at) VALUES (?, ?, ?)")
        .run(followerUserId, followingUserId, new Date().toISOString());
    } else {
      database
        .prepare("DELETE FROM follows WHERE follower_user_id = ? AND following_user_id = ?")
        .run(followerUserId, followingUserId);
    }
  },

  setBlock(blockerUserId: string, blockedUserId: string, enabled: boolean) {
    if (enabled) {
      database
        .prepare("INSERT OR IGNORE INTO blocks (blocker_user_id, blocked_user_id, created_at) VALUES (?, ?, ?)")
        .run(blockerUserId, blockedUserId, new Date().toISOString());
    } else {
      database
        .prepare("DELETE FROM blocks WHERE blocker_user_id = ? AND blocked_user_id = ?")
        .run(blockerUserId, blockedUserId);
    }
  },

  createReport(input: Report) {
    database
      .prepare(
        `INSERT INTO reports (
          id, reporter_user_id, target_type, target_id, reason, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.id,
        input.reporterUserId,
        input.targetType,
        input.targetId,
        input.reason,
        input.status,
        input.createdAt,
        input.updatedAt
      );

    return this.findReport(input.id)!;
  },

  listReports() {
    const rows = database.prepare("SELECT * FROM reports ORDER BY created_at DESC").all() as unknown as ReportRow[];
    return rows.map(mapReport);
  },

  findReport(id: string) {
    const row = database.prepare("SELECT * FROM reports WHERE id = ?").get(id) as ReportRow | undefined;
    return row ? mapReport(row) : undefined;
  },

  updateReport(id: string, patch: Pick<Report, "status">) {
    const current = this.findReport(id);
    if (!current) return undefined;

    database
      .prepare("UPDATE reports SET status = ?, updated_at = ? WHERE id = ?")
      .run(patch.status, new Date().toISOString(), id);

    return this.findReport(id);
  },

  createNotification(input: Notification) {
    database
      .prepare(
        `INSERT INTO notifications (
          id, user_id, type, actor_user_id, target_type, target_id, text, created_at, read_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.id,
        input.userId,
        input.type,
        input.actorUserId ?? null,
        input.targetType ?? null,
        input.targetId ?? null,
        input.text,
        input.createdAt,
        input.readAt ?? null
      );

    return this.findNotification(input.id);
  },

  listNotifications(userId: string) {
    const rows = database
      .prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC")
      .all(userId) as unknown as NotificationRow[];
    return rows.map(mapNotification);
  },

  findNotification(id: string) {
    const row = database.prepare("SELECT * FROM notifications WHERE id = ?").get(id) as NotificationRow | undefined;
    return row ? mapNotification(row) : undefined;
  },

  markNotificationRead(id: string, userId: string) {
    const readAt = new Date().toISOString();
    database
      .prepare("UPDATE notifications SET read_at = COALESCE(read_at, ?) WHERE id = ? AND user_id = ?")
      .run(readAt, id, userId);
    return this.findNotification(id);
  },

  markAllNotificationsRead(userId: string) {
    const readAt = new Date().toISOString();
    database
      .prepare("UPDATE notifications SET read_at = COALESCE(read_at, ?) WHERE user_id = ?")
      .run(readAt, userId);
    return this.listNotifications(userId);
  },

  listConversationsForUser(userId: string) {
    const rows = database
      .prepare(
        `SELECT c.*
         FROM conversations c
         JOIN conversation_members cm ON cm.conversation_id = c.id
         WHERE cm.user_id = ?
         ORDER BY c.updated_at DESC`
      )
      .all(userId) as unknown as ConversationRow[];
    return rows.map((row) => mapConversation(row, this.listConversationMembers(row.id)));
  },

  findConversation(id: string) {
    const row = database.prepare("SELECT * FROM conversations WHERE id = ?").get(id) as ConversationRow | undefined;
    return row ? mapConversation(row, this.listConversationMembers(row.id)) : undefined;
  },

  findConversationForMembers(memberUserIds: string[]) {
    const sortedIds = [...memberUserIds].sort();
    const rows = database.prepare("SELECT * FROM conversations").all() as unknown as ConversationRow[];
    for (const row of rows) {
      const members = this.listConversationMembers(row.id).map((member) => member.user_id).sort();
      if (members.length === sortedIds.length && members.every((memberId, index) => memberId === sortedIds[index])) {
        return mapConversation(row, this.listConversationMembers(row.id));
      }
    }
    return undefined;
  },

  createConversation(input: { id: string; memberUserIds: string[]; title: string; preview?: string; createdAt?: string }) {
    const createdAt = input.createdAt ?? new Date().toISOString();
    const memberUserIds = Array.from(new Set(input.memberUserIds));
    database
      .prepare("INSERT INTO conversations (id, title, preview, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
      .run(input.id, input.title, input.preview ?? "", createdAt, createdAt);

    const insertMember = database.prepare(
      "INSERT INTO conversation_members (conversation_id, user_id, unread_count, joined_at) VALUES (?, ?, 0, ?)"
    );
    for (const userId of memberUserIds) {
      insertMember.run(input.id, userId, createdAt);
    }

    return this.findConversation(input.id)!;
  },

  listConversationMembers(conversationId: string) {
    const rows = database
      .prepare("SELECT * FROM conversation_members WHERE conversation_id = ? ORDER BY joined_at ASC")
      .all(conversationId) as unknown as ConversationMemberRow[];
    return rows;
  },

  isConversationMember(conversationId: string, userId: string) {
    return Boolean(
      database
        .prepare("SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?")
        .get(conversationId, userId)
    );
  },

  listMessages(conversationId: string) {
    const rows = database
      .prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC")
      .all(conversationId) as unknown as MessageRow[];
    return rows.map((row) => mapMessage(row, this.listMessageReadUserIds(row.id)));
  },

  createMessage(input: {
    id: string;
    conversationId: string;
    senderUserId: string;
    type: MessageType;
    text: string;
    metadata?: Record<string, unknown>;
    createdAt?: string;
  }) {
    const createdAt = input.createdAt ?? new Date().toISOString();
    database
      .prepare(
        "INSERT INTO messages (id, conversation_id, sender_user_id, type, text, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      )
      .run(
        input.id,
        input.conversationId,
        input.senderUserId,
        input.type,
        input.text,
        JSON.stringify(input.metadata ?? {}),
        createdAt
      );

    database
      .prepare("INSERT OR IGNORE INTO message_reads (message_id, user_id, read_at) VALUES (?, ?, ?)")
      .run(input.id, input.senderUserId, createdAt);

    database
      .prepare("UPDATE conversations SET preview = ?, updated_at = ? WHERE id = ?")
      .run(input.text, createdAt, input.conversationId);

    database
      .prepare(
        "UPDATE conversation_members SET unread_count = unread_count + 1 WHERE conversation_id = ? AND user_id != ?"
      )
      .run(input.conversationId, input.senderUserId);

    return this.findMessage(input.id)!;
  },

  findMessage(id: string) {
    const row = database.prepare("SELECT * FROM messages WHERE id = ?").get(id) as MessageRow | undefined;
    return row ? mapMessage(row, this.listMessageReadUserIds(row.id)) : undefined;
  },

  listMessageReadUserIds(messageId: string) {
    const rows = database.prepare("SELECT user_id FROM message_reads WHERE message_id = ?").all(messageId) as unknown as {
      user_id: string;
    }[];
    return rows.map((row) => row.user_id);
  },

  markConversationRead(conversationId: string, userId: string) {
    const readAt = new Date().toISOString();
    const messages = this.listMessages(conversationId);
    const insertRead = database.prepare("INSERT OR IGNORE INTO message_reads (message_id, user_id, read_at) VALUES (?, ?, ?)");
    for (const message of messages) {
      insertRead.run(message.id, userId, readAt);
    }
    database
      .prepare("UPDATE conversation_members SET unread_count = 0 WHERE conversation_id = ? AND user_id = ?")
      .run(conversationId, userId);
    return this.findConversation(conversationId);
  },

  createExchangeRequest(input: MealExchangeRequest) {
    database
      .prepare(
        `INSERT INTO exchange_requests (
          id, sender_user_id, receiver_user_id, target_card_id, own_card_id,
          conversation_id, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.id,
        input.senderUserId,
        input.receiverUserId,
        input.targetCardId,
        input.ownCardId ?? null,
        input.conversationId,
        input.status,
        input.createdAt,
        input.updatedAt
      );
    return this.findExchangeRequest(input.id)!;
  },

  findExchangeRequest(id: string) {
    const row = database.prepare("SELECT * FROM exchange_requests WHERE id = ?").get(id) as ExchangeRequestRow | undefined;
    return row ? mapExchangeRequest(row) : undefined;
  },

  listExchangeRequestsForConversation(conversationId: string) {
    const rows = database
      .prepare("SELECT * FROM exchange_requests WHERE conversation_id = ? ORDER BY created_at ASC")
      .all(conversationId) as unknown as ExchangeRequestRow[];
    return rows.map(mapExchangeRequest);
  },

  updateExchangeRequestStatus(id: string, status: "accepted" | "rejected") {
    database
      .prepare("UPDATE exchange_requests SET status = ?, updated_at = ? WHERE id = ?")
      .run(status, new Date().toISOString(), id);
    return this.findExchangeRequest(id);
  },
};

seedDatabase();

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  role: string;
  nickname: string;
  avatar_text: string;
  avatar_url: string | null;
  verified: number;
  school: string | null;
  bio: string | null;
  preference_tags: string;
  profile_completed: number;
  created_at: string;
  updated_at: string;
}

interface MealCardRow {
  id: string;
  user_id: string;
  nickname: string;
  avatar_text: string;
  verified: number;
  text: string;
  time: string;
  place: string;
  people: string;
  tags: string;
  match_score: number;
  reason: string;
  media_type: "photo" | "video" | null;
  media_url: string | null;
  media_mime_type: string | null;
  status: "active" | "closed" | "deleted";
  created_at: string;
  updated_at: string;
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
  media_mime_type: string | null;
  place: string;
  likes: number;
  favorites: number;
  comments: number;
  shares: number;
  verified: number;
  hot: number;
  followed: number;
  nearby: number;
  status: "published" | "deleted";
  created_at: string;
  updated_at: string;
}

interface CommunityCommentRow {
  id: string;
  post_id: string;
  author_id: string;
  author: string;
  avatar: string;
  text: string;
  likes: number;
  status: "published" | "deleted";
  created_at: string;
  updated_at: string;
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
  metadata: string;
  created_at: string;
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

function mapUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role === "admin" ? "admin" : "user",
    nickname: row.nickname,
    avatarText: row.avatar_text,
    avatarUrl: row.avatar_url ?? undefined,
    verified: Boolean(row.verified),
    school: row.school ?? undefined,
    bio: row.bio ?? undefined,
    preferenceTags: parseStringArray(row.preference_tags),
    profileCompleted: Boolean(row.profile_completed),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMealCard(row: MealCardRow): MealCard {
  return {
    id: row.id,
    userId: row.user_id,
    nickname: row.nickname,
    avatarText: row.avatar_text,
    verified: Boolean(row.verified),
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
    author: row.author,
    avatar: row.avatar,
    channel: row.channel,
    topic: row.topic,
    mediaType: row.media_type,
    mediaSource: row.media_source,
    mediaUrl: row.media_url ?? undefined,
    mediaMimeType: row.media_mime_type ?? undefined,
    place: row.place,
    likes: row.likes,
    favorites: row.favorites,
    comments: row.comments,
    shares: row.shares,
    verified: Boolean(row.verified),
    hot: Boolean(row.hot),
    followed: Boolean(row.followed),
    nearby: Boolean(row.nearby),
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
    author: row.author,
    avatar: row.avatar,
    text: row.text,
    likes: row.likes,
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

function parseStringArray(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function parseRecord(value: string) {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function seedDatabase() {
  cleanupPrototypeSeedData();
}

function cleanupPrototypeSeedData() {
  const prototypeUsers = `
    SELECT id FROM users
    WHERE id IN ('user-demo', 'user-lin')
      OR email IN ('demo@ueat.local', 'lin@ueat.local')
      OR email LIKE 'notif-%@ueat.local'
      OR email LIKE 'sync-%@ueat.local'
      OR email LIKE 'chat-a-%@ueat.local'
      OR email LIKE 'chat-b-%@ueat.local'
  `;

  database.prepare(`DELETE FROM notifications WHERE user_id IN (${prototypeUsers}) OR actor_user_id IN (${prototypeUsers})`).run();
  database.prepare(`DELETE FROM reports WHERE reporter_user_id IN (${prototypeUsers})`).run();
  database.prepare(`DELETE FROM comments WHERE id = 'comment-1' OR author_id IN (${prototypeUsers})`).run();
  database.prepare("DELETE FROM likes WHERE post_id = 'post-window-seat'").run();
  database.prepare("DELETE FROM favorites WHERE post_id = 'post-window-seat'").run();
  database.prepare("DELETE FROM posts WHERE id = 'post-window-seat'").run();
  database.prepare("DELETE FROM meal_cards WHERE id IN ('card-lin', 'card-demo')").run();
  database.prepare(`DELETE FROM users WHERE id IN (${prototypeUsers})`).run();
}
