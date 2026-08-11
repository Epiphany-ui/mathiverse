export type StudioEntrance = "first" | "resume" | "settled";

export const STUDIO_PRESENTATION_MARKER = "mathiverse:studio-presented";

export function resolveStudioEntrance({
  hasPresentationMarker,
  jobId,
}: {
  hasPresentationMarker: boolean;
  jobId: string | null;
}): StudioEntrance {
  if (jobId?.trim()) return "resume";
  return hasPresentationMarker ? "settled" : "first";
}
