import { t } from "@lingui/core/macro";
import { PlusIcon } from "@phosphor-icons/react";
import { useDialogStore } from "@/dialogs/store";
import { BaseCard } from "./base-card";

export function CreateResumeCard() {
	const { openDialog } = useDialogStore();

	return (
		<BaseCard
			title={t`Create a new resume`}
			description={t`Start building your resume from scratch using our builder.`}
			onClick={() => openDialog("resume.create", undefined)}
			className="cursor-pointer"
		>
			<div className="flex size-full flex-col items-center justify-center p-6">
				<div className="mb-6 flex size-20 items-center justify-center rounded-[2rem] bg-primary/10 text-primary transition-all duration-300 group-hover:bg-primary group-hover:text-white group-hover:rotate-6">
					<PlusIcon weight="duotone" className="size-10" />
				</div>
				<p className="text-center font-bold text-primary uppercase tracking-widest text-xs opacity-60 group-hover:opacity-100 transition-opacity">Start fresh</p>
			</div>
		</BaseCard>
	);
}
