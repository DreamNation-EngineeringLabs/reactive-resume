import { CaretRightIcon } from "@phosphor-icons/react";
import { Fragment } from "react";
import { match } from "ts-pattern";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { RightSidebarSection } from "@/utils/resume/section";
import { cn } from "@/utils/style";
import { useSectionStore } from "../../-store/section";
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
import { ReviewerFeedbackSectionBuilder } from "./sections/reviewer-feedback";

const primarySections: RightSidebarSection[] = ["template", "reviewer-feedback", "ats-score", "export"];
const advancedSections: RightSidebarSection[] = [
	"layout",
	"typography",
	"design",
	"page",
	"css",
	"notes",
	"sharing",
	"statistics",
];

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
		.with("reviewer-feedback", () => <ReviewerFeedbackSectionBuilder />)
		.with("export", () => <ExportSectionBuilder />)
		.exhaustive();
}

function AdvancedOptions() {
	const collapsed = useSectionStore((state) => (state.sections as any)["advanced"]?.collapsed ?? true);
	const toggleCollapsed = useSectionStore((state) => state.toggleCollapsed);

	return (
		<Accordion
			collapsible
			type="single"
			className="space-y-4"
			id="sidebar-advanced"
			value={collapsed ? "" : "advanced"}
			onValueChange={() => toggleCollapsed("advanced" as any)}
		>
			<AccordionItem value="advanced" className="group/accordion space-y-4">
				<div className="flex items-center">
					<AccordionTrigger asChild className="me-2 items-center justify-center">
						<Button size="icon" variant="ghost">
							<CaretRightIcon />
						</Button>
					</AccordionTrigger>

					<div className="flex flex-1 items-center gap-x-4">
						<h2 className="line-clamp-1 font-bold text-lg tracking-tight">Advanced Options</h2>
					</div>
				</div>

				<AccordionContent
					className={cn(
						"space-y-4 overflow-hidden pb-0 data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down",
					)}
				>
					{advancedSections.map((section) => (
						<Fragment key={section}>
							{getSectionComponent(section)}
							<Separator />
						</Fragment>
					))}
				</AccordionContent>
			</AccordionItem>
		</Accordion>
	);
}

export function BuilderSidebarRight() {
	return (
		<>
			<ScrollArea className="@container h-[calc(100svh-3.5rem)] bg-background">
				<div className="space-y-4 p-4">
					{primarySections.map((section) => (
						<Fragment key={section}>
							{getSectionComponent(section)}
							<Separator />
						</Fragment>
					))}
					<AdvancedOptions />
				</div>
			</ScrollArea>
		</>
	);
}
