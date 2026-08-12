/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { BatchBar, type BatchAction } from "@/components/admin/batch-bar";

interface ContentItem {
  id: string;
  title: string;
  type: "visualization" | "article" | "wiki_entries" | "comments";
  typeLabel: string;
  author: string;
  href: string;
  created_at: string;
}

export default function AdminContentPage() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const itemKey = (item: ContentItem) => `${item.type}:${item.id}`;
  const toggleSelect = (key: string) => setSelected((prev) => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next; });
  const toggleAll = () => { if (selected.size === items.length) setSelected(new Set()); else setSelected(new Set(items.map(itemKey))); };
  const clearSelection = () => setSelected(new Set());

  const batchActions: BatchAction[] = [
    { label: "批量删除", action: "delete_content", danger: true },
  ];

  const handleBatch = useCallback(async (a: BatchAction) => {
    try {
      const res = await fetch("/api/admin/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: a.action, targets: [...selected] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      clearSelection();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "批量操作失败");
    }
  }, [selected]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [vizRes, artRes, wikiRes, commentRes] = await Promise.all([
        fetch("/api/admin/content-list?type=visualizations").then(r => r.json()).catch(() => ({ items: [] })),
        fetch("/api/admin/content-list?type=articles").then(r => r.json()).catch(() => ({ items: [] })),
        fetch("/api/admin/wiki-list").then(r => r.json()).catch(() => ({ entries: [] })),
        // Comments: fetch via direct admin query pattern — read recent 100
        fetch("/api/admin/content-list?type=comments").then(r => r.json()).catch(() => ({ items: [] })),
      ]);

      const all: ContentItem[] = [
        ...(vizRes.items ?? []).map((v: any) => ({
          id: v.id, title: v.title, type: "visualization" as const,
          typeLabel: "可视化", author: v.author ?? "—",
          href: `/v/${v.id}`, created_at: v.created_at,
        })),
        ...(artRes.items ?? []).map((a: any) => ({
          id: a.id, title: a.title, type: "article" as const,
          typeLabel: "文章", author: a.author ?? "—",
          href: `/a/${a.id}`, created_at: a.created_at,
        })),
        ...(wikiRes.entries ?? []).map((w: any) => ({
          id: w.id, title: w.title, type: "wiki_entries" as const,
          typeLabel: "百科", author: w.author ?? "—",
          href: `/wiki/${w.slug}`, created_at: w.updated_at,
        })),
        ...(commentRes.items ?? []).map((c: any) => ({
          id: c.id, title: (c.body ?? c.title ?? "").slice(0, 60) + ((c.body ?? "").length > 60 ? "…" : ""),
          type: "comments" as const,
          typeLabel: "评论", author: c.author ?? "—",
          href: "#", created_at: c.created_at,
        })),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setItems(all);
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function deleteItem(item: ContentItem) {
    if (!confirm(`确定要删除「${item.title}」吗？此操作不可撤销。`)) return;
    setDeleting(item.id);
    try {
      // Use the unified batch API for single deletes
      const res = await fetch("/api/admin/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_content", targets: [itemKey(item)] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "删除失败");
      const r = data.results?.[0];
      if (!r?.ok) throw new Error(r?.error ?? "删除失败");
      setItems((prev) => prev.filter((i) => itemKey(i) !== itemKey(item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-[#141413]">内容管理</h1>
      {error && (
        <div className="p-3 rounded-lg border border-[#ff603b]/30 bg-[#ff603b]/5 text-sm text-[#ff603b]">
          {error} <button onClick={load} className="ml-3 underline">重试</button>
        </div>
      )}
      {loading ? (
        <div className="text-center py-12 text-[#9c9890]">加载中…</div>
      ) : (
        <>
          <BatchBar selectedCount={selected.size} actions={batchActions} onExecute={handleBatch} onClear={clearSelection} />
          <div className="border border-[#e6dfd8] rounded-xl overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e6dfd8] bg-[#faf9f5]">
                <th className="w-10 px-2 py-3"><input type="checkbox" checked={selected.size === items.length && items.length > 0} onChange={toggleAll} className="rounded" /></th>
                <th className="text-left px-4 py-3 font-medium text-[#6c6a64]">标题</th>
                <th className="text-left px-4 py-3 font-medium text-[#6c6a64]">类型</th>
                <th className="text-left px-4 py-3 font-medium text-[#6c6a64]">作者</th>
                <th className="text-left px-4 py-3 font-medium text-[#6c6a64]">创建</th>
                <th className="text-right px-4 py-3 font-medium text-[#6c6a64]">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && !loading && (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-[#9c9890]">暂无内容</td></tr>
              )}
              {items.map((item) => (
                <tr key={itemKey(item)} className="border-b border-[#e6dfd8]/50">
                  <td className="px-2 py-3"><input type="checkbox" checked={selected.has(itemKey(item))} onChange={() => toggleSelect(itemKey(item))} className="rounded" /></td>
                  <td className="px-4 py-3">
                    <Link href={item.href} className="font-medium text-[#141413] hover:text-[#cc785c]">{item.title}</Link>
                  </td>
                  <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded-full bg-[#e6dfd8] text-[#6c6a64]">{item.typeLabel}</span></td>
                  <td className="px-4 py-3 text-[#9c9890] text-xs">{item.author}</td>
                  <td className="px-4 py-3 text-[#9c9890] text-xs">{new Date(item.created_at).toLocaleDateString("zh-CN")}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => deleteItem(item)}
                      disabled={deleting === item.id}
                      className="text-xs px-3 py-1 rounded-lg border border-[#ff603b]/30 text-[#ff603b] hover:bg-[#ff603b]/5 transition-colors disabled:opacity-50"
                    >
                      {deleting === item.id ? "删除中…" : "删除"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  );
}
