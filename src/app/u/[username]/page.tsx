import { AppHeader } from "@/components/layout/app-header";
import { ParticlesBackground } from "@/components/shared/particles-background";
import { GlassCard } from "@/components/shared/glass-card";
import { FeedCard } from "@/components/community/feed-card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, UserPlus } from "lucide-react";
import { notFound } from "next/navigation";
import {
  getProfileByUsername,
  getUserVisualizations,
  getUserArticles,
} from "@/lib/db/mock-data";

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const profile = getProfileByUsername(username);

  if (!profile) {
    notFound();
  }

  const vizs = getUserVisualizations(profile.id);
  const articles = getUserArticles(profile.id);

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
    description: a.bodyMd.slice(0, 150) + "...",
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
              <AvatarFallback className="text-2xl bg-gradient-to-br from-primary to-secondary text-white">
                {profile.displayName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <div>
                <h1 className="text-2xl font-bold">{profile.displayName}</h1>
                <p className="text-muted-foreground">@{profile.username}</p>
              </div>
              {profile.bio && (
                <p className="text-sm text-muted-foreground/80 leading-relaxed">
                  {profile.bio}
                </p>
              )}
              {profile.website && (
                <a
                  href={profile.website}
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
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  加入于{" "}
                  {new Date(profile.createdAt).toLocaleDateString("zh-CN")}
                </span>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 shrink-0"
            >
              <UserPlus className="w-4 h-4" />
              关注
            </Button>
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
              收藏 (0)
            </TabsTrigger>
            <TabsTrigger value="forks">
              Fork (0)
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
            <div className="text-center py-16">
              <p className="text-muted-foreground">还没有收藏内容</p>
            </div>
          </TabsContent>

          <TabsContent value="forks" className="mt-6">
            <div className="text-center py-16">
              <p className="text-muted-foreground">还没有 Fork 内容</p>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
