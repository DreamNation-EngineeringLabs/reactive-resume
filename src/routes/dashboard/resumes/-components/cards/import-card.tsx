import { t } from "@lingui/core/macro";
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { useDialogStore } from "@/dialogs/store";
import { BaseCard } from "./base-card";

export function ImportResumeCard() {
	const { openDialog } = useDialogStore();

	return (
		<BaseCard
			title={t`Import an existing resume`}
			description={t`Upload your existing resume to continue building.`}
			accentColor="text-emerald-600"
			onClick={() => openDialog("resume.import", undefined)}
			className="cursor-pointer"
		>
			<div className="flex size-full flex-col items-center justify-center p-6">
				<div className="mb-6 flex size-20 items-center justify-center rounded-[2rem] bg-emerald-100/50 text-emerald-600 transition-all duration-300 group-hover:-rotate-6 group-hover:bg-emerald-600 group-hover:text-white">
					<DownloadSimpleIcon weight="duotone" className="size-10" />
				</div>
				<p className="text-center font-bold text-emerald-600 text-xs uppercase tracking-widest opacity-60 transition-opacity group-hover:opacity-100">
					Upload file
				</p>
			</div>
		</BaseCard>
	);
}
