import type { WikiCategory } from "@/types";

export interface WikiManifestItem {
  slug: string;
  wikipediaTitle: string; // URL-encoded title, e.g. "Euler%27s_formula"
  category: WikiCategory;
  tags?: string[];
  lang?: "en" | "zh";
}

export const WIKI_MANIFEST: WikiManifestItem[] = [
  // ─── 纯数学 ───
  {
    slug: "euler-formula",
    wikipediaTitle: "Euler%27s_formula",
    category: "pure-math",
    tags: ["复数", "三角学", "欧拉恒等式"],
  },
  {
    slug: "fourier-series",
    wikipediaTitle: "Fourier_series",
    category: "pure-math",
    tags: ["傅里叶变换", "级数", "信号处理"],
  },
  {
    slug: "riemann-zeta",
    wikipediaTitle: "Riemann_zeta_function",
    category: "pure-math",
    tags: ["数论", "素数", "复分析"],
  },
  {
    slug: "golden-ratio",
    wikipediaTitle: "Golden_ratio",
    category: "pure-math",
    tags: ["几何", "斐波那契", "无理数"],
  },
  {
    slug: "prime-number-theorem",
    wikipediaTitle: "Prime_number_theorem",
    category: "pure-math",
    tags: ["数论", "素数", "解析数论"],
  },
  {
    slug: "group-theory",
    wikipediaTitle: "Group_theory",
    category: "pure-math",
    tags: ["抽象代数", "对称", "群"],
  },
  {
    slug: "fractal",
    wikipediaTitle: "Fractal",
    category: "pure-math",
    tags: ["分形", "自相似", "豪斯多夫维数"],
  },
  {
    slug: "non-euclidean-geometry",
    wikipediaTitle: "Non-Euclidean_geometry",
    category: "pure-math",
    tags: ["几何", "黎曼", "双曲几何"],
  },
  {
    slug: "eigenvalue-eigenvector",
    wikipediaTitle: "Eigenvalues_and_eigenvectors",
    category: "pure-math",
    tags: ["线性代数", "矩阵", "特征值"],
  },
  // ─── 应用数学 ───
  {
    slug: "differential-equation",
    wikipediaTitle: "Differential_equation",
    category: "applied-math",
    tags: ["微分方程", "ODE", "PDE"],
  },
  {
    slug: "laplace-transform",
    wikipediaTitle: "Laplace_transform",
    category: "applied-math",
    tags: ["拉普拉斯变换", "ODE", "控制论"],
  },
  {
    slug: "normal-distribution",
    wikipediaTitle: "Normal_distribution",
    category: "applied-math",
    tags: ["概率", "统计", "高斯分布"],
  },
  {
    slug: "central-limit-theorem",
    wikipediaTitle: "Central_limit_theorem",
    category: "applied-math",
    tags: ["概率", "统计", "极限定理"],
  },
  {
    slug: "game-theory",
    wikipediaTitle: "Game_theory",
    category: "applied-math",
    tags: ["博弈论", "纳什均衡", "经济学"],
  },
  {
    slug: "chaos-theory",
    wikipediaTitle: "Chaos_theory",
    category: "applied-math",
    tags: ["混沌", "蝴蝶效应", "动力系统"],
  },
  {
    slug: "markov-chain",
    wikipediaTitle: "Markov_chain",
    category: "applied-math",
    tags: ["马尔可夫", "随机过程", "概率"],
  },
  {
    slug: "gradient-descent",
    wikipediaTitle: "Gradient_descent",
    category: "applied-math",
    tags: ["优化", "机器学习", "数值方法"],
  },
  {
    slug: "numerical-analysis",
    wikipediaTitle: "Numerical_analysis",
    category: "applied-math",
    tags: ["数值方法", "误差分析", "计算"],
  },
  // ─── 计算机交叉 ───
  {
    slug: "sorting-algorithm",
    wikipediaTitle: "Sorting_algorithm",
    category: "cs-overlap",
    tags: ["算法", "排序", "复杂度"],
  },
  {
    slug: "turing-machine",
    wikipediaTitle: "Turing_machine",
    category: "cs-overlap",
    tags: ["计算理论", "图灵", "可计算性"],
  },
  {
    slug: "rsa-encryption",
    wikipediaTitle: "RSA_(cryptosystem)",
    category: "cs-overlap",
    tags: ["密码学", "数论", "RSA"],
  },
  {
    slug: "backpropagation",
    wikipediaTitle: "Backpropagation",
    category: "cs-overlap",
    tags: ["机器学习", "神经网络", "梯度下降"],
  },
  {
    slug: "computational-complexity",
    wikipediaTitle: "Computational_complexity_theory",
    category: "cs-overlap",
    tags: ["复杂度", "P vs NP", "算法"],
  },
  {
    slug: "binary-search",
    wikipediaTitle: "Binary_search",
    category: "cs-overlap",
    tags: ["算法", "搜索", "二分"],
  },
  {
    slug: "huffman-coding",
    wikipediaTitle: "Huffman_coding",
    category: "cs-overlap",
    tags: ["压缩", "编码", "贪心算法"],
  },
  {
    slug: "graph-theory",
    wikipediaTitle: "Graph_theory",
    category: "cs-overlap",
    tags: ["图论", "网络", "遍历"],
  },
  {
    slug: "fast-fourier-transform",
    wikipediaTitle: "Fast_Fourier_transform",
    category: "cs-overlap",
    tags: ["FFT", "信号处理", "算法"],
  },
  {
    slug: "boolean-algebra",
    wikipediaTitle: "Boolean_algebra",
    category: "cs-overlap",
    tags: ["逻辑", "布尔代数", "数字电路"],
  },
];
