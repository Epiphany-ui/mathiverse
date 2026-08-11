# Local Knowledge Graph — 百科关联图谱

**Created:** 2026-08-10
**Status:** design approved

## Problem

百科词条之间彼此孤立。用户阅读"黎曼猜想"时，无法看到它和"素数定理""解析数论"的关联。缺少一种直观的方式展示数学知识之间的内在联系。

## Solution

每个词条页面底部展示局部知识图谱——当前词条为中心，辐射到与其相关的词条，节点间用 AI 生成的关系标签连线。点击节点跳转目标词条。

## Data Model

```sql
CREATE TABLE wiki_edges (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id   uuid NOT NULL REFERENCES wiki_entries(id) ON DELETE CASCADE,
  target_id   uuid NOT NULL REFERENCES wiki_entries(id) ON DELETE CASCADE,
  label       text NOT NULL,              -- AI 生成的关系描述，≤15字
  strength    float NOT NULL DEFAULT 1.0, -- 0-1 关联强度
  created_at  timestamptz DEFAULT now(),
  UNIQUE(source_id, target_id)
);

CREATE INDEX idx_wiki_edges_source ON wiki_edges(source_id);
CREATE INDEX idx_wiki_edges_target ON wiki_edges(target_id);
```

## Edge Creation Flow

### 创建新词条时

```
POST /api/wiki → 保存 wiki_entry
  ↓ (异步, fire-and-forget)
analyzeEdges(newEntry)
  → 遍历所有已有词条 (分批, 每次对比 3 个已有词条)
    → DeepSeek v4-flash (non-thinking) 判断关系
    → INSERT INTO wiki_edges (双向, 每对最多两条)
```

**Prompt:**
```
你是数学知识图谱专家。分析以下两个数学词条的关系。

词条 A: {title} — {summary}
词条 B: {title} — {summary}

返回 JSON（只输出 JSON，无额外文字）:
{
  "hasRelation": true,
  "label": "A对B的关系，≤15字中文",
  "strength": 0.85
}
```

**强度映射：**
| strength | 含义 |
|----------|------|
| 0.9-1.0 | 直接核心关系（如：黎曼猜想 ↔ 素数定理） |
| 0.7-0.9 | 强相关（同一分支） |
| 0.5-0.7 | 一般相关 |
| 0.3-0.5 | 弱相关（跨分支） |
| < 0.3 | hasRelation = false（不存边） |

### 已有词条回填

```bash
npx tsx scripts/backfill-edges.ts
```

脚本遍历 `wiki_entries` 中所有词条对（笛卡尔积去重），分批调用 AI 补关系。支持断点续传（记录已处理的 pair）。

### 手动触发

管理后台按钮"重新分析关联"：
```
POST /api/wiki/[slug]/reanalyze-edges
→ 删除该词条所有现有边
→ 重新运行 analyzeEdges
```

## UI: 局部知识图谱

### 位置

词条页面正文下方，评论区块上方。`max-w-4xl` 容器内，一个圆角卡片。

### 视觉设计

```
┌─ 知识关联 ──────────────────────────────────────────┐
│                                                       │
│              [傅里叶分析]                              │
│                 │ 提供工具                            │
│       ┌────────┴────────┐                             │
│  [解析数论] ←──→ [黎曼猜想]  ←── 猜想的一般化 ── [BSD猜想]│
│       │         ↕ 核心问题    ↕ 等价表述              │
│  [素数定理]    [Riemann-Siegel]  [随机矩阵理论]        │
│                                                       │
│                                   [展开全屏 ▸]         │
└───────────────────────────────────────────────────────┘
```

### 交互

- **节点**：圆形胶囊，当前词条高亮（brand coral），光标 pointer
- **连线 label**：hover 显示，灰色小字，白色半透明底
- **节点大小**：`strength × log(viewsCount + 1)` 归一化
- **点击节点**：`router.push(/wiki/${slug})`
- **展开全屏**：弹出 modal，内嵌全尺寸 d3-force 交互图（拖拽、缩放、搜索）
- **默认显示深度**：2 层（当前词条 + 直接关联），全屏不限

### 图谱布局

- 使用 **d3-force**（force-directed graph）
- 当前词条固定在中心
- 一级关联（直接相关）围绕中心
- 二级关联（关联的关联）在外围
- 节点有轻微磁吸，防止飞出视野

### 空状态

词条无关联时：
```
┌─ 知识关联 ──────────────────────────────┐
│                                          │
│          (・・？)                         │
│     这个词条还没有建立关联                │
│                                          │
└──────────────────────────────────────────┘
```

## Files

| File | Change |
|------|--------|
| `supabase/migrations/002_wiki_edges.sql` | **New** — wiki_edges 表 + 索引 |
| `src/lib/db/wiki.ts` | Modify — 新增 edge CRUD 函数 |
| `src/lib/wiki/edge-analyzer.ts` | **New** — AI 关系分析 + prompt |
| `src/app/api/wiki/edges/route.ts` | **New** — POST 触发分析 / GET 查询边 |
| `src/components/wiki/knowledge-graph.tsx` | **New** — D3 图谱客户端组件 |
| `src/app/wiki/[slug]/page.tsx` | Modify — 在正文下方嵌入 KnowledgeGraph |
| `scripts/backfill-edges.ts` | **New** — 回填脚本 |

## Non-Goals

- 不是全局图谱（所有词条的全量关系网）——这是局部图谱
- 不做实时分析——只在创建时分析，避免页面加载调 API
- 不支持用户手动编辑边——100% AI 生成
- 图谱不包含非百科类型（文章、可视化）
