"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LikeButton } from "@/components/shared/like-button";
import { CornerDownRight, Loader2 } from "lucide-react";
import { useState, useCallback, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { addComment } from "@/lib/db/interactions";
import { MathText } from "@/components/content/math-text";
import type { Comment } from "@/types";

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);

  if (diffSec < 60) return "刚刚";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} 分钟前`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} 小时前`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)} 天前`;
  return new Date(dateStr).toLocaleDateString("zh-CN");
}

interface CommentItemProps {
  comment: Comment;
  targetType: "visualization" | "article" | "wiki";
  targetId: string;
  depth?: number;
  onReplyAdded?: () => void;
}

function CommentItem({
  comment,
  targetType,
  targetId,
  depth = 0,
  onReplyAdded,
}: CommentItemProps) {
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  const handleReply = useCallback(async () => {
    if (!replyText.trim() || submitting) return;

    const supabase = createClient();
    if (!supabase) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = `/auth/login?redirect=${encodeURIComponent(window.location.pathname)}`;
      return;
    }

    setSubmitting(true);
    setReplyError(null);
    try {
    const result = await addComment(supabase, {
      body: replyText.trim(),
      authorId: user.id,
      targetType,
      targetId,
      parentId: comment.id,
    });

    setSubmitting(false);

    if (result.data) {
      setReplyText("");
      setShowReply(false);
      setReplyError(null);
      onReplyAdded?.();
    } else if (result.error) {
      setReplyError(result.error);
    }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "回复发表失败，请稍后重试";
      setSubmitting(false);
      setReplyError(message);
    }
  }, [replyText, submitting, targetType, targetId, comment.id, onReplyAdded]);

  return (
    <div className={`${depth > 0 ? "ml-10 border-l-2 border-border/30 pl-4" : ""}`}>
      <div className="flex gap-3 py-3">
        <Avatar className="w-8 h-8 shrink-0">
          {comment.author?.avatarUrl ? (
            <AvatarImage src={comment.author.avatarUrl} alt="" />
          ) : null}
          <AvatarFallback className="text-xs bg-[#cc785c] text-white">
            {comment.author?.displayName?.slice(0, 1) ?? "?"}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">
              {comment.author?.displayName ?? "匿名"}
            </span>
            <span className="text-xs text-muted-foreground">
              @{comment.author?.username ?? "unknown"}
            </span>
            <span className="text-xs text-muted-foreground/60">
              {timeAgo(comment.createdAt)}
            </span>
          </div>
          <p className="text-sm text-foreground/85 leading-relaxed">
            <MathText text={comment.body} />
          </p>
          <div className="flex items-center gap-1">
            <LikeButton
              targetType="comment"
              targetId={comment.id}
              count={comment.likesCount}
            />
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 h-8 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setShowReply(!showReply)}
            >
              <CornerDownRight className="w-3.5 h-3.5" />
              回复
            </Button>
          </div>

          {showReply && (
            <div className="space-y-2 pt-1">
              <Textarea
                placeholder={`回复 @${comment.author?.username}...`}
                className="min-h-[60px] text-sm resize-none bg-white/5 border-white/10"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                autoFocus
              />
              {replyError && (
                <p className="text-xs text-red-500">{replyError}</p>
              )}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleReply}
                  disabled={!replyText.trim() || submitting}
                  className="bg-[#cc785c] hover:bg-[#a9583e] text-white text-xs h-8"
                >
                  {submitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : null}
                  回复
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowReply(false)}
                  className="text-xs h-8"
                >
                  取消
                </Button>
              </div>
            </div>
          )}

          {comment.replies && comment.replies.length > 0 && (
            <div className="mt-1">
              {comment.replies.map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  targetType={targetType}
                  targetId={targetId}
                  depth={depth + 1}
                  onReplyAdded={onReplyAdded}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface CommentListProps {
  comments: Comment[];
  targetType: "visualization" | "article" | "wiki";
  targetId: string;
}

export function CommentList({
  comments,
  targetType,
  targetId,
}: CommentListProps) {
  const [newComment, setNewComment] = useState("");
  const [localComments, setLocalComments] = useState(comments);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prevTargetRef = useRef(targetId);

  // Sync when props change (navigation to a different page)
  useEffect(() => {
    if (prevTargetRef.current !== targetId) {
      setLocalComments(comments);
      prevTargetRef.current = targetId;
    }
  }, [comments, targetId]);

  const handleAdd = useCallback(async () => {
    if (!newComment.trim() || submitting) return;

    const supabase = createClient();
    if (!supabase) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = `/auth/login?redirect=${encodeURIComponent(window.location.pathname)}`;
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
    const result = await addComment(supabase, {
      body: newComment.trim(),
      authorId: user.id,
      targetType,
      targetId,
    });

    if (result.data) {
      setError(null);
      // Transform the Supabase row to our Comment type
      const newCommentObj: Comment = {
        id: result.data.id,
        body: result.data.body,
        authorId: result.data.author_id,
        targetType: result.data.target_type,
        targetId: result.data.target_id,
        parentId: result.data.parent_id,
        likesCount: 0,
        createdAt: result.data.created_at,
        updatedAt: result.data.updated_at,
        author: result.data.profiles
          ? {
              id: result.data.profiles.id,
              username: result.data.profiles.username,
              displayName: result.data.profiles.display_name,
              avatarUrl: result.data.profiles.avatar_url,
            }
          : undefined,
        replies: [],
      };

      setLocalComments([newCommentObj, ...localComments]);
      setNewComment("");
    } else if (result.error) {
      setError(result.error);
    }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "评论发表失败，请稍后重试";
      setError(message);
    }

    setSubmitting(false);
  }, [newComment, submitting, targetType, targetId, localComments]);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">
        评论 ({localComments.length})
      </h2>

      {/* New comment form */}
      <div className="space-y-3">
        <Textarea
          placeholder="写下你的想法..."
          className="min-h-[80px] resize-none bg-white/5 border-white/10"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
        />
        {error && (
          <p className="text-xs text-red-500">{error}</p>
        )}
        <Button
          size="sm"
          onClick={handleAdd}
          disabled={!newComment.trim() || submitting}
          className="bg-[#cc785c] hover:bg-[#a9583e] text-white"
        >
          {submitting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
          ) : null}
          发表评论
        </Button>
      </div>

      {/* Comment tree */}
      {localComments.length === 0 ? (
        <p className="text-muted-foreground text-sm py-8 text-center">
          暂无评论，来说点什么吧
        </p>
      ) : (
        <div className="divide-y divide-border/20">
          {localComments.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              targetType={targetType}
              targetId={targetId}
              onReplyAdded={async () => {
                const supabase = createClient();
                if (!supabase) return;
                const { getCommentsForTarget } = await import("@/lib/db/queries");
                const updated = await getCommentsForTarget(supabase, targetType, targetId);
                setLocalComments(updated);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
