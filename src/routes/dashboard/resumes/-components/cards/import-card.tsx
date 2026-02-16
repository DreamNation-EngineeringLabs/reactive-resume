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
			onClick={() => openDialog("resume.import", undefined)}
			className="cursor-pointer hover:border-primary/50 hover:bg-slate-50"
		>
			<div className="flex size-full items-center justify-center bg-linear-to-br from-slate-50 to-slate-100">
				<DownloadSimpleIcon weight="thin" className="size-12 text-slate-400" />
			</div>
		</BaseCard>
	);
}
