"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { AppHeader } from "@/components/layout/app-header";
import { ParticlesBackground } from "@/components/shared/particles-background";
import { FeedGrid } from "@/components/community/feed-grid";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { searchContent } from "@/lib/db/queries";
import type { FeedItem } from "@/types";

export function SearchContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(initialQuery);
  const [inputValue, setInputValue] = useState(initialQuery);
  const [results, setResults] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) return;
    let cancelled = false;
    const supabase = createClient();
    if (!supabase) return;
    queueMicrotask(() => {
      if (!cancelled) setLoading(true);
    });
    searchContent(supabase, query).then((r) => {
      if (cancelled) return;
      setResults(r);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [query]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) setResults([]);
    setQuery(inputValue);
  };

  return (
    <div className="min-h-screen flex flex-col relative">
      <ParticlesBackground />
      <AppHeader />
      <main className="flex-1 pt-24 px-6 max-w-6xl mx-auto w-full z-10 space-y-8 pb-20">
        {/* Search bar */}
        <div className="max-w-2xl mx-auto w-full">
          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="搜索可视化、文章、百科...（用户名结果在个人主页中查看）"
              className="pl-10 pr-10 h-12 text-base bg-white/5 border-white/10 focus:border-primary/50"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              autoFocus={!initialQuery}
            />
            {inputValue && (
              <button
                type="button"
                onClick={() => {
                  setInputValue("");
                  setResults([]);
                  setQuery("");
                }}
                className="absolute right-12 top-1/2 -translate-y-1/2"
              >
                <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
              </button>
            )}
            <Button
              type="submit"
              size="sm"
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-[#cc785c] hover:bg-[#a9583e] text-white"
            >
              搜索
            </Button>
          </form>
        </div>

        {/* Results */}
        {query.trim() ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              搜索「{query}」— 找到 {results.length} 个结果
            </p>
            {loading ? (
              <div className="flex justify-center py-20">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : results.length === 0 ? (
              <div className="text-center py-20">
                <Search className="w-12 h-12 mx-auto text-muted-foreground/30" />
                <p className="text-muted-foreground mt-4">
                  没有找到相关内容
                </p>
                <p className="text-muted-foreground/60 text-sm mt-1">
                  试试其他关键词，比如「傅里叶」、「梯度下降」
                </p>
              </div>
            ) : (
              <FeedGrid items={results} />
            )}
          </div>
        ) : (
          <div className="text-center py-20">
            <Search className="w-12 h-12 mx-auto text-muted-foreground/30" />
            <p className="text-muted-foreground mt-4 text-lg">
              输入关键词搜索可视化作品、文章和百科词条
            </p>
            <div className="flex flex-wrap gap-2 justify-center mt-4">
              {["傅里叶变换", "梯度下降", "欧拉公式", "排序算法", "概率分布"].map(
                (tag) => (
                  <Button
                    key={tag}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      setInputValue(tag);
                      setQuery(tag);
                    }}
                  >
                    {tag}
                  </Button>
                ),
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
