-- ============================================================
-- Mathiverse Database Migration
-- 复制到 Supabase SQL Editor (https://app.supabase.com) 执行
-- ============================================================

-- 1. Profiles (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  bio TEXT DEFAULT '',
  website TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Visualizations
CREATE TABLE IF NOT EXISTS visualizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  tags TEXT[] DEFAULT '{}',
  source_code TEXT NOT NULL,
  video_url TEXT,
  gif_url TEXT,
  poster_url TEXT,
  duration INTEGER DEFAULT 0,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  forked_from UUID,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  forks_count INTEGER DEFAULT 0,
  views_count INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Articles
CREATE TABLE IF NOT EXISTS articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  cover_url TEXT,
  body_md TEXT NOT NULL,
  embedded_viz UUID[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  collections_count INTEGER DEFAULT 0,
  views_count INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Comments
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  body TEXT NOT NULL,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('visualization', 'article')),
  target_id UUID NOT NULL,
  parent_id UUID,
  likes_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Likes (composite PK prevents duplicates)
CREATE TABLE IF NOT EXISTS likes (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('visualization', 'article', 'comment')),
  target_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, target_type, target_id)
);

-- 6. Bookmarks
CREATE TABLE IF NOT EXISTS bookmarks (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('visualization', 'article')),
  target_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, target_type, target_id)
);

-- 7. Follows
CREATE TABLE IF NOT EXISTS follows (
  follower_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (follower_id, following_id)
);

-- 8. Tags
CREATE TABLE IF NOT EXISTS tags (
  name TEXT PRIMARY KEY,
  usage_count INTEGER DEFAULT 0
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_visualizations_author ON visualizations(author_id);
CREATE INDEX IF NOT EXISTS idx_visualizations_created ON visualizations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visualizations_published ON visualizations(is_published);
CREATE INDEX IF NOT EXISTS idx_articles_author ON articles(author_id);
CREATE INDEX IF NOT EXISTS idx_articles_created ON articles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_target ON comments(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_likes_user ON likes(user_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);

-- ============================================================
-- Row Level Security (RLS) — 基础策略
-- ============================================================

-- Profiles: 所有人可读，仅本人可写
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_read_all" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Visualizations: 已发布的任何人可读，作者可写
ALTER TABLE visualizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "viz_read_published" ON visualizations FOR SELECT USING (is_published = true OR auth.uid() = author_id);
CREATE POLICY "viz_insert_auth" ON visualizations FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "viz_update_own" ON visualizations FOR UPDATE USING (auth.uid() = author_id);
CREATE POLICY "viz_delete_own" ON visualizations FOR DELETE USING (auth.uid() = author_id);

-- Articles: 同上
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "articles_read_published" ON articles FOR SELECT USING (is_published = true OR auth.uid() = author_id);
CREATE POLICY "articles_insert_auth" ON articles FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "articles_update_own" ON articles FOR UPDATE USING (auth.uid() = author_id);
CREATE POLICY "articles_delete_own" ON articles FOR DELETE USING (auth.uid() = author_id);

-- Comments: 所有人可读，登录用户可写
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments_read_all" ON comments FOR SELECT USING (true);
CREATE POLICY "comments_insert_auth" ON comments FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "comments_update_own" ON comments FOR UPDATE USING (auth.uid() = author_id);
CREATE POLICY "comments_delete_own" ON comments FOR DELETE USING (auth.uid() = author_id);

-- Likes: 所有人可读，登录用户可操作自己的
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "likes_read_all" ON likes FOR SELECT USING (true);
CREATE POLICY "likes_insert_own" ON likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "likes_delete_own" ON likes FOR DELETE USING (auth.uid() = user_id);

-- Bookmarks: 同上
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bookmarks_read_all" ON bookmarks FOR SELECT USING (true);
CREATE POLICY "bookmarks_insert_own" ON bookmarks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "bookmarks_delete_own" ON bookmarks FOR DELETE USING (auth.uid() = user_id);

-- Follows: 同上
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "follows_read_all" ON follows FOR SELECT USING (true);
CREATE POLICY "follows_insert_own" ON follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "follows_delete_own" ON follows FOR DELETE USING (auth.uid() = follower_id);

-- Tags: 所有人可读
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tags_read_all" ON tags FOR SELECT USING (true);

-- ============================================================
-- Auto-create profile on signup (Trigger)
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'username', 'user_' || substring(NEW.id::text from 1 for 8)),
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', 'User')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
