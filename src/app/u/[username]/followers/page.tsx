import { AppHeader } from "@/components/layout/app-header";
import { ParticlesBackground } from "@/components/shared/particles-background";
import { GlassCard } from "@/components/shared/glass-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfileByUsername } from "@/lib/db/queries";

interface Props { params: Promise<{ username: string }>; }

export default async function FollowersPage({ params }: Props) {
  const { username } = await params;
  const supabase = await createClient();
  if (!supabase) notFound();

  const profile = await getProfileByUsername(supabase, username);
  if (!profile) notFound();

  // Fetch followers: users who follow this profile
  const { data: follows } = await supabase
    .from("follows")
    .select("follower_id, profiles!follower_id(id, username, display_name, avatar_url)")
    .eq("following_id", profile.id)
    .order("created_at", { ascending: false });

  type FollowerRow = {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };

  // PostgREST embeds a to-one FK as a single object; the untyped client
  // surfaces it as an array, so normalize both shapes defensively.
  const followers = (follows ?? [])
    .map((f) => {
      const profiles = Array.isArray(f.profiles) ? f.profiles : null;
      return profiles?.[0] as FollowerRow | undefined;
    })
    .filter((p): p is FollowerRow => Boolean(p));

  return (
    <div className="min-h-screen flex flex-col relative">
      <ParticlesBackground />
      <AppHeader />
      <main className="flex-1 pt-20 px-6 max-w-2xl mx-auto w-full z-10 space-y-6 pb-20">
        <div className="flex items-center gap-4">
          <Link href={`/u/${username}`}>
            <Button variant="ghost" size="sm" className="gap-1.5 -ml-2 rounded-full">
              <ArrowLeft className="w-4 h-4" /> 返回
            </Button>
          </Link>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Users className="w-5 h-5" /> {profile.displayName} 的粉丝 ({followers.length})
          </h1>
        </div>

        {followers.length === 0 ? (
          <GlassCard className="p-12 text-center" hover={false}>
            <Users className="w-12 h-12 text-[#e6dfd8] mx-auto mb-4" />
            <p className="text-[#6c6a64] text-sm">暂无粉丝</p>
          </GlassCard>
        ) : (
          <div className="space-y-2">
            {followers.map((f) => (
              <Link key={f.id} href={`/u/${f.username}`}>
                <GlassCard className="p-4 flex items-center gap-3 hover:border-[#cc785c]/30" hover>
                  <Avatar className="w-10 h-10">
                    {f.avatar_url ? <AvatarImage src={f.avatar_url} alt="" /> : null}
                    <AvatarFallback className="bg-[#cc785c] text-white text-sm">
                      {(f.display_name ?? f.username ?? "?")[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-sm text-[#141413]">{f.display_name}</p>
                    <p className="text-xs text-[#9c9890]">@{f.username}</p>
                  </div>
                </GlassCard>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
