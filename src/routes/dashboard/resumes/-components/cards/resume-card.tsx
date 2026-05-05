import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { CheckCircle2, Download, Lock, MoreVertical, RefreshCw, Share2, Star } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { toast } from "sonner";
import { authClient } from "@/integrations/auth/client";
import { orpc, type RouterOutput } from "@/integrations/orpc/client";
import { downloadFromUrl } from "@/utils/file";
import { cn } from "@/utils/style";
import { ResumeContextMenu } from "../menus/context-menu";
import { ResumeDropdownMenu } from "../menus/dropdown-menu";
import { MiniResumePreview } from "./mini-resume-preview";

type ResumeCardProps = {
	resume: RouterOutput["resume"]["list"][number];
};

type Status = { label: string; tone: "complete" | "draft" | "locked" };

function getStatus(resume: ResumeCardProps["resume"]): Status {
	if (resume.isLocked) return { label: t`Locked`, tone: "locked" };
	const data = resume.data as { sections?: Record<string, { items?: unknown[] }> } | undefined;
	const sections = data?.sections ?? {};
	const sectionsWithItems = Object.values(sections).filter(
		(section) => Array.isArray(section?.items) && section.items.length > 0,
	).length;
	if (sectionsWithItems >= 3) return { label: t`Complete`, tone: "complete" };
	return { label: t`Draft`, tone: "draft" };
}

const STATUS_STYLES: Record<Status["tone"], { className: string; icon: React.ReactNode }> = {
	complete: {
		className: "border-emerald-200 bg-emerald-50 text-emerald-700",
		icon: <CheckCircle2 fill="currentColor" strokeWidth={0} className="size-3 text-emerald-600" />,
	},
	draft: {
		className: "border-blue-200 bg-blue-50 text-blue-700",
		icon: <RefreshCw strokeWidth={2.5} className="size-3" />,
	},
	locked: {
		className: "border-slate-200 bg-slate-100 text-slate-600",
		icon: <Lock strokeWidth={2.5} className="size-3" />,
	},
};

export function ResumeCard({ resume }: ResumeCardProps) {
	const { i18n } = useLingui();
	const { data: session } = authClient.useSession();
	const status = getStatus(resume);
	const statusStyle = STATUS_STYLES[status.tone];

	const target = resume.tags?.[0];

	const updatedAt = useMemo(
		() => Intl.DateTimeFormat(i18n.locale, { dateStyle: "medium" }).format(resume.updatedAt),
		[i18n.locale, resume.updatedAt],
	);

	const { mutateAsync: printResumeAsPDF, isPending: isPrinting } = useMutation(
		orpc.printer.printResumeAsPDF.mutationOptions(),
	);

	const handleDownload = async () => {
		const toastId = toast.loading(t`Preparing your PDF...`);
		try {
			const { url } = await printResumeAsPDF({ id: resume.id });
			downloadFromUrl(url, `resume-${resume.name}.pdf`);
			toast.success(t`Download ready.`, { id: toastId });
		} catch (error) {
			toast.error(error instanceof Error ? error.message : t`Failed to generate PDF.`, { id: toastId });
		}
	};

	const handleShare = async () => {
		const username = session?.user.username;
		if (!username) {
			toast.error(t`Sign in to share this resume.`);
			return;
		}
		if (!resume.isPublic) {
			toast.error(t`Make this resume public from the builder before sharing.`);
			return;
		}
		const link = `${window.location.origin}/${username}/${resume.slug}`;
		try {
			await navigator.clipboard.writeText(link);
			toast.success(t`Share link copied to clipboard.`);
		} catch {
			toast.error(t`Could not copy share link.`);
		}
	};

	return (
		<ResumeContextMenu resume={resume}>
			<div className="group relative flex h-full cursor-default flex-col overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
				{/* Preview Surface — clickable, opens the builder */}
				<Link
					to="/builder/$resumeId"
					params={{ resumeId: resume.id }}
					className="tap-active relative aspect-[3/4] w-full cursor-pointer overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100/60 p-4"
				>
					{/* Master Ribbon */}
					{resume.isPrimary && (
						<div className="absolute top-3 left-3 z-20 flex items-center gap-1 rounded-full border border-amber-200/80 bg-white/95 px-2 py-0.5 font-bold text-[9px] text-amber-700 uppercase tracking-widest shadow-sm backdrop-blur-sm">
							<Star fill="currentColor" strokeWidth={0} className="size-2.5" />
							<span>{t`Master`}</span>
						</div>
					)}

					{/* Status Badge */}
					<div
						className={cn(
							"absolute top-3 right-3 z-20 flex items-center gap-1 rounded-full border px-2 py-0.5 font-bold text-[9px] uppercase tracking-widest shadow-sm backdrop-blur-sm",
							statusStyle.className,
						)}
					>
						{statusStyle.icon}
						<span>{status.label}</span>
					</div>

					{/* Paper */}
					<div className="pointer-events-none relative size-full overflow-hidden rounded-lg border border-slate-200/80 bg-white shadow-md shadow-slate-900/5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:shadow-lg">
						<MiniResumePreview resume={resume} />
					</div>
				</Link>

				{/* Footer — plain text, NOT clickable. Only the action buttons respond. */}
				<div className="flex flex-col gap-2.5 border-border border-t p-4">
					<div className="min-w-0">
						<h4 className="line-clamp-1 select-text font-bold text-base text-slate-900 leading-tight tracking-tight">
							{resume.name}
						</h4>
						{target ? (
							<p className="mt-0.5 line-clamp-1 select-text text-slate-500 text-xs">
								<span className="font-semibold text-slate-400">{t`Target:`}</span> {target}
							</p>
						) : (
							<p className="mt-0.5 select-text text-slate-400 text-xs">{t`No target role`}</p>
						)}
					</div>

					<div className="flex items-center justify-between gap-2">
						<p className="select-text text-[11px] text-slate-400">
							{t`Updated`}{" "}
							<span className="font-semibold text-slate-600">{updatedAt}</span>
						</p>

						<div className="flex items-center gap-1">
							<button
								type="button"
								title={t`Download PDF`}
								disabled={isPrinting}
								onClick={handleDownload}
								className="tap-active flex size-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-primary/5 hover:text-primary disabled:opacity-50"
							>
								<Download strokeWidth={2} className="size-4" />
							</button>
							<button
								type="button"
								title={t`Copy share link`}
								onClick={handleShare}
								className="tap-active flex size-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-primary/5 hover:text-primary"
							>
								<Share2 strokeWidth={2} className="size-4" />
							</button>
							<ResumeDropdownMenu resume={resume} align="end">
								<button
									type="button"
									title={t`More actions`}
									className="tap-active flex size-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-primary/5 hover:text-primary"
								>
									<MoreVertical strokeWidth={2} className="size-4" />
								</button>
							</ResumeDropdownMenu>
						</div>
					</div>
				</div>
			</div>
		</ResumeContextMenu>
	);
}
