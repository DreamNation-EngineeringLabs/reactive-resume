import { t } from "@lingui/core/macro";
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { useDialogStore } from "@/dialogs/store";
import { BaseCard } from "./base-card";

export function ImportResumeCard() {
	const { openDialog } = useDialogStore();

	return (
		<BaseCard
			title={t`Import an existing resume`}
			description={t`Continue where you left off`}
			headerColor="bg-emerald-600"
			accentColor="text-emerald-600"
			onClick={() => openDialog("resume.import", undefined)}
			className="cursor-pointer transition-all hover:-translate-y-1 hover:shadow-md active:scale-[0.98]"
		>
			<div className="flex size-full flex-col items-center justify-center bg-gradient-to-br from-emerald-50 via-emerald-50 to-slate-50 p-6">
				<div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100">
					<DownloadSimpleIcon weight="duotone" className="size-8 text-emerald-600" />
				</div>
				<p className="text-center text-sm font-medium text-slate-600">Upload file</p>
			</div>
		</BaseCard>
	);
}
