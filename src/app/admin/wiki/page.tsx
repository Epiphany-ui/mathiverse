/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { BatchBar, type BatchAction } from "@/components/admin/batch-bar";

interface WikiRow {
  id: string;
  slug: string;
  title: string;
  category: string;
  is_published: boolean;
  author: string;
  updated_at: string;
}

export default function AdminWikiPage() {
  const [entries, setEntries] = useState<WikiRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleSelect = (slug: string) => setSelected((prev) => { const next = new Set(prev); next.has(slug) ? next.delete(slug) : next.add(slug); return next; });
  const toggleAll = () => { if (selected.size === entries.length) setSelected(new Set()); else setSelected(new Set(entries.map((e) => e.slug))); };
  const clearSelection = () => setSelected(new Set());

  const batchActions: BatchAction[] = [
    { label: "批量发布", action: "publish_wiki" },
    { label: "批量撤销", action: "unpublish_wiki", danger: true },
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
    try {
      const wRes = await fetch("/api/admin/wiki-list");
      const wData = await wRes.json();
      if (!wRes.ok) throw new Error(wData.error ?? "加载失败");
      setEntries(wData.entries ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function togglePublish(entry: WikiRow) {
    setToggling(entry.slug);
    const newStatus = !entry.is_published;
    try {
      const res = await fetch(`/api/admin/wiki/${entry.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_published: newStatus }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setEntries((prev) => prev.map((e) => e.slug === entry.slug ? { ...e, is_published: newStatus } : e));
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setToggling(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#141413]">Wiki 审核</h1>
        <p className="text-sm text-[#6c6a64] mt-1">共 {entries.length} 个词条</p>
      </div>
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
                <th className="w-10 px-2 py-3"><input type="checkbox" checked={selected.size === entries.length && entries.length > 0} onChange={toggleAll} className="rounded" /></th>
                <th className="text-left px-4 py-3 font-medium text-[#6c6a64]">词条</th>
                <th className="text-left px-4 py-3 font-medium text-[#6c6a64]">分类</th>
                <th className="text-left px-4 py-3 font-medium text-[#6c6a64]">贡献者</th>
                <th className="text-left px-4 py-3 font-medium text-[#6c6a64]">状态</th>
                <th className="text-right px-4 py-3 font-medium text-[#6c6a64]">操作</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 && !loading && (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-[#9c9890]">暂无词条</td></tr>
              )}
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-[#e6dfd8]/50">
                  <td className="px-2 py-3"><input type="checkbox" checked={selected.has(e.slug)} onChange={() => toggleSelect(e.slug)} className="rounded" /></td>
                  <td className="px-4 py-3">
                    <Link href={`/wiki/${e.slug}`} className="font-medium text-[#141413] hover:text-[#cc785c]">{e.title}</Link>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#9c9890]">{e.category}</td>
                  <td className="px-4 py-3 text-xs text-[#9c9890]">{e.author}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${e.is_published ? "bg-[#25bea5]/10 text-[#25bea5]" : "bg-[#ff603b]/10 text-[#ff603b]"}`}>
                      {e.is_published ? "已发布" : "未发布"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => togglePublish(e)}
                      disabled={toggling === e.slug}
                      className={`text-xs px-3 py-1 rounded-lg border transition-colors disabled:opacity-50 ${e.is_published ? "border-[#ff603b]/30 text-[#ff603b] hover:bg-[#ff603b]/5" : "border-[#25bea5]/30 text-[#25bea5] hover:bg-[#25bea5]/5"}`}
                    >
                      {toggling === e.slug ? "…" : e.is_published ? "取消发布" : "发布"}
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
