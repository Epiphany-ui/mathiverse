import type { WikiCategory } from "@/types";
import { Sigma, FlaskConical, Cpu } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface WikiCategoryMeta {
  id: WikiCategory;
  label: string;
  description: string;
  icon: LucideIcon;
  color: string;
}

export const WIKI_CATEGORIES: WikiCategoryMeta[] = [
  {
    id: "pure-math",
    label: "纯数学",
    description: "数论、代数、几何、分析等基础数学分支",
    icon: Sigma,
    color: "#5db8a6",
  },
  {
    id: "applied-math",
    label: "应用数学",
    description: "微分方程、概率统计、数值分析、优化理论",
    icon: FlaskConical,
    color: "#cc785c",
  },
  {
    id: "cs-overlap",
    label: "计算机交叉",
    description: "算法、数据结构、计算理论、机器学习数学基础",
    icon: Cpu,
    color: "#e8a55a",
  },
];
