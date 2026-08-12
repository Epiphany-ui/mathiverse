import { getAdminClient } from "@/lib/supabase/admin";
import { Users, FileText, BookOpen, MessageSquare } from "lucide-react";

export const dynamic = "force-dynamic";

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}

function StatCard({ label, value, icon: Icon }: StatCardProps) {
  return (
    <div className="flex items-center gap-4 p-6 rounded-xl border border-[#e6dfd8] bg-white">
      <div className="w-12 h-12 rounded-lg bg-[#cc785c]/10 flex items-center justify-center">
        <Icon className="w-5 h-5 text-[#cc785c]" />
      </div>
      <div>
        <p className="text-3xl font-semibold text-[#141413]">{value}</p>
        <p className="text-sm text-[#6c6a64]">{label}</p>
      </div>
    </div>
  );
}

export default async function AdminDashboard() {
  const admin = getAdminClient();
  if (!admin) {
    return (
      <div className="p-8 text-center text-[#6c6a64]">
        Supabase 未配置。请设置环境变量后重试。
      </div>
    );
  }

  const [profiles, vizs, articles, wikis, comments] = await Promise.all([
    admin.from("profiles").select("*", { count: "exact", head: true }),
    admin.from("visualizations").select("*", { count: "exact", head: true }),
    admin.from("articles").select("*", { count: "exact", head: true }),
    admin.from("wiki_entries").select("*", { count: "exact", head: true }),
    admin.from("comments").select("*", { count: "exact", head: true }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-[#141413]">数据看板</h1>
        <p className="text-sm text-[#6c6a64] mt-1">Mathiverse 平台概览</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="注册用户" value={profiles.count ?? 0} icon={Users} />
        <StatCard label="可视化作品" value={vizs.count ?? 0} icon={FileText} />
        <StatCard label="文章" value={articles.count ?? 0} icon={FileText} />
        <StatCard label="百科词条" value={wikis.count ?? 0} icon={BookOpen} />
        <StatCard label="评论" value={comments.count ?? 0} icon={MessageSquare} />
      </div>
    </div>
  );
}
