"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LikeButton } from "@/components/shared/like-button";
import { Heart, MessageCircle, CornerDownRight } from "lucide-react";
import { useState } from "react";
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
  depth?: number;
}

function CommentItem({ comment, depth = 0 }: CommentItemProps) {
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [localReplies, setLocalReplies] = useState<Comment[]>(
    comment.replies ?? [],
  );

  const handleReply = () => {
    if (!replyText.trim()) return;
    const newReply: Comment = {
      id: `local-${Date.now()}`,
      body: replyText,
      authorId: "local",
      targetType: comment.targetType,
      targetId: comment.targetId,
      parentId: comment.id,
      likesCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      author: {
        id: "local",
        username: "我",
        displayName: "我",
        avatarUrl: null,
      },
    };
    setLocalReplies([...localReplies, newReply]);
    setReplyText("");
    setShowReply(false);
  };

  return (
    <div className={`${depth > 0 ? "ml-10 border-l-2 border-border/30 pl-4" : ""}`}>
      <div className="flex gap-3 py-3">
        <Avatar className="w-8 h-8 shrink-0">
          <AvatarFallback className="text-xs bg-gradient-to-br from-primary/60 to-secondary/60">
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
            {comment.body}
          </p>
          <div className="flex items-center gap-1">
            <LikeButton count={comment.likesCount} />
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
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleReply}
                  disabled={!replyText.trim()}
                  className="bg-gradient-to-r from-primary to-secondary text-xs h-8"
                >
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

          {localReplies.length > 0 && (
            <div className="mt-1">
              {localReplies.map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  depth={depth + 1}
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
  targetType: "visualization" | "article";
  targetId: string;
}

export function CommentList({
  comments,
  targetType,
  targetId,
}: CommentListProps) {
  const [newComment, setNewComment] = useState("");
  const [localComments, setLocalComments] = useState(comments);

  const handleAdd = () => {
    if (!newComment.trim()) return;
    const comment: Comment = {
      id: `local-${Date.now()}`,
      body: newComment,
      authorId: "local",
      targetType,
      targetId,
      parentId: null,
      likesCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      author: {
        id: "local",
        username: "我",
        displayName: "我",
        avatarUrl: null,
      },
      replies: [],
    };
    setLocalComments([comment, ...localComments]);
    setNewComment("");
  };

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
        <Button
          size="sm"
          onClick={handleAdd}
          disabled={!newComment.trim()}
          className="bg-gradient-to-r from-primary to-secondary"
        >
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
            <CommentItem key={c.id} comment={c} />
          ))}
        </div>
      )}
    </div>
  );
}
