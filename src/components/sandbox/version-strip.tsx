import type { GenerationVersion } from "@/lib/generation/types";
const SOURCE = { generated: "生成", auto_repair: "修复", manual: "手动", rollback: "回退" } as const;
export function VersionStrip({ versions, selectedId, onSelect }: { versions: GenerationVersion[]; selectedId: string | null; onSelect: (version: GenerationVersion) => void }) {
  return <div className="versionStrip" role="list" aria-label="代码版本">{versions.length === 0 ? <span className="versionEmpty">尚无版本</span> : versions.map((version) => <button key={version.id} type="button" aria-pressed={selectedId === version.id} onClick={() => onSelect(version)}><b>V{version.sequence}</b><span>{SOURCE[version.source]}</span><i>{version.render ? "已渲染" : version.validation?.valid ? "已验证" : "草稿"}</i></button>)}</div>;
}
