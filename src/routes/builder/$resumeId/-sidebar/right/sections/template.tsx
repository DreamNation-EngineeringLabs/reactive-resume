import { Trans } from "@lingui/react/macro";
import { SwapIcon } from "@phosphor-icons/react";
import { isGreyColor } from "@/components/resume/hooks/use-css-variables";
import { useResumeStore } from "@/components/resume/store/resume";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { templates } from "@/dialogs/resume/template/data";
import { useDialogStore } from "@/dialogs/store";
import { SectionBase } from "../shared/section-base";

export function TemplateSectionBuilder() {
	return (
		<SectionBase type="template">
			<TemplateSectionForm />
		</SectionBase>
	);
}

function TemplateSectionForm() {
	const openDialog = useDialogStore((state) => state.openDialog);
	const template = useResumeStore((state) => state.resume.data.metadata.template);

	const metadata = templates[template];

	const onOpenTemplateGallery = () => {
		openDialog("resume.template.gallery", undefined);
	};

	return (
		<div className="flex flex-col items-start gap-y-3">
			<Button
				variant="ghost"
				onClick={onOpenTemplateGallery}
				className="group/preview relative h-auto w-full cursor-pointer p-0"
			>
				<div className="relative z-10 aspect-page w-full overflow-hidden rounded-md opacity-100 transition-opacity group-hover/preview:opacity-50">
					<img src={metadata.imageUrl} alt={metadata.name} className="size-full object-cover" />
				</div>

				<div className="absolute inset-0 flex items-center justify-center">
					<SwapIcon size={48} weight="thin" className="size-12" />
				</div>
			</Button>

			<h3 className="font-semibold text-lg capitalize tracking-tight">{metadata.name}</h3>

			<BlackAndWhiteSwitch />
		</div>
	);
}

const black = "rgba(0, 0, 0, 1)";

/** One click to black and white (any resume, old or new). Off brings back a colour; students fine-tune it in Design. */
function BlackAndWhiteSwitch() {
	const primary = useResumeStore((state) => state.resume.data.metadata.design.colors.primary);
	const updateResumeData = useResumeStore((state) => state.updateResumeData);

	const onCheckedChange = (checked: boolean) => {
		updateResumeData((draft) => {
			draft.metadata.design.colors = checked
				? { primary: black, text: black, background: "rgba(255, 255, 255, 1)" }
				: { ...draft.metadata.design.colors, primary: "rgba(0, 132, 209, 1)" };
		});
	};

	return (
		<label className="flex items-center gap-3 text-sm">
			<Switch checked={isGreyColor(primary)} onCheckedChange={onCheckedChange} />
			<Trans>Black & white</Trans>
		</label>
	);
}
