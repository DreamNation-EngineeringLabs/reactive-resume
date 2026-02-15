import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { createFileRoute, redirect, useNavigate, useRouter } from "@tanstack/react-router";
import type { BetterFetchOption } from "better-auth/client";
import { toast } from "sonner";
import { useToggle } from "usehooks-ts";
import z from "zod";
import { Button } from "@/components/ui/button";
import { authClient } from "@/integrations/auth/client";

export const Route = createFileRoute("/auth/login")({
	component: RouteComponent,
	beforeLoad: async ({ context }) => {
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

	return (
		<div className="space-y-4 text-center">
			<h1 className="font-bold text-2xl tracking-tight">
				<Trans>Login Restricted</Trans>
			</h1>
			<p className="text-muted-foreground">
				<Trans>Please login via the main dashboard.</Trans>
			</p>
			<Button asChild className="w-full">
				<a href="http://localhost:3000/placements">
					<Trans>Go to Dashboard</Trans>
				</a>
			</Button>
		</div>
	);
}
