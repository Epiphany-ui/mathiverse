export const GALLERY_MEDIA_STARTUP_TIMEOUT_MS = 6_000;

export type GalleryMediaState =
  | "checking"
  | "video"
  | "fallback"
  | "paused";

export type GalleryMediaEvent =
  | { type: "source-changed" }
  | { type: "played" }
  | { type: "paused" }
  | { type: "failed" };

export function galleryMediaReducer(
  state: GalleryMediaState,
  event: GalleryMediaEvent,
): GalleryMediaState {
  if (event.type === "failed") return "fallback";
  if (event.type === "source-changed") return "checking";
  if (state === "fallback") return state;
  return event.type === "played" ? "video" : "paused";
}
