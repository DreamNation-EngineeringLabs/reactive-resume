import { t } from "@lingui/core/macro";
import { FloppyDiskIcon } from "@phosphor-icons/react";
import { createFileRoute } from "@tanstack/react-router";
import { useHotkeys } from "react-hotkeys-hook";
import { toast } from "sonner";
import { ResumePreview } from "@/components/resume/preview";
import { SectionEditOverlay } from "@/components/resume/section-edit-overlay";
import { useResumeStore } from "@/components/resume/store/resume";
import { ZoomablePreview } from "@/components/resume/zoomable-preview";
import { useIsMobile } from "@/hooks/use-mobile";
import { pageDimensionsAsPixels } from "@/schema/page";
import { BuilderToolbar } from "./-components/toolbar";

export const Route = createFileRoute("/builder/$resumeId/")({
	component: RouteComponent,
});

function RouteComponent() {
	const isMobile = useIsMobile();
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

	const preview = (
		<SectionEditOverlay>
			<ResumePreview
				showPageNumbers
				className="flex flex-col items-center space-y-6"
				pageClassName="shadow-2xl rounded"
			/>
		</SectionEditOverlay>
	);

	return (
		<div className="flex h-full flex-col overflow-hidden bg-muted/30">
			<div className="z-10 flex flex-none items-center border-b bg-background/80 px-3 py-1.5 backdrop-blur-sm">
				<BuilderToolbar />
			</div>

			{/*
				On mobile the page is scaled to fit and made pinch/pan-able — at 390px only ~49% of an
				A4 page was reachable, and the template's sidebar column sat off-screen entirely.
				Desktop keeps the original scroll-at-full-size behaviour untouched.
			*/}
			{isMobile ? (
				<ZoomablePreview contentWidth={pageWidth} className="flex flex-1 flex-col">
					<div className="py-6">{preview}</div>
				</ZoomablePreview>
			) : (
				<div className="flex-1 overflow-y-auto">
					<div className="flex h-full w-full flex-col items-center justify-start px-6 py-10">
						<div className="w-full max-w-3xl">{preview}</div>
					</div>
				</div>
			)}
		</div>
	);
}
