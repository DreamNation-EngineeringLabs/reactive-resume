import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
	clientPrefix: "VITE_",
	runtimeEnv: process.env,
	emptyStringAsUndefined: true,

	client: {
		VITE_MAIN_APP_URL: z.string().url().optional(),
		/** Full placements/Services URL on the main app (optional). Overrides path built from origin. */
		VITE_MAIN_APP_PLACEMENTS_URL: z
			.string()
			.optional()
			.refine((v) => !v || /^https?:\/\/.+/i.test(v), "Must be an absolute http(s) URL"),
		/**
		 * Set to "true" to print verbose dashboard lifecycle logs (SSO, route lifecycle, ORPC handler,
		 * query state, render guards). VITE_ prefix is required so the flag is available in the
		 * client bundle; the SSR side reads the same value from `process.env`.
		 */
		VITE_FLAG_DEBUG_DASHBOARD: z.stringbool().default(false),
	},

	server: {
		// Server
		TZ: z.string().default("Etc/UTC"),
		APP_URL: z.url({ protocol: /https?/ }),
		PRINTER_APP_URL: z.url({ protocol: /https?/ }).optional(),

		// Printer
		PRINTER_ENDPOINT: z.url({ protocol: /^(wss?|https?)$/ }),

		// Database
		DATABASE_URL: z.url({ protocol: /postgres(ql)?/ }),

		// Eng-Labs Database (read-only, for student/section data)
		ENG_LABS_DATABASE_URL: z.url({ protocol: /postgres(ql)?/ }).optional(),

		// Authentication
		AUTH_SECRET: z.string().min(1),
		MAIN_APP_SECRET: z.string().min(1).optional(),
		// Comma-separated list of additional trusted origins (e.g. custom domains)
		TRUSTED_ORIGINS: z
			.string()
			.optional()
			.transform((value) => (value ? value.split(",").map((s) => s.trim()) : [])),

		// Public URL of the main (eng-labs) web app — origin used for "back to placements" / SSO exit links.
		// Set when the resume app is on a different host or port than the main app (e.g. resume :3001, main :3003).
		MAIN_APP_PUBLIC_URL: z.url({ protocol: /https?/ }).optional(),

		// Full URL for the main app Services / placements tab (optional), including query e.g. ?tab=services.
		MAIN_APP_PLACEMENTS_URL: z
			.string()
			.optional()
			.refine((v) => !v || /^https?:\/\/.+/i.test(v), "MAIN_APP_PLACEMENTS_URL must be an absolute http(s) URL"),

		// Main App API (for placement access checks)
		MAIN_APP_API_URL: z.url({ protocol: /https?/ }).optional(),
		INTERNAL_API_SECRET: z.string().min(1).optional(),

		// Social Auth (Google)
		GOOGLE_CLIENT_ID: z.string().min(1).optional(),
		GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),

		// Social Auth (GitHub)
		GITHUB_CLIENT_ID: z.string().min(1).optional(),
		GITHUB_CLIENT_SECRET: z.string().min(1).optional(),

		// Custom OAuth Provider
		OAUTH_PROVIDER_NAME: z.string().min(1).optional(),
		OAUTH_CLIENT_ID: z.string().min(1).optional(),
		OAUTH_CLIENT_SECRET: z.string().min(1).optional(),
		OAUTH_DISCOVERY_URL: z.url({ protocol: /https?/ }).optional(),
		OAUTH_AUTHORIZATION_URL: z.url({ protocol: /https?/ }).optional(),
		OAUTH_TOKEN_URL: z.url({ protocol: /https?/ }).optional(),
		OAUTH_USER_INFO_URL: z.url({ protocol: /https?/ }).optional(),
		OAUTH_SCOPES: z
			.string()
			.min(1)
			.transform((value) => value.split(" "))
			.default(["openid", "profile", "email"]),

		// Email (SMTP)
		SMTP_HOST: z.string().min(1).optional(),
		SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
		SMTP_USER: z.string().min(1).optional(),
		SMTP_PASS: z.string().min(1).optional(),
		SMTP_FROM: z.string().min(1).optional(),
		SMTP_SECURE: z.stringbool().default(false),

		// Storage (Optional)
		S3_ACCESS_KEY_ID: z.string().min(1).optional(),
		S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
		S3_REGION: z.string().default("us-east-1"),
		S3_ENDPOINT: z.url({ protocol: /https?/ }).optional(),
		S3_BUCKET: z.string().min(1).optional(),
		// Set to "true" for path-style URLs (endpoint/bucket), common with MinIO, SeaweedFS, etc.
		// Set to "false" for virtual-hosted-style URLs (bucket.endpoint), common with AWS S3, Cloudflare R2, etc.
		S3_FORCE_PATH_STYLE: z.stringbool().default(false),

		// Feature Flags
		FLAG_DEBUG_PRINTER: z.stringbool().default(false),
		FLAG_DISABLE_SIGNUPS: z.stringbool().default(false),
		FLAG_DISABLE_EMAIL_AUTH: z.stringbool().default(false),
		FLAG_DISABLE_IMAGE_PROCESSING: z.stringbool().default(false),
		FLAG_SSO_ONLY: z.stringbool().default(false),

		// AI Integration (OpenAI)
		OPENAI_API_KEY: z.string().min(1).optional(),
		OPENAI_MODEL: z.string().default("gpt-4o"),
		OPENAI_BASE_URL: z.url({ protocol: /https?/ }).default("https://api.openai.com/v1"),
	},
});
