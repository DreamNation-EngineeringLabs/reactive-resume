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
			headerColor="bg-blue-600"
			accentColor="text-blue-600"
			onClick={() => openDialog("resume.create", undefined)}
			className="cursor-pointer transition-all hover:-translate-y-1 hover:shadow-md active:scale-[0.98]"
		>
			<div className="flex size-full flex-col items-center justify-center bg-gradient-to-br from-blue-50 via-blue-50 to-slate-50 p-6">
				<div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100">
					<PlusIcon weight="duotone" className="size-8 text-blue-600" />
				</div>
				<p className="text-center text-sm font-medium text-slate-600">Start fresh</p>
			</div>
		</BaseCard>
	);
}
