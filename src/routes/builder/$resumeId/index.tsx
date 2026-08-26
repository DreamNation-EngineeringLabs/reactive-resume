import { t } from "@lingui/core/macro";
import { FloppyDiskIcon } from "@phosphor-icons/react";
import { createFileRoute } from "@tanstack/react-router";
import { useHotkeys } from "react-hotkeys-hook";
import { toast } from "sonner";
import { ResumePreview } from "@/components/resume/preview";
import { SectionEditOverlay } from "@/components/resume/section-edit-overlay";
import { useResumeStore } from "@/components/resume/store/resume";
import { ZoomablePreview } from "@/components/resume/zoomable-preview";
import { pageDimensionsAsPixels } from "@/schema/page";
import { BuilderToolbar } from "./-components/toolbar";

export const Route = createFileRoute("/builder/$resumeId/")({
	component: RouteComponent,
});

function RouteComponent() {
	const format = useResumeStore((state) => state.resume.data.metadata.page.format);

	useHotkeys(
		["ctrl+s", "meta+s"],
		() => {
			toast.info(t`Your changes are saved automatically.`, {
				id: "auto-save",
				icon: <FloppyDiskIcon />,
			});
		},
		{ preventDefault: true, enableOnFormTags: true },
	);

	const pageWidth = pageDimensionsAsPixels[format as keyof typeof pageDimensionsAsPixels].width;

	return (
		<div className="flex h-full flex-col overflow-hidden bg-muted/30">
			<div className="z-10 flex flex-none items-center border-b bg-background/80 px-3 py-1.5 backdrop-blur-sm">
				<BuilderToolbar />
			</div>

			{/*
				One rule for every screen: scale the page down only when it cannot fit the space it has.

				This is deliberately not a mobile breakpoint. The artboard column is 60% of the viewport,
				so a 794px A4 page stops fitting below ~1324px — meaning 1280x800 laptops were clipping
				the resume on both edges too, not just phones. The old wrapper made it worse by capping
				at `max-w-3xl` (768px), narrower than the page it contained, so the page escaped its own
				container at every width.

				ZoomablePreview keeps the scale at 1:1 whenever there is room and hides its controls,
				so a wide desktop looks and behaves exactly as before.
			*/}
			<ZoomablePreview contentWidth={pageWidth} className="flex flex-1 flex-col">
				{/* Vertical padding only — horizontal breathing room is FIT_PADDING inside ZoomablePreview,
				    because anything wider than `contentWidth` here would break the scale maths. */}
				<div className="py-8">
					<SectionEditOverlay>
						<ResumePreview
							showPageNumbers
							className="flex flex-col items-center space-y-6"
							pageClassName="shadow-2xl rounded"
						/>
					</SectionEditOverlay>
				</div>
			</ZoomablePreview>
		</div>
	);
}
