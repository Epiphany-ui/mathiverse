/* ─── Database row types ─── */
export interface Profile {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string;
  website: string;
  createdAt: string;
  updatedAt: string;
}

export interface Visualization {
  id: string;
  title: string;
  description: string;
  tags: string[];
  sourceCode: string;
  videoUrl: string | null;
  gifUrl: string | null;
  posterUrl: string | null;
  duration: number;
  authorId: string;
  forkedFrom: string | null;
  likesCount: number;
  commentsCount: number;
  forksCount: number;
  viewsCount: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  // Joined
  author?: Pick<Profile, "id" | "username" | "displayName" | "avatarUrl">;
  isLiked?: boolean;
  isBookmarked?: boolean;
}

export interface Article {
  id: string;
  title: string;
  coverUrl: string | null;
  bodyMd: string;
  embeddedViz: string[];
  tags: string[];
  authorId: string;
  likesCount: number;
  commentsCount: number;
  collectionsCount: number;
  viewsCount: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  // Joined
  author?: Pick<Profile, "id" | "username" | "displayName" | "avatarUrl">;
  isLiked?: boolean;
  isBookmarked?: boolean;
}

export interface Comment {
  id: string;
  body: string;
  authorId: string;
  targetType: "visualization" | "article";
  targetId: string;
  parentId: string | null;
  likesCount: number;
  createdAt: string;
  updatedAt: string;
  // Joined
  author?: Pick<Profile, "id" | "username" | "displayName" | "avatarUrl">;
  isLiked?: boolean;
  replies?: Comment[];
}

/* ─── Feed types ─── */
export type FeedSort = "hot" | "new" | "followed";

export interface FeedItem {
  type: "visualization" | "article";
  id: string;
  title: string;
  description?: string;
  coverUrl?: string | null;
  posterUrl?: string | null;
  tags: string[];
  author: Pick<Profile, "id" | "username" | "displayName" | "avatarUrl">;
  likesCount: number;
  commentsCount: number;
  createdAt: string;
  isLiked?: boolean;
  isBookmarked?: boolean;
}

/* ─── AI / Sandbox types ─── */
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  code?: string; // extracted Python code block
}

export interface RendererStatus {
  connected: boolean;
  manimVersion?: string;
}

export interface RenderRequest {
  code: string;
  quality?: "-ql" | "-qm" | "-qh" | "-qk";
  format?: "mp4" | "gif";
  durationLimit?: number;
}

export interface RenderResult {
  success: boolean;
  videoPath?: string;
  duration?: number;
  posterPath?: string;
  error?: string;
}
