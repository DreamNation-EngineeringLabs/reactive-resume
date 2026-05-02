import { Trans } from "@lingui/react/macro";
import { ArrowClockwiseIcon, ArrowLeftIcon, WarningIcon } from "@phosphor-icons/react";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { getPlacementsUrl } from "@/utils/source-url";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { BrandIcon } from "../ui/brand-icon";

export function ErrorScreen({ error, reset }: ErrorComponentProps) {
	return (
		<div className="mx-auto flex h-svh max-w-md flex-col items-center justify-center gap-y-4">
			<BrandIcon variant="logo" className="h-10 w-auto" />

			<Alert>
				<WarningIcon />
				<AlertTitle>
					<Trans>An error occurred while loading the page.</Trans>
				</AlertTitle>
				<AlertDescription>{error.message}</AlertDescription>
			</Alert>

			<div className="flex gap-2">
				<Button variant="outline" onClick={reset}>
					<ArrowClockwiseIcon />
					<Trans>Refresh</Trans>
				</Button>
				<Button asChild>
					<a href={getPlacementsUrl()}>
						<ArrowLeftIcon />
						<Trans>Go to Dashboard</Trans>
					</a>
				</Button>
			</div>
		</div>
	);
}
