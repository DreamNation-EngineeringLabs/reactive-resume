import { t } from "@lingui/core/macro";
import {
	ArrowUUpLeftIcon,
	ArrowUUpRightIcon,
	CircleNotchIcon,
	FilePdfIcon,
	type Icon,
	LinkSimpleIcon,
} from "@phosphor-icons/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { toast } from "sonner";
import { useCopyToClipboard } from "usehooks-ts";
import { AIChat } from "@/components/ai/chat";
import { useTemporalStore } from "@/components/resume/store/resume";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { authClient } from "@/integrations/auth/client";
import { orpc } from "@/integrations/orpc/client";
import { downloadFromUrl, generateFilename } from "@/utils/file";
import { cn } from "@/utils/style";

export function BuilderToolbar() {
	const { data: session } = authClient.useSession();
	const params = useParams({ from: "/builder/$resumeId" });

	const [_, copyToClipboard] = useCopyToClipboard();

	const { data: resume } = useQuery(orpc.resume.getById.queryOptions({ input: { id: params.resumeId } }));
	const { mutateAsync: printResumeAsPDF, isPending: isPrinting } = useMutation(
		orpc.printer.printResumeAsPDF.mutationOptions(),
	);

	const { undo, redo, pastStates, futureStates } = useTemporalStore((state) => ({
		undo: state.undo,
		redo: state.redo,
		pastStates: state.pastStates,
		futureStates: state.futureStates,
	}));

	const canUndo = pastStates.length > 1;
	const canRedo = futureStates.length > 0;

	useHotkeys("mod+z", () => undo(), { enabled: canUndo, preventDefault: true });
	useHotkeys(["mod+y", "mod+shift+z"], () => redo(), { enabled: canRedo, preventDefault: true });

	const publicUrl = useMemo(() => {
		if (!session?.user.username || !resume?.slug) return "";
		return `${window.location.origin}/${session.user.username}/${resume.slug}`;
	}, [session?.user.username, resume?.slug]);

	const onCopyUrl = useCallback(async () => {
		await copyToClipboard(publicUrl);
		toast.success(t`A link to your resume has been copied to clipboard.`);
	}, [publicUrl, copyToClipboard]);

	const onDownloadPDF = useCallback(async () => {
		if (!resume?.id) return;

		const filename = generateFilename(resume.data.basics.name, "pdf");
		const toastId = toast.loading(t`Please wait while your PDF is being generated...`, {
			description: t`This may take a while depending on the server capacity. Please do not close the window or refresh the page.`,
		});

		try {
			const { url } = await printResumeAsPDF({ id: resume.id });
			downloadFromUrl(url, filename);
		} catch {
			toast.error(t`There was a problem while generating the PDF, please try again in some time.`);
		} finally {
			toast.dismiss(toastId);
		}
	}, [resume?.id, resume?.data.basics.name, printResumeAsPDF]);

	return (
		<div className="flex items-center gap-x-0.5">
			<ToolbarIcon disabled={!canUndo} onClick={() => undo()} icon={ArrowUUpLeftIcon} title={t`Undo (Ctrl+Z)`} />
			<ToolbarIcon disabled={!canRedo} onClick={() => redo()} icon={ArrowUUpRightIcon} title={t`Redo (Ctrl+Y)`} />

			<div className="mx-1.5 h-5 w-px bg-border" />

			<AIChat />
			<ToolbarIcon icon={LinkSimpleIcon} title={t`Copy URL`} onClick={() => onCopyUrl()} />
			<ToolbarIcon
				title={t`Download PDF`}
				disabled={isPrinting}
				onClick={() => onDownloadPDF()}
				icon={isPrinting ? CircleNotchIcon : FilePdfIcon}
				iconClassName={cn(isPrinting && "animate-spin")}
			/>
		</div>
	);
}

type ToolbarIconProps = {
	title: string;
	icon: Icon;
	disabled?: boolean;
	onClick: () => void;
	iconClassName?: string;
};

function ToolbarIcon({ icon: Icon, title, disabled, onClick, iconClassName }: ToolbarIconProps) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button size="icon" variant="ghost" disabled={disabled} onClick={onClick} className="size-7">
					<Icon className={cn("size-3.5", iconClassName)} />
				</Button>
			</TooltipTrigger>
			<TooltipContent side="bottom" align="center" className="font-medium">
				{title}
			</TooltipContent>
		</Tooltip>
	);
}
