import { Fragment } from "react";
import { match } from "ts-pattern";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
	type RightSidebarSection,
	rightSidebarSections,
} from "@/utils/resume/section";
import { ATSScoreSectionBuilder } from "./sections/ats-score";
import { CSSSectionBuilder } from "./sections/css";
import { DesignSectionBuilder } from "./sections/design";
import { ExportSectionBuilder } from "./sections/export";
import { LayoutSectionBuilder } from "./sections/layout";
import { NotesSectionBuilder } from "./sections/notes";
import { PageSectionBuilder } from "./sections/page";
import { SharingSectionBuilder } from "./sections/sharing";
import { StatisticsSectionBuilder } from "./sections/statistics";
import { TemplateSectionBuilder } from "./sections/template";
import { TypographySectionBuilder } from "./sections/typography";

function getSectionComponent(type: RightSidebarSection) {
	return match(type)
		.with("template", () => <TemplateSectionBuilder />)
		.with("layout", () => <LayoutSectionBuilder />)
		.with("typography", () => <TypographySectionBuilder />)
		.with("design", () => <DesignSectionBuilder />)
		.with("page", () => <PageSectionBuilder />)
		.with("css", () => <CSSSectionBuilder />)
		.with("notes", () => <NotesSectionBuilder />)
		.with("sharing", () => <SharingSectionBuilder />)
		.with("statistics", () => <StatisticsSectionBuilder />)
		.with("ats-score", () => <ATSScoreSectionBuilder />)
		.with("export", () => <ExportSectionBuilder />)
		.exhaustive();
}

export function BuilderSidebarRight() {
	return (
		<>
			<ScrollArea className="@container h-[calc(100svh-3.5rem)] bg-background">
				<div className="space-y-4 p-4">
					{rightSidebarSections.map((section) => (
						<Fragment key={section}>
							{getSectionComponent(section)}
							<Separator />
						</Fragment>
					))}
				</div>
			</ScrollArea>
		</>
	);
}
