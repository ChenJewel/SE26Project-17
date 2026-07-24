import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type {
  CommunityComment,
  CommunityPost,
  Conversation,
  MealCard,
  MealExchangeRequest,
  Message,
  Notification,
  Report,
  User,
} from "../types.js";

const now = () => new Date().toISOString();

export function makeId(prefix: string) {
  return `${prefix}-${randomUUID()}`;
}

export function hashPassword(password: string) {
  return createHash("sha256").update(password).digest("hex");
}

export interface InMemoryDatabase {
  users: User[];
  mealCards: MealCard[];
  posts: CommunityPost[];
  comments: CommunityComment[];
  likedPosts: Set<string>;
  favoritePosts: Set<string>;
  follows: Set<string>;
  blocks: Set<string>;
  reports: Report[];
  conversations: Conversation[];
  messages: Message[];
  notifications: Notification[];
  exchangeRequests: MealExchangeRequest[];
}

const initialDb: InMemoryDatabase = {
  users: [
    {
      id: "user-demo",
      email: "demo@ueat.local",
      passwordHash: hashPassword("demo-password"),
      role: "user",
      nickname: "Demo User",
      avatarText: "D",
      verified: true,
      school: "U eat University",
      bio: "Prototype account for local API development.",
      preferenceTags: ["dinner", "quiet", "study"],
      profileCompleted: true,
      createdAt: "2026-07-14T01:00:00.000Z",
      updatedAt: "2026-07-14T01:00:00.000Z",
    },
    {
      id: "user-lin",
      email: "lin@ueat.local",
      passwordHash: hashPassword("demo-password"),
      role: "user",
      nickname: "Lin",
      avatarText: "L",
      verified: true,
      school: "U eat University",
      preferenceTags: ["dinner", "quiet"],
      profileCompleted: true,
      createdAt: "2026-07-14T01:00:00.000Z",
      updatedAt: "2026-07-14T01:00:00.000Z",
    },
  ],
  mealCards: [
    {
      id: "card-lin",
      userId: "user-lin",
      nickname: "Lin",
      avatarText: "L",
      verified: true,
      text: "Looking for a quiet dinner around 18:30 after study time.",
      time: "Today 18:30",
      place: "Dining Hall 2",
      people: "1 on 1",
      tags: ["dinner", "quiet", "study"],
      matchScore: 92,
      reason: "Time, place, and dining mood are close.",
      createdAt: "2026-07-14T01:00:00.000Z",
      updatedAt: "2026-07-14T01:00:00.000Z",
      status: "active",
      editCount: 0,
    },
    {
      id: "card-demo",
      userId: "user-demo",
      nickname: "Demo User",
      avatarText: "D",
      verified: true,
      text: "Open to a quick lunch and a short walk after.",
      time: "Tomorrow 12:10",
      place: "Dining Hall 1",
      people: "Flexible",
      tags: ["lunch", "walk", "easygoing"],
      matchScore: 86,
      reason: "Nearby place and similar pace preference.",
      createdAt: "2026-07-14T01:05:00.000Z",
      updatedAt: "2026-07-14T01:05:00.000Z",
      status: "active",
      editCount: 0,
    },
  ],
  posts: [
    {
      id: "post-window-seat",
      authorId: "user-lin",
      title: "Window seats in Dining Hall 2 work well for a first meal",
      text: "The light is comfortable, and the table area is calm enough for a first meetup.",
      author: "Lin",
      avatar: "L",
      channel: "Dining",
      topic: "Dining",
      mediaType: "photo",
      mediaSource: "album",
      place: "Dining Hall 2",
      likes: 128,
      favorites: 36,
      comments: 1,
      shares: 12,
      verified: true,
      hot: true,
      followed: true,
      nearby: true,
      createdAt: "2026-07-14T01:10:00.000Z",
      updatedAt: "2026-07-14T01:10:00.000Z",
      status: "published",
      editCount: 0,
    },
  ],
  comments: [
    {
      id: "comment-1",
      postId: "post-window-seat",
      authorId: "user-demo",
      author: "Demo User",
      avatar: "D",
      text: "Good spot. It feels less rushed than the main area.",
      likes: 4,
      createdAt: "2026-07-14T01:15:00.000Z",
      updatedAt: "2026-07-14T01:15:00.000Z",
      status: "published",
    },
  ],
  likedPosts: new Set<string>(),
  favoritePosts: new Set<string>(),
  follows: new Set<string>(),
  blocks: new Set<string>(),
  reports: [],
  conversations: [
    {
      id: "conv-demo-lin",
      memberUserIds: ["user-demo", "user-lin"],
      title: "Lin",
      preview: "See you at Dining Hall 2.",
      updatedAt: "2026-07-14T01:20:00.000Z",
      unreadByUserId: { "user-demo": 1, "user-lin": 0 },
    },
  ],
  messages: [
    {
      id: "msg-1",
      conversationId: "conv-demo-lin",
      senderUserId: "user-lin",
      type: "text",
      text: "See you at Dining Hall 2.",
      createdAt: "2026-07-14T01:20:00.000Z",
      readByUserIds: ["user-lin"],
    },
  ],
  notifications: [
    {
      id: "notif-1",
      userId: "user-demo",
      type: "message",
      actorUserId: "user-lin",
      targetType: "conversation",
      targetId: "conv-demo-lin",
      text: "Lin sent you a message.",
      createdAt: "2026-07-14T01:20:00.000Z",
    },
  ],
  exchangeRequests: [],
};

