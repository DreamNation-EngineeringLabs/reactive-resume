import { zodResolver } from "@hookform/resolvers/zod";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { createFileRoute, redirect, useNavigate, useRouter } from "@tanstack/react-router";
import type { BetterFetchOption } from "better-auth/client";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useToggle } from "usehooks-ts";
import z from "zod";
import { LoadingScreen } from "@/components/layout/loading-screen";
import { Button } from "@/components/ui/button";
import { authClient } from "@/integrations/auth/client";
import { client } from "@/integrations/orpc/client";
import { getSourceUrl } from "@/utils/source-url";

export const Route = createFileRoute("/auth/login")({
	component: RouteComponent,
	beforeLoad: async ({ context, location }) => {
		const trace =
			location.search && typeof location.search.trace === "string" ? location.search.trace : "none";
		console.log(`[SSOTrace:${trace}] login:beforeLoad`, {
			hasContextSession: Boolean(context.session),
			errorParam:
				location.search && typeof location.search.error === "string" ? location.search.error : null,
		});
		if (context.session) throw redirect({ to: "/dashboard", replace: true });
		return { session: null };
	},
});

const formSchema = z.object({
	identifier: z.string().trim().toLowerCase(),
	password: z.string().trim().min(6).max(64),
});

type FormValues = z.infer<typeof formSchema>;

function RouteComponent() {
	const router = useRouter();
	const navigate = useNavigate();
	const [showPassword, toggleShowPassword] = useToggle(false);
	const { flags } = Route.useRouteContext();
	const mainAppUrl = getSourceUrl();
	const [isSsoChecking, setIsSsoChecking] = useState(false);
	const [ssoError, setSsoError] = useState<string | null>(null);
	const [hasCheckedSession, setHasCheckedSession] = useState(false);
	const [isSsoFlow, setIsSsoFlow] = useState(false);

	useEffect(() => {
		if (typeof window === "undefined") return;

		const params = new URLSearchParams(window.location.search);
		const queryTrace = params.get("trace");
		const errorParam = params.get("error");

		const traceFromCookie = decodeURIComponent(
			document.cookie
				.split("; ")
				.find((row) => row.startsWith("sso_trace="))
				?.split("=")[1] ?? "none",
		);
		const trace = queryTrace ?? traceFromCookie;
		const ssoFlowActive = Boolean(queryTrace || traceFromCookie !== "none");
		setIsSsoFlow(ssoFlowActive);

		console.log(`[SSOTrace:${trace}] login:mounted`, {
			href: window.location.href,
			isSsoFlow: ssoFlowActive,
			errorParam,
		});

		if (ssoFlowActive) {
			setIsSsoChecking(true);
			setSsoError(null);
		}

		void (async () => {
			// SSO cookie/session can be visible with slight delay behind proxy/CDN hops.
			// Retry for a short window to avoid flashing the restricted screen.
			const maxAttempts = ssoFlowActive ? 10 : 1;
			const retryDelayMs = 250;

			try {
				for (let attempt = 1; attempt <= maxAttempts; attempt++) {
					const session = await client.auth.session.get();
					console.log(`[SSOTrace:${trace}] login:sessionProbe`, {
						attempt,
						maxAttempts,
						found: Boolean(session),
						userId: session?.user?.id ?? null,
					});
					if (session) {
						console.log(`[SSOTrace:${trace}] login:redirecting_to_dashboard`);
						router.invalidate();
						navigate({ to: "/dashboard", replace: true });
						return;
					}
					if (attempt < maxAttempts) {
						await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
					}
				}
				if (ssoFlowActive) setSsoError(errorParam);
			} catch {
				console.log(`[SSOTrace:${trace}] login:sessionProbe:error`);
				if (ssoFlowActive) setSsoError(errorParam ?? "session_probe_failed");
			} finally {
				setHasCheckedSession(true);
				if (ssoFlowActive) setIsSsoChecking(false);
			}
		})();
	}, [navigate, router]);

	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			identifier: "",
			password: "",
		},
	});

	const onSubmit = async (data: FormValues) => {
		const toastId = toast.loading(t`Signing in...`);

		const fetchOptions: BetterFetchOption = {
			onSuccess: (context) => {
				// Check if 2FA is required
				if (context.data && "twoFactorRedirect" in context.data && context.data.twoFactorRedirect) {
					toast.dismiss(toastId);
					navigate({ to: "/auth/verify-2fa", replace: true });
					return;
				}

				// Normal login success
				router.invalidate();
				toast.dismiss(toastId);
				navigate({ to: "/dashboard", replace: true });
			},
			onError: ({ error }) => {
				toast.error(error.message, { id: toastId });
			},
		};

		if (data.identifier.includes("@")) {
			await authClient.signIn.email({
				email: data.identifier,
				password: data.password,
				fetchOptions,
			});
		} else {
			await authClient.signIn.username({
				username: data.identifier,
				password: data.password,
				fetchOptions,
			});
		}
	};

	if (isSsoChecking) {
		return <LoadingScreen />;
	}

	if (!hasCheckedSession || isSsoChecking) {
		return <LoadingScreen />;
	}

	return (
		<div className="space-y-4 text-center">
			<h1 className="font-bold text-2xl tracking-tight">
				<Trans>Login Restricted</Trans>
			</h1>
			<p className="text-muted-foreground">
				<Trans>Please login via the main dashboard.</Trans>
			</p>
			{ssoError ? (
				<p className="text-muted-foreground text-sm">
					<Trans>SSO failed ({ssoError}). Please return to dashboard and try again.</Trans>
				</p>
			) : null}
			<Button asChild className="w-full">
				<a href={`${mainAppUrl}/placements`}>
					<Trans>Go to Dashboard</Trans>
				</a>
			</Button>
		</div>
	);
}
