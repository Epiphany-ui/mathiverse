import Link from "next/link";
import { AppHeader } from "@/components/layout/app-header";
import { ParticlesBackground } from "@/components/shared/particles-background";
import { GlassCard } from "@/components/shared/glass-card";
import { FeedCard } from "@/components/community/feed-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "lucide-react";
import { FollowButton } from "@/components/shared/follow-button";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sanitizeWebsiteUrl } from "@/lib/utils";
import { MathText } from "@/components/content/math-text";
import {
  getProfileByUsername,
  getUserVisualizations,
  getUserArticles,
  getUserBookmarks,
  getUserForks,
} from "@/lib/db/queries";

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const supabase = await createClient();
  if (!supabase) {
    notFound();
  }

  const profile = await getProfileByUsername(supabase, username);

  if (!profile) {
    notFound();
  }

  const vizs = await getUserVisualizations(supabase, profile.id);
  const articles = await getUserArticles(supabase, profile.id);

  // Follower / following counts
  const [{ count: followerCount }, { count: followingCount }] = await Promise.all([
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", profile.id),
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", profile.id),
  ]);

  // Bookmarks are private (bookmarks_read_own RLS) — only fetch them
  // when viewing your own profile. Other profiles show an empty collection.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isOwnProfile = user?.id === profile.id;
  const bookmarkItems = isOwnProfile
    ? await getUserBookmarks(supabase, profile.id)
    : [];
  const forkItems = await getUserForks(supabase, profile.id);

  // Build feed items from user content
  const vizItems = vizs.map((v) => ({
    type: "visualization" as const,
    id: v.id,
    title: v.title,
    description: v.description,
    posterUrl: v.posterUrl,
    tags: v.tags,
    author: {
      id: profile.id,
      username: profile.username,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
    },
    likesCount: v.likesCount,
    commentsCount: v.commentsCount,
    createdAt: v.createdAt,
  }));

  const articleItems = articles.map((a) => ({
    type: "article" as const,
    id: a.id,
    title: a.title,
    description: (a.bodyMd ?? "").slice(0, 150) + "...",
    coverUrl: a.coverUrl,
    posterUrl: a.coverUrl,
    tags: a.tags,
    author: {
      id: profile.id,
      username: profile.username,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
    },
    likesCount: a.likesCount,
    commentsCount: a.commentsCount,
    createdAt: a.createdAt,
  }));

  return (
    <div className="min-h-screen flex flex-col relative">
      <ParticlesBackground />
      <AppHeader />
      <main className="flex-1 pt-24 px-6 max-w-4xl mx-auto w-full z-10 space-y-8 pb-20">
        {/* Profile Header */}
        <GlassCard className="p-6" hover={false}>
          <div className="flex items-start gap-6">
            <Avatar className="w-20 h-20 shrink-0">
              {profile.avatarUrl ? (
                <AvatarImage src={profile.avatarUrl} alt={profile.displayName ?? ""} />
              ) : null}
              <AvatarFallback className="text-2xl bg-[#cc785c] text-white">
                {(profile.displayName ?? "U").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <div>
                <h1 className="text-2xl font-bold">{profile.displayName}</h1>
                <p className="text-muted-foreground">@{profile.username}</p>
              </div>
              {profile.bio && (
                <p className="text-sm text-muted-foreground/80 leading-relaxed">
                  <MathText text={profile.bio} />
                </p>
              )}
              {sanitizeWebsiteUrl(profile.website) && (
                <a
                  href={sanitizeWebsiteUrl(profile.website)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline"
                >
                  {profile.website}
                </a>
              )}
              <div className="flex items-center gap-4 text-sm text-muted-foreground pt-1">
                <span>{vizs.length} 作品</span>
                <span>{articles.length} 文章</span>
                <Link href={`/u/${username}/followers`} className="hover:text-[#cc785c] transition-colors">{followerCount ?? 0} 粉丝</Link>
                <Link href={`/u/${username}/following`} className="hover:text-[#cc785c] transition-colors">{followingCount ?? 0} 关注</Link>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  加入于{" "}
                  {new Date(profile.createdAt).toLocaleDateString("zh-CN")}
                </span>
              </div>
            </div>
            <FollowButton userId={profile.id} />
          </div>
        </GlassCard>

        {/* Content Tabs */}
        <Tabs defaultValue="works">
          <TabsList>
            <TabsTrigger value="works">
              作品 ({vizs.length})
            </TabsTrigger>
            <TabsTrigger value="articles">
              文章 ({articles.length})
            </TabsTrigger>
            <TabsTrigger value="collections">
              收藏 ({bookmarkItems.length})
            </TabsTrigger>
            <TabsTrigger value="forks">
              Fork ({forkItems.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="works" className="mt-6">
            {vizItems.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-muted-foreground">还没有作品</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {vizItems.map((item) => (
                  <FeedCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="articles" className="mt-6">
            {articleItems.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-muted-foreground">还没有文章</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {articleItems.map((item) => (
                  <FeedCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="collections" className="mt-6">
            {bookmarkItems.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-muted-foreground">还没有收藏内容</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {bookmarkItems.map((item) => (
                  <FeedCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="forks" className="mt-6">
            {forkItems.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-muted-foreground">还没有 Fork 内容</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {forkItems.map((item) => (
                  <FeedCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
