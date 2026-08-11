import type { StudioClientState } from "./client-state";

const LABEL = { queued: "任务已进入队列", planning: "正在规划镜头", retrieving: "正在查找数学上下文", generating: "正在绘制场景代码", validating: "正在检查场景", rendering: "正在渲染动画", repairing: "正在修复并复验" } as const;
export function GenerationStatus({ state }: { state: StudioClientState }) {
  const job = state.snapshot;
  let text = job ? LABEL[job.phase] : "描述一个数学想法，开始构建场景";
  if (job?.status === "completed") text = "动画已完成，可以预览或发布";
  if (job?.status === "cancelled") text = "任务已停止，编辑权已交还给你";
  if (job?.status === "failed") text = job.failureReason ?? "生成失败，可尝试修复或重试";
  if (state.connection === "reconnecting") text += " · 正在恢复连接";
  return <p className="statusLine" aria-live="polite" aria-atomic="true">{text}</p>;
}
