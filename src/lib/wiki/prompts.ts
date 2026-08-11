import type { AIMessage } from "@/lib/ai/client";

export const WIKI_REWRITE_SYSTEM_PROMPT = `你是 Mathiverse 的数学百科主编，负责把用户提供的 Wikipedia 英文原文改写为高质量中文百科词条。

改写规则：
1. **定义先行**：第一段给出核心概念的严谨定义（中文术语 + LaTeX 符号）
2. **使用 ## 分节**，结构建议：
   - ## 引入 — 直观动机、历史背景
   - ## 定义与形式化 — 严格的数学定义，KaTeX 公式
   - ## 关键性质 — 最重要的定理、推论、性质（带证明思路）
   - ## 历史与应用 — 谁发现的、在哪用
   - ## 动画灵感 — 2-3 个可交给 Manim 动画化的点子（具体、可操作）
3. **数学公式必须用 KaTeX**：
   - 行内公式用 $...$ 包裹（如 $e^{i\\pi} + 1 = 0$）
   - 独立公式用 $$...$$ 包裹
   - 公式需要你根据数学知识独立生成标准 LaTeX，不要依赖原文中的非标准格式
4. 中文标题，1-2 句摘要
5. 全文 1500-4000 字
6. 严格输出 JSON，不要多余文字：{"title":"中文标题","summary":"1-2句话摘要","bodyMd":"Markdown正文(含KaTeX)"}`;

export function buildWikiRewriteMessages(
  intro: string,
  fullText: string,
): AIMessage[] {
  const truncated = fullText.slice(0, 60_000);

  return [
    { role: "system", content: WIKI_REWRITE_SYSTEM_PROMPT },
    {
      role: "user",
      content: `请将以下 Wikipedia 词条改写为中文百科词条：

Wikipedia 摘要：${intro}

Wikipedia 全文：
${truncated}`,
    },
  ];
}
