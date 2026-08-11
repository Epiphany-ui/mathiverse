import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  primaryKey,
  check,
  doublePrecision,
  smallint,
  unique,
} from "drizzle-orm/pg-core";

/* ─── Profiles (extends Supabase auth.users) ─── */
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  username: text("username").unique().notNull(),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  bio: text("bio").default(""),
  website: text("website").default(""),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/* ─── Visualizations ─── */
export const visualizations = pgTable("visualizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description").default(""),
  tags: text("tags").array().default([]),
  sourceCode: text("source_code").notNull(),
  videoUrl: text("video_url"),
  gifUrl: text("gif_url"),
  posterUrl: text("poster_url"),
  duration: integer("duration").default(0),
  authorId: uuid("author_id")
    .notNull()
    .references(() => profiles.id),
  forkedFrom: uuid("forked_from"),
  likesCount: integer("likes_count").default(0),
  commentsCount: integer("comments_count").default(0),
  forksCount: integer("forks_count").default(0),
  viewsCount: integer("views_count").default(0),
  isPublished: boolean("is_published").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/* ─── Articles ─── */
export const articles = pgTable("articles", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  coverUrl: text("cover_url"),
  bodyMd: text("body_md").notNull(),
  embeddedViz: uuid("embedded_viz").array().default([]),
  tags: text("tags").array().default([]),
  authorId: uuid("author_id")
    .notNull()
    .references(() => profiles.id),
  likesCount: integer("likes_count").default(0),
  commentsCount: integer("comments_count").default(0),
  collectionsCount: integer("collections_count").default(0),
  viewsCount: integer("views_count").default(0),
  isPublished: boolean("is_published").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/* ─── Comments ─── */
export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    body: text("body").notNull(),
    authorId: uuid("author_id")
      .notNull()
      .references(() => profiles.id),
    targetType: text("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    parentId: uuid("parent_id"),
    likesCount: integer("likes_count").default(0),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    check(
      "target_type_check",
      sql`${table.targetType} IN ('visualization', 'article', 'wiki')`,
    ),
  ],
);

/* ─── Likes (composite PK prevents duplicates) ─── */
export const likes = pgTable(
  "likes",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id),
    targetType: text("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.targetType, table.targetId] }),
    check(
      "target_type_check",
      sql`${table.targetType} IN ('visualization', 'article', 'comment', 'wiki')`,
    ),
  ],
);

/* ─── Bookmarks ─── */
export const bookmarks = pgTable(
  "bookmarks",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id),
    targetType: text("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.targetType, table.targetId] }),
    check(
      "target_type_check",
      sql`${table.targetType} IN ('visualization', 'article', 'wiki')`,
    ),
  ],
);

/* ─── Follows ─── */
export const follows = pgTable(
  "follows",
  {
    followerId: uuid("follower_id")
      .notNull()
      .references(() => profiles.id),
    followingId: uuid("following_id")
      .notNull()
      .references(() => profiles.id),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.followerId, table.followingId] })],
);

/* ─── Tags ─── */
export const tags = pgTable("tags", {
  name: text("name").primaryKey(),
  usageCount: integer("usage_count").default(0),
});

/* ─── Wiki Entries ─── */
export const wikiEntries = pgTable("wiki_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").unique().notNull(),
  title: text("title").notNull(),
  category: text("category").notNull(),
  summary: text("summary").notNull().default(""),
  bodyMd: text("body_md").notNull(),
  coverUrl: text("cover_url"),
  tags: text("tags").array().default([]),
  wikipediaTitle: text("wikipedia_title"),
  wikipediaUrl: text("wikipedia_url"),
  likesCount: integer("likes_count").default(0),
  commentsCount: integer("comments_count").default(0),
  viewsCount: integer("views_count").default(0),
  isPublished: boolean("is_published").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
},
(table) => [
  check(
    "category_check",
    sql`${table.category} IN ('pure-math', 'applied-math', 'cs-overlap')`,
  ),
]);

/* ─── Wiki Edges (knowledge graph) ─── */
export const wikiEdges = pgTable("wiki_edges", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceId: uuid("source_id")
    .notNull()
    .references(() => wikiEntries.id, { onDelete: "cascade" }),
  targetId: uuid("target_id")
    .notNull()
    .references(() => wikiEntries.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  strength: doublePrecision("strength").notNull().default(1.0),
  createdAt: timestamp("created_at").defaultNow(),
},
(table) => [
  check(
    "strength_check",
    sql`${table.strength} >= 0 AND ${table.strength} <= 1`,
  ),
  unique().on(table.sourceId, table.targetId),
]);

/* ─── Manim Examples (RAG vector store) ─── */
export const manimExamples = pgTable("manim_examples", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  code: text("code").notNull(),
  tags: text("tags").array().default([]),
  difficulty: smallint("difficulty").default(1),
  source: text("source").default("manual"),
  embedding: text("embedding"), // vector(1024) stored as pgvector literal
  createdAt: timestamp("created_at").defaultNow(),
},
(table) => [
  check(
    "difficulty_check",
    sql`${table.difficulty} BETWEEN 1 AND 3`,
  ),
]);

/* ─── Notifications ─── */
export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  actorId: uuid("actor_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  targetType: text("target_type"),
  targetId: uuid("target_id"),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
},
(table) => [
  check(
    "type_check",
    sql`${table.type} IN ('like', 'comment', 'follow', 'fork')`,
  ),
  check(
    "target_type_check",
    sql`${table.targetType} IN ('visualization', 'article', 'comment')`,
  ),
]);