interface PersistedDatabase {
  users: User[];
  mealCards: MealCard[];
  posts: CommunityPost[];
  comments: CommunityComment[];
  likedPosts: string[];
  favoritePosts: string[];
  follows: string[];
  blocks: string[];
  reports: Report[];
  conversations: Conversation[];
  messages: Message[];
  notifications: Notification[];
  exchangeRequests: MealExchangeRequest[];
}

const databaseFilePath = resolve(process.cwd(), "data", "dev-db.json");

export const db: InMemoryDatabase = loadDatabase();

export function getDatabaseFilePath() {
  return databaseFilePath;
}

export function timestamp() {
  return now();
}

export function saveDatabase() {
  const payload: PersistedDatabase = {
    users: db.users,
    mealCards: db.mealCards,
    posts: db.posts,
    comments: db.comments,
    likedPosts: [...db.likedPosts],
    favoritePosts: [...db.favoritePosts],
    follows: [...db.follows],
    blocks: [...db.blocks],
    reports: db.reports,
    conversations: db.conversations,
    messages: db.messages,
    notifications: db.notifications,
    exchangeRequests: db.exchangeRequests,
  };

  mkdirSync(dirname(databaseFilePath), { recursive: true });
  writeFileSync(databaseFilePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function loadDatabase(): InMemoryDatabase {
  if (!existsSync(databaseFilePath)) {
    return initialDb;
  }

  const raw = readFileSync(databaseFilePath, "utf8");
  const persisted = JSON.parse(raw) as Partial<PersistedDatabase>;

  return {
    users: persisted.users ?? initialDb.users,
    mealCards: persisted.mealCards ?? initialDb.mealCards,
    posts: persisted.posts ?? initialDb.posts,
    comments: persisted.comments ?? initialDb.comments,
    likedPosts: new Set(persisted.likedPosts ?? []),
    favoritePosts: new Set(persisted.favoritePosts ?? []),
    follows: new Set(persisted.follows ?? []),
    blocks: new Set(persisted.blocks ?? []),
    reports: persisted.reports ?? initialDb.reports,
    conversations: persisted.conversations ?? initialDb.conversations,
    messages: persisted.messages ?? initialDb.messages,
    notifications: persisted.notifications ?? initialDb.notifications,
    exchangeRequests: persisted.exchangeRequests ?? initialDb.exchangeRequests,
  };
}
