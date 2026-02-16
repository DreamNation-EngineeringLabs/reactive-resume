import { t } from "@lingui/core/macro";
import { PlusIcon } from "@phosphor-icons/react";
import { useDialogStore } from "@/dialogs/store";
import { BaseCard } from "./base-card";

export function CreateResumeCard() {
	const { openDialog } = useDialogStore();

	return (
		<BaseCard
			title={t`Create a new resume`}
			description={t`Start building your resume from scratch`}
			onClick={() => openDialog("resume.create", undefined)}
			className="cursor-pointer hover:border-primary/50 hover:bg-slate-50"
		>
			<div className="flex size-full items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
				<PlusIcon weight="thin" className="size-12 text-slate-400" />
			</div>
		</BaseCard>
	);
}
