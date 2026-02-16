import { Trans } from "@lingui/react/macro";
import { HandHeartIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { SectionBase } from "../shared/section-base";

export function InformationSectionBuilder() {
	return (
		<SectionBase type="information" className="space-y-4">
			<div className="space-y-2 rounded-md border bg-sky-600 p-5 text-white dark:bg-sky-700">
				<h4 className="font-medium tracking-tight">
					<Trans>Need Help?</Trans>
				</h4>

				<div className="space-y-2 text-xs leading-normal">
					<Trans>
						<p>
							Thank you for using our resume builder! If you have any questions or feedback,
							please don't hesitate to reach out.
						</p>
						<p>
							Check out the documentation below to learn more about all the features available to help you
							create the perfect resume.
						</p>
					</Trans>
				</div>
			</div>

			<div className="flex flex-wrap gap-0.5">
				<Button asChild size="sm" variant="link" className="text-xs">
					<a href="https://docs.rxresu.me" target="_blank" rel="noopener">
						<Trans>Documentation</Trans>
					</a>
				</Button>

				<Button asChild size="sm" variant="link" className="text-xs">
					<a href="https://github.com/amruthpillai/reactive-resume" target="_blank" rel="noopener">
						<Trans>Source Code</Trans>
					</a>
				</Button>

				<Button asChild size="sm" variant="link" className="text-xs">
					<a href="https://github.com/amruthpillai/reactive-resume/issues" target="_blank" rel="noopener">
						<Trans>Report a Bug</Trans>
					</a>
				</Button>

				<Button asChild size="sm" variant="link" className="text-xs">
					<a href="https://crowdin.com/project/reactive-resume" target="_blank" rel="noopener">
						<Trans>Translations</Trans>
					</a>
				</Button>

				<Button asChild size="sm" variant="link" className="text-xs">
					<a href="https://opencollective.com/reactive-resume" target="_blank" rel="noopener">
						<Trans>Sponsors</Trans>
					</a>
				</Button>
			</div>
		</SectionBase>
	);
}
