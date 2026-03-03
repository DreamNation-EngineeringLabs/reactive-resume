import { env } from "./env";

/**
 * Get the source URL (dashboard origin) from the cookie set during SSO.
 * Falls back to VITE_MAIN_APP_URL env var or localhost.
 *
 * This allows the resume app (shared resource) to redirect back
 * to the correct tenant subdomain that the user came from.
 */
export function getSourceUrl(): string {
  if (typeof document !== "undefined") {
    const match = document.cookie
      .split("; ")
      .find((row) => row.startsWith("source_url="));
    if (match) {
      return decodeURIComponent(match.split("=")[1]!);
    }
  }
  return env.VITE_MAIN_APP_URL ?? "http://localhost:3000";
}
