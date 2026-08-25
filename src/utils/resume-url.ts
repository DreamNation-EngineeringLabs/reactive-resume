/**
 * The app is mounted under a base path (vite `base: "/resume/"`, router `basepath: "/resume"`),
 * so `window.location.origin` alone is NOT a valid prefix for an in-app link: it points outside
 * the mounted app and 404s.
 *
 * The public resume page lives at routes/$username/$slug.tsx, i.e. /resume/<username>/<slug>.
 * Every caller that hand-built `${origin}/${username}/${slug}` produced a link that could never
 * resolve — which is why "Copy share link" copied a dead URL.
 */
const APP_BASE_PATH = "/resume";

/** Origin + base path, no trailing slash. */
export function appBaseUrl(): string {
	if (typeof window === "undefined") return APP_BASE_PATH;
	return `${window.location.origin}${APP_BASE_PATH}`;
}

/** Public, shareable URL for a resume. Only resolves while the resume is public. */
export function publicResumeUrl(username: string, slug: string): string {
	return `${appBaseUrl()}/${username}/${slug}`;
}

/** Prefix shown next to the slug field, e.g. https://host/resume/<username>/ */
export function publicResumeUrlPrefix(username: string): string {
	return `${appBaseUrl()}/${username}/`;
}
