"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/layout/app-header";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Send } from "lucide-react";
import Link from "next/link";
import { WIKI_CATEGORIES } from "@/lib/wiki/categories";

export default function NewWikiPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("pure-math");
  const [summary, setSummary] = useState("");
  const [bodyMd, setBodyMd] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !bodyMd.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/wiki", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), category, summary: summary.trim(), bodyMd: bodyMd.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "创建失败");
      router.push(`/wiki/${data.entry.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 pt-20 px-6 max-w-3xl mx-auto w-full pb-20">
        <Link href="/wiki">
          <Button variant="ghost" size="sm" className="gap-1.5 -ml-2 rounded-full mb-6">
            <ArrowLeft className="w-4 h-4" />返回百科
          </Button>
        </Link>
        <h1 className="text-2xl font-bold text-[#141413] mb-8">创建词条</h1>
        {error && (
          <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-600 mb-6">{error}</div>
        )}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-[#141413] mb-2">标题</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如：贝叶斯定理"
              className="w-full px-4 py-2.5 rounded-lg border border-[#e6dfd8] bg-white text-[#141413] focus:outline-none focus:ring-2 focus:ring-[#cc785c]/30"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#141413] mb-2">分类</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-[#e6dfd8] bg-white text-[#141413]"
            >
              {WIKI_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#141413] mb-2">摘要</label>
            <input
              type="text"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="一句话描述这个词条…"
              className="w-full px-4 py-2.5 rounded-lg border border-[#e6dfd8] bg-white text-[#141413] focus:outline-none focus:ring-2 focus:ring-[#cc785c]/30"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#141413] mb-2">正文（Markdown）</label>
            <textarea
              value={bodyMd}
              onChange={(e) => setBodyMd(e.target.value)}
              placeholder="用 Markdown 格式编写词条内容。支持 KaTeX 数学公式：$E = mc^2$"
              rows={20}
              className="w-full px-4 py-2.5 rounded-lg border border-[#e6dfd8] bg-white text-[#141413] focus:outline-none focus:ring-2 focus:ring-[#cc785c]/30 font-mono text-sm"
              required
            />
          </div>
          <Button type="submit" disabled={submitting} className="gap-2 bg-[#cc785c] hover:bg-[#a9583e] text-white">
            <Send className="w-4 h-4" />
            {submitting ? "提交中…" : "提交审核"}
          </Button>
          <p className="text-xs text-[#9c9890]">词条提交后将进入管理员审核，审核通过后公开发布。</p>
        </form>
      </main>
    </div>
  );
}
