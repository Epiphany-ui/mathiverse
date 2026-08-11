import { SandboxContent } from "./sandbox-content";

type SandboxSearchParams = Promise<{
  fork?: string | string[];
  job?: string | string[];
  prompt?: string | string[];
}>;

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function SandboxPage({
  searchParams,
}: {
  searchParams: SandboxSearchParams;
}) {
  const query = await searchParams;
  return (
    <SandboxContent
      forkId={firstValue(query.fork) || null}
      initialPrompt={firstValue(query.prompt)}
      jobId={firstValue(query.job).trim() || null}
    />
  );
}
