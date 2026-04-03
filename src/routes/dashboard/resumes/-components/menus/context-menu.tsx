import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import {
	CopySimpleIcon,
	FolderOpenIcon,
	LockSimpleIcon,
	LockSimpleOpenIcon,
	PencilSimpleLineIcon,
	ProhibitIcon,
	StarIcon,
	TrashSimpleIcon,
} from "@phosphor-icons/react";

const PO_LOCKED_STATUSES = new Set(["FINALIZED_BY_FACULTY", "RESUBMITTED_TO_PO", "PO_VERIFIED", "APPROVED"]);

import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useDialogStore } from "@/dialogs/store";
import { useConfirm } from "@/hooks/use-confirm";
import { orpc, type RouterOutput } from "@/integrations/orpc/client";

type Props = {
	resume: RouterOutput["resume"]["list"][number];
	children: React.ReactNode;
};

export function ResumeContextMenu({ resume, children }: Props) {
	const confirm = useConfirm();
	const { openDialog } = useDialogStore();

	const { mutate: deleteResume } = useMutation(orpc.resume.delete.mutationOptions());
	const { mutate: setLockedResume } = useMutation(orpc.resume.setLocked.mutationOptions());
	const { mutate: setPrimaryResume } = useMutation(orpc.resume.setPrimary.mutationOptions());

	const handleUpdate = () => {
		openDialog("resume.update", resume);
	};

	const handleDuplicate = () => {
		openDialog("resume.duplicate", resume);
	};

	const handleToggleLock = async () => {
		if (!resume.isLocked) {
			const confirmation = await confirm(t`Are you sure you want to lock this resume?`, {
				description: t`When locked, the resume cannot be updated or deleted.`,
			});

			if (!confirmation) return;
		}

		setLockedResume(
			{ id: resume.id, isLocked: !resume.isLocked },
			{
				onError: (error) => {
					toast.error(error.message);
				},
			},
		);
	};

	const handleDelete = async () => {
		const confirmation = await confirm(t`Are you sure you want to delete this resume?`, {
			description: t`This action cannot be undone.`,
		});

		if (!confirmation) return;

		const toastId = toast.loading(t`Deleting your resume...`);

		deleteResume(
			{ id: resume.id },
			{
				onSuccess: () => {
					toast.success(t`Your resume has been deleted successfully.`, { id: toastId });
				},
				onError: (error) => {
					toast.error(error.message, { id: toastId });
				},
			},
		);
	};

	const handleSetPrimary = () => {
		const toastId = toast.loading(t`Setting as Master Resume...`);

		setPrimaryResume(
			{ id: resume.id },
			{
				onSuccess: () => {
					toast.success(t`Successfully set as Master Resume.`, { id: toastId });
				},
				onError: (error) => {
					toast.error(error.message, { id: toastId });
				},
			},
		);
	};

	return (
		<ContextMenu>
			<ContextMenuTrigger asChild>{children}</ContextMenuTrigger>

			<ContextMenuContent>
				<ContextMenuItem asChild>
					<Link to="/builder/$resumeId" params={{ resumeId: resume.id }}>
						<FolderOpenIcon />
						<Trans>Open</Trans>
					</Link>
				</ContextMenuItem>

				<ContextMenuSeparator />

				<ContextMenuItem disabled={resume.isLocked} onSelect={handleUpdate}>
					<PencilSimpleLineIcon />
					<Trans>Update</Trans>
				</ContextMenuItem>

				<ContextMenuItem onSelect={handleDuplicate}>
					<CopySimpleIcon />
					<Trans>Duplicate</Trans>
				</ContextMenuItem>

				{resume.isLocked && resume.reviewStatus && PO_LOCKED_STATUSES.has(resume.reviewStatus) ? (
					<ContextMenuItem disabled>
						<ProhibitIcon className="text-rose-400" />
						<Trans>Locked by Placement Officer</Trans>
					</ContextMenuItem>
				) : (
					<ContextMenuItem onSelect={handleToggleLock}>
						{resume.isLocked ? <LockSimpleOpenIcon /> : <LockSimpleIcon />}
						{resume.isLocked ? <Trans>Unlock</Trans> : <Trans>Lock</Trans>}
					</ContextMenuItem>
				)}

				{!resume.isPrimary && (
					<ContextMenuItem onSelect={handleSetPrimary}>
						<StarIcon weight="duotone" className="text-amber-500" />
						<Trans>Mark as Master</Trans>
					</ContextMenuItem>
				)}

				<ContextMenuSeparator />

				<ContextMenuItem variant="destructive" disabled={resume.isLocked} onSelect={handleDelete}>
					<TrashSimpleIcon />
					<Trans>Delete</Trans>
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	);
}
