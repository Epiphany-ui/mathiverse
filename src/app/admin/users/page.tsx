/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { BatchBar, type BatchAction } from "@/components/admin/batch-bar";

interface AdminUser {
  id: string;
  username: string;
  display_name: string;
  role: string;
  banned_until: string | null;
  created_at: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [banMenuUser, setBanMenuUser] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchBanDur, setBatchBanDur] = useState("7d");

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    if (selected.size === users.length) setSelected(new Set());
    else setSelected(new Set(users.map((u) => u.id)));
  };
  const clearSelection = () => setSelected(new Set());

  const DURATION_OPTIONS = [
    { label: "1 小时", dur: "1h" },
    { label: "1 天", dur: "1d" },
    { label: "7 天", dur: "7d" },
    { label: "30 天", dur: "30d" },
    { label: "永久", dur: "" },
  ];

  const batchActions: BatchAction[] = [
    {
      label: `封禁所选（${DURATION_OPTIONS.find(o => o.dur === batchBanDur)?.label ?? batchBanDur}）`,
      action: "ban_users",
      params: { duration: batchBanDur },
    },
    { label: "解封所选", action: "unban_users" },
  ];

  const handleBatch = useCallback(async (a: BatchAction) => {
    setBatchBusy(true);
    try {
      const res = await fetch("/api/admin/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: a.action,
          targets: [...selected],
          params: a.params,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      clearSelection();
      loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "批量操作失败");
    } finally {
      setBatchBusy(false);
    }
  }, [selected]);

  async function loadUsers() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`/api/admin/users?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "加载失败");
      setUsers(data.users ?? []);
      setTotal(data.total ?? 0);
      setCurrentUserId(data.currentUserId ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadUsers(); }, [page]);

  async function toggleRole(user: AdminUser) {
    const newRole = user.role === "admin" ? "user" : "admin";
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "操作失败"); return; }
    setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, role: newRole } : u)));
  }

  async function toggleBan(user: AdminUser, duration?: string) {
    const isBanned = user.banned_until && new Date(user.banned_until) > new Date();
    const body: Record<string, unknown> = isBanned
      ? { banned: false }
      : { banned: true, duration: duration ?? null };
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "操作失败"); return; }
    setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, banned_until: data.user?.banned_until ?? null } : u)));
  }

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-[#141413]">用户管理</h1>
      {error && (
        <div className="p-3 rounded-lg border border-[#ff603b]/30 bg-[#ff603b]/5 text-sm text-[#ff603b]">
          {error}
          <button onClick={loadUsers} className="ml-3 underline">重试</button>
        </div>
      )}
      <form onSubmit={(e) => { e.preventDefault(); setPage(1); loadUsers(); }} className="flex gap-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索用户名或昵称…" className="flex-1 px-3 py-2 border border-[#e6dfd8] rounded-lg text-sm bg-white" />
        <button type="submit" className="px-4 py-2 bg-[#141413] text-white text-sm rounded-lg">搜索</button>
      </form>

      {loading ? (
        <div className="text-center py-12 text-[#9c9890]">加载中…</div>
      ) : (
        <>
          <BatchBar
            selectedCount={selected.size}
            actions={batchActions}
            onExecute={handleBatch}
            onClear={clearSelection}
            extra={
              <select
                value={batchBanDur}
                onChange={(e) => setBatchBanDur(e.target.value)}
                className="text-xs px-2 py-1 border border-[#e6dfd8] rounded-lg bg-white text-[#6c6a64]"
              >
                {DURATION_OPTIONS.map((o) => (
                  <option key={o.dur} value={o.dur}>{o.label}</option>
                ))}
              </select>
            }
          />
          <div className="border border-[#e6dfd8] rounded-xl bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#e6dfd8] bg-[#faf9f5]">
                  <th className="w-10 px-2 py-3">
                    <input type="checkbox" checked={selected.size === users.length && users.length > 0} onChange={toggleAll} className="rounded" />
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-[#6c6a64]">用户</th>
                  <th className="text-left px-4 py-3 font-medium text-[#6c6a64]">角色</th>
                  <th className="text-left px-4 py-3 font-medium text-[#6c6a64]">状态</th>
                  <th className="text-left px-4 py-3 font-medium text-[#6c6a64]">注册</th>
                  <th className="text-right px-4 py-3 font-medium text-[#6c6a64]">操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-[#e6dfd8]/50">
                    <td className="px-2 py-3">
                      <input type="checkbox" checked={selected.has(user.id)} onChange={() => toggleSelect(user.id)} className="rounded" />
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/u/${user.username}`} className="hover:text-[#cc785c]">
                        <span className="font-medium text-[#141413]">{user.display_name}</span>
                        <span className="text-[#9c9890] ml-2">@{user.username}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        user.role === "owner" ? "bg-[#4169ff]/10 text-[#4169ff]" :
                        user.role === "admin" ? "bg-[#cc785c]/10 text-[#cc785c]" :
                        "bg-[#e6dfd8] text-[#6c6a64]"
                      }`}>
                        {user.role === "owner" ? "馆长" : user.role === "admin" ? "编辑" : "用户"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        const isBanned = user.banned_until && new Date(user.banned_until) > new Date();
                        if (!isBanned) return <span className="text-xs text-[#9c9890]">正常</span>;
                        const until = new Date(user.banned_until!);
                        const isPerma = until.getFullYear() >= 2999;
                        const label = isPerma ? "永久封禁" : `封禁至 ${until.toLocaleDateString("zh-CN")}`;
                        return <span className="text-xs px-2 py-0.5 rounded-full bg-[#ff603b]/10 text-[#ff603b]">{label}</span>;
                      })()}
                    </td>
                    <td className="px-4 py-3 text-[#9c9890] text-xs">
                      {new Date(user.created_at).toLocaleDateString("zh-CN")}
                    </td>
                    <td className="px-4 py-3 text-right flex items-center justify-end gap-1">
                      {user.id !== currentUserId && user.role !== "owner" && (
                        <button
                          onClick={() => toggleRole(user)}
                          className="text-xs px-2 py-1 rounded-lg border border-[#e6dfd8] text-[#6c6a64] hover:bg-[#e6dfd8]/50 transition-colors"
                        >
                          {user.role === "admin" ? "撤编辑" : "设编辑"}
                        </button>
                      )}
                      {user.id !== currentUserId && user.role !== "owner" && (
                        (() => {
                          const isBanned = user.banned_until && new Date(user.banned_until) > new Date();
                          if (isBanned) {
                            return (
                              <button onClick={() => toggleBan(user)}
                                className="text-xs px-2 py-1 rounded-lg border border-[#25bea5]/30 text-[#25bea5] hover:bg-[#25bea5]/5 transition-colors">
                                解封
                              </button>
                            );
                          }
                          const open = banMenuUser === user.id;
                          return (
                            <div className="relative">
                              <button
                                onClick={() => setBanMenuUser(open ? null : user.id)}
                                onBlur={() => setTimeout(() => setBanMenuUser(null), 150)}
                                className="text-xs px-2 py-1 rounded-lg border border-[#ff603b]/30 text-[#ff603b] hover:bg-[#ff603b]/5 transition-colors">
                                封禁 ▾
                              </button>
                              {open && (
                                <div className="absolute right-0 top-full mt-1 bg-white border border-[#e6dfd8] rounded-lg shadow-lg py-1 z-50 min-w-[80px]">
                                  {[{ label: "1 小时", dur: "1h" }, { label: "1 天", dur: "1d" }, { label: "7 天", dur: "7d" }, { label: "30 天", dur: "30d" }, { label: "永久", dur: "" }].map((opt) => (
                                    <button key={opt.dur}
                                      onMouseDown={(e) => { e.preventDefault(); toggleBan(user, opt.dur || undefined); setBanMenuUser(null); }}
                                      className="block w-full text-left px-3 py-1.5 text-xs text-[#6c6a64] hover:bg-[#faf9f5] hover:text-[#141413]">
                                      {opt.label}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })()
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex gap-2 justify-center">
              {Array.from({ length: totalPages }, (_, i) => (
                <button key={i} onClick={() => setPage(i + 1)}
                  className={`px-3 py-1 rounded text-sm ${page === i + 1 ? "bg-[#141413] text-white" : "border border-[#e6dfd8] text-[#6c6a64]"}`}>
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
