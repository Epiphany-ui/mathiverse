import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Check whether a URL points to the local Manim renderer (dev only). */
export function isLocalRendererUrl(url: string | null | undefined): url is string {
  if (!url) return false
  try {
    const parsed = new URL(url)
    return (
      (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost") &&
      parsed.port === "9876" &&
      (parsed.protocol === "http:" || parsed.protocol === "https:")
    )
  } catch {
    return false
  }
}

/**
 * Normalize a user-supplied personal website URL. Accepts only http/https
 * (blocking javascript:, data: and other schemes); a bare "example.com" gets
 * an https:// prefix. Returns "" for anything unparseable.
 */
export function sanitizeWebsiteUrl(raw: string | null | undefined): string {
  if (!raw) return ""
  const trimmed = raw.trim()
  if (!trimmed) return ""
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const parsed = new URL(candidate)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return ""
    return parsed.toString()
  } catch {
    return ""
  }
}
