import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDialogStore } from "@/dialogs/store";

export function CreateResumeCard() {
	const { openDialog } = useDialogStore();

	const handleCreate = () => openDialog("resume.create", undefined);
	const handleBrowseTemplates = (event: React.MouseEvent) => {
		event.stopPropagation();
		event.preventDefault();
		openDialog("resume.template.browse", undefined);
	};

	return (
		<button
			type="button"
			onClick={handleCreate}
			className="group tap-active flex h-full min-h-[420px] cursor-pointer flex-col items-center justify-center gap-4 rounded-[1.75rem] border-2 border-slate-200 border-dashed bg-card/40 p-8 text-center transition-all duration-300 hover:-translate-y-1 hover:border-primary hover:bg-primary/5 hover:shadow-lg"
		>
			<div className="flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/20 transition-transform duration-300 group-hover:rotate-90 group-hover:scale-105">
				<Plus strokeWidth={2.5} className="size-7" />
			</div>

			<div className="space-y-1.5">
				<p className="font-bold text-base text-slate-900">{t`Create New`}</p>
				<p className="max-w-[220px] text-slate-500 text-xs leading-relaxed">
					<Trans>Start fresh or use AI to generate a tailored baseline.</Trans>
				</p>
			</div>

			<Button
				size="sm"
				variant="outline"
				onClick={handleBrowseTemplates}
				className="rounded-full border-primary/30 font-semibold text-primary hover:bg-primary hover:text-primary-foreground"
			>
				<Trans>Explore Templates</Trans>
			</Button>
		</button>
	);
}
