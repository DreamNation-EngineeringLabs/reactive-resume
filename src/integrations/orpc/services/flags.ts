import { env } from "@/utils/env";

export type FeatureFlags = {
	disableSignups: boolean;
	disableEmailAuth: boolean;
	ssoOnly: boolean;
};

export const flagsService = {
	getFlags: (): FeatureFlags => ({
		disableSignups: env.FLAG_DISABLE_SIGNUPS,
		disableEmailAuth: env.FLAG_DISABLE_EMAIL_AUTH,
		ssoOnly: env.FLAG_SSO_ONLY,
	}),
};
