"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export interface BatchAction {
  label: string;
  action: string;
  params?: Record<string, unknown>;
  danger?: boolean;
}

interface BatchBarProps {
  selectedCount: number;
  actions: BatchAction[];
  onExecute: (action: BatchAction) => Promise<void>;
  onClear: () => void;
  extra?: React.ReactNode;
}

export function BatchBar({ selectedCount, actions, onExecute, onClear, extra }: BatchBarProps) {
  const [busy, setBusy] = useState(false);

  if (selectedCount === 0) return null;

  async function handle(action: BatchAction) {
    setBusy(true);
    try {
      await onExecute(action);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-[#cc785c]/30 bg-[#cc785c]/5">
      <span className="text-sm font-medium text-[#141413]">
        已选 {selectedCount} 项
      </span>
      <button
        onClick={onClear}
        className="text-xs text-[#6c6a64] hover:text-[#141413] underline"
      >
        取消选择
      </button>
      <div className="flex-1" />
      {extra}
      {actions.map((a) => (
        <Button
          key={a.action}
          size="sm"
          variant="outline"
          disabled={busy}
          className={
            a.danger
              ? "border-[#ff603b]/30 text-[#ff603b] hover:bg-[#ff603b]/5"
              : "border-[#e6dfd8]"
          }
          onClick={() => handle(a)}
        >
          {a.label}
        </Button>
      ))}
    </div>
  );
}
