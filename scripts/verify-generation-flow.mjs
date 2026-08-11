const baseUrl = process.env.GENERATION_SMOKE_BASE_URL?.replace(/\/$/, "");
if (!baseUrl) {
  console.log("SKIP: set GENERATION_SMOKE_BASE_URL to run the live AI Studio smoke test.");
  process.exit(process.env.CI ? 1 : 0);
}

let cookie = "";

async function createJob(body) {
  const startedAt = performance.now();
  const response = await fetch(`${baseUrl}/api/generation/jobs`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";", 1)[0];
  const acceptedMs = Math.round(performance.now() - startedAt);
  if (!response.ok) {
    throw new Error(`Generation request failed with HTTP ${response.status}.`);
  }
  const result = await response.json();
  if (result.status !== "accepted" || !result.jobId || acceptedMs >= 1_000) {
    throw new Error("Generation API did not accept the job within one second.");
  }
  return { ...result, acceptedMs };
}

async function consumeJob(jobId) {
  const response = await fetch(`${baseUrl}/api/generation/jobs/${jobId}/events`, {
    headers: {
      accept: "text/event-stream",
      ...(cookie ? { cookie } : {}),
    },
    signal: AbortSignal.timeout(300_000),
  });
  if (!response.ok || !response.body) {
    throw new Error(`Generation event stream failed with HTTP ${response.status}.`);
  }

  const events = [];
  const decoder = new TextDecoder();
  let buffer = "";
  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const records = buffer.split("\n\n");
    buffer = records.pop() ?? "";
    for (const record of records) {
      const data = record
        .split("\n")
        .find((line) => line.startsWith("data: "));
      if (!data) continue;
      const event = JSON.parse(data.slice(6));
      events.push(event);
      if (event.type === "job.failed" || event.type === "job.cancelled") {
        throw new Error(`Generation ended as ${event.type}.`);
      }
      if (event.type === "job.completed") {
        await response.body.cancel();
        return events;
      }
    }
  }
  throw new Error("Generation stream closed without job.completed.");
}

const generated = await createJob({
  operation: "generate",
  mode: "new",
  prompt: "Draw and label a unit circle.",
  currentCode: null,
  parentJobId: null,
  quality: "-ql",
  format: "mp4",
});
const generatedEvents = await consumeJob(generated.jobId);
const phaseNames = new Set(
  generatedEvents
    .filter((event) => event.type === "phase.changed")
    .map((event) => event.data.phase),
);
for (const required of ["planning", "generating", "validating", "rendering"]) {
  if (!phaseNames.has(required)) throw new Error(`Missing ${required} phase.`);
}
const generatedVersion = generatedEvents.find(
  (event) => event.type === "version.created",
)?.data.version;
const preview = generatedEvents.find(
  (event) => event.type === "job.completed",
)?.data.render;
if (!generatedVersion?.code || !preview?.url) {
  throw new Error("Generation completed without code or playable media.");
}

const highQuality = await createJob({
  operation: "high_quality_render",
  mode: "edit",
  prompt: "Render the accepted scene at high quality.",
  currentCode: generatedVersion.code,
  parentJobId: generated.jobId,
  sourceVersionId: generatedVersion.id,
  quality: "-qh",
  format: "mp4",
});
const highQualityEvents = await consumeJob(highQuality.jobId);
const highQualityArtifact = highQualityEvents.find(
  (event) => event.type === "job.completed",
)?.data.render;
if (!highQualityArtifact?.url || highQualityArtifact.quality !== "-qh") {
  throw new Error("High-quality child render did not produce a -qh artifact.");
}

console.log(
  JSON.stringify({
    status: "PASS",
    acceptedMs: generated.acceptedMs,
    observedEvents: generatedEvents.length,
    previewCacheHit: Boolean(preview.cacheHit),
    highQualityAcceptedMs: highQuality.acceptedMs,
  }),
);
