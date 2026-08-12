"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, FileText, BookOpen } from "lucide-react";

const NAV_ITEMS = [
  { href: "/admin", label: "数据看板", icon: LayoutDashboard },
  { href: "/admin/users", label: "用户管理", icon: Users },
  { href: "/admin/content", label: "内容管理", icon: FileText },
  { href: "/admin/wiki", label: "Wiki 审核", icon: BookOpen },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="w-56 min-h-full border-r border-[#e6dfd8] bg-white/50 p-4 space-y-1 shrink-0">
      <div className="px-3 py-2 mb-4">
        <span className="text-xs font-medium text-[#9c9890] uppercase tracking-wider">
          管理后台
        </span>
      </div>
      {NAV_ITEMS.map((item) => {
        const isActive =
          item.href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              isActive
                ? "bg-[#cc785c]/10 text-[#cc785c] font-medium"
                : "text-[#6c6a64] hover:bg-[#e6dfd8]/40 hover:text-[#141413]"
            }`}
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
