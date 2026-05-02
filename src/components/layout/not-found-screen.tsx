import { Trans } from "@lingui/react/macro";
import { ArrowLeftIcon, WarningIcon } from "@phosphor-icons/react";
import type { NotFoundRouteProps } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { getPlacementsUrl } from "@/utils/source-url";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { BrandIcon } from "../ui/brand-icon";

export function NotFoundScreen({ routeId }: NotFoundRouteProps) {
	return (
		<div className="mx-auto flex h-svh max-w-md flex-col items-center justify-center gap-y-4">
			<BrandIcon variant="logo" className="h-10 w-auto" />

			<Alert>
				<WarningIcon />
				<AlertTitle>
					<Trans>An error occurred while loading the page.</Trans>
				</AlertTitle>
				<AlertDescription>{routeId}</AlertDescription>
			</Alert>

			<Button asChild>
				<a href={getPlacementsUrl()}>
					<ArrowLeftIcon />
					<Trans>Go to Dashboard</Trans>
				</a>
			</Button>
		</div>
	);
}
