import { t } from "@lingui/core/macro";
import { FloppyDiskIcon } from "@phosphor-icons/react";
import { createFileRoute } from "@tanstack/react-router";
import { useHotkeys } from "react-hotkeys-hook";
import { toast } from "sonner";
import { ResumePreview } from "@/components/resume/preview";
import { SectionEditOverlay } from "@/components/resume/section-edit-overlay";
import { BuilderToolbar } from "./-components/toolbar";

export const Route = createFileRoute("/builder/$resumeId/")({
	component: RouteComponent,
});

function RouteComponent() {
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

	return (
		<div className="flex h-full flex-col overflow-hidden bg-muted/30">
			<div className="flex-none flex items-center border-b bg-background/80 backdrop-blur-sm px-3 py-1.5 z-10">
				<BuilderToolbar />
			</div>

			<div className="flex-1 overflow-y-auto">
				<div className="flex h-full w-full flex-col items-center justify-start px-6 py-10">
					<div className="w-full max-w-3xl">
						<SectionEditOverlay>
							<ResumePreview
								showPageNumbers
								className="flex flex-col items-center space-y-6"
								pageClassName="shadow-2xl rounded"
							/>
						</SectionEditOverlay>
					</div>
				</div>
			</div>
		</div>
	);
}
