"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Search,
  Sparkles,
  Compass,
  User,
  LogIn,
  Menu,
  LogOut,
  Settings,
  Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User as SupabaseUser } from "@supabase/supabase-js";

const NAV_ITEMS = [
  { href: "/explore", label: "发现", icon: Compass },
  { href: "/sandbox", label: "创作", icon: Sparkles },
] as const;

export function AppHeader() {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUnreadCount(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchUnreadCount(session.user.id);
        }
      },
    );

    return () => subscription.unsubscribe();
  }, []);

  const fetchUnreadCount = async (userId: string) => {
    const supabase = createClient();
    if (!supabase) return;
    const { count } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_read", false);
    setUnreadCount(count ?? 0);
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    if (supabase) {
      await supabase.auth.signOut();
      setUser(null);
      window.location.href = "/";
    }
  };

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled
          ? "bg-[#faf9f5]/95 backdrop-blur-md border-b border-[#e6dfd8] shadow-sm"
          : "bg-transparent border-b border-transparent",
      )}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-md bg-[#cc785c] flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight hidden sm:block">
            Mathiverse
          </span>
        </Link>

        {/* Nav Links */}
        <nav className="hidden md:flex items-center gap-1 ml-2">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}>
              <Button
                variant={pathname === href ? "secondary" : "ghost"}
                size="sm"
                className="gap-1.5"
              >
                <Icon className="w-4 h-4" />
                {label}
              </Button>
            </Link>
          ))}
        </nav>

        <div className="flex-1" />

        {/* Search */}
        <div
          className={cn(
            "hidden sm:flex items-center transition-all",
            searchOpen ? "w-64" : "w-10",
          )}
        >
          {searchOpen ? (
            <div className="relative w-full">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="搜索可视化、文章..."
                className="pl-8 h-9 bg-white border-[#e6dfd8] focus:border-[#cc785c]/50 rounded-lg"
                autoFocus
                onBlur={() => setSearchOpen(false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    window.location.href = `/search?q=${encodeURIComponent((e.target as HTMLInputElement).value)}`;
                  }
                }}
              />
            </div>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => setSearchOpen(true)}
            >
              <Search className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Auth / User */}
        <div className="flex items-center gap-2">
          {/* Notification bell — only when logged in */}
          {user && (
            <Link href="/settings">
              <Button
                variant="ghost"
                size="icon"
                className="relative h-9 w-9"
                title="通知"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-[#c64545] text-white text-[10px] font-bold flex items-center justify-center animate-heart-burst">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Button>
            </Link>
          )}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger>
                <Avatar className="w-8 h-8 cursor-pointer">
                  <AvatarFallback className="bg-[#cc785c] text-white text-xs">
                    {user.email?.slice(0, 2).toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={() => {
                    const uname = user.user_metadata?.username || user.email;
                    window.location.href = `/u/${uname}`;
                  }}
                >
                  <User className="w-4 h-4 mr-2" />
                  个人主页
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    window.location.href = "/settings";
                  }}
                >
                  <Settings className="w-4 h-4 mr-2" />
                  设置
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="w-4 h-4 mr-2" />
                  退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Link href="/auth/login">
                <Button variant="ghost" size="sm" className="gap-1.5">
                  <LogIn className="w-4 h-4" />
                  <span className="hidden sm:inline">登录</span>
                </Button>
              </Link>
              <Link href="/auth/register">
                <Button
                  size="sm"
                  className="gap-1.5 bg-[#cc785c] hover:bg-[#a9583e]"
                >
                  <User className="w-4 h-4" />
                  <span className="hidden sm:inline">注册</span>
                </Button>
              </Link>
            </>
          )}
        </div>

        {/* Mobile menu */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setMobileOpen(true)}
        >
          <Menu className="w-5 h-5" />
        </Button>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div
              className="absolute inset-0 bg-black/20"
              onClick={() => setMobileOpen(false)}
            />
            <div className="absolute right-0 top-0 bottom-0 w-64 bg-[#faf9f5] shadow-lg pt-16 px-4">
              <nav className="flex flex-col gap-2">
                {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
                  <Link key={href} href={href} onClick={() => setMobileOpen(false)}>
                    <Button
                      variant={pathname === href ? "secondary" : "ghost"}
                      size="sm"
                      className="gap-2 w-full justify-start"
                    >
                      <Icon className="w-4 h-4" />
                      {label}
                    </Button>
                  </Link>
                ))}
              </nav>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
