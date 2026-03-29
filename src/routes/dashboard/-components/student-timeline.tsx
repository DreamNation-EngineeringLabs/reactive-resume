import {
	ChatDotsIcon,
	ClockIcon,
	ExamIcon,
	FileTextIcon,
	PencilSimpleIcon,
	ShareNetworkIcon,
} from "@phosphor-icons/react";
import { cn } from "@/utils/style";

type HistoryEntry = {
	id: string;
	action: string;
	actorType: string;
	createdAt: Date;
	currentData: unknown;
};

type StudentTimelineProps = {
	entries: HistoryEntry[];
	studentName?: string;
};

const actionConfig: Record<string, { icon: React.ReactNode; bg: string; color: string; label: string }> = {
	CREATED: {
		icon: <FileTextIcon weight="duotone" className="size-4" />,
		bg: "bg-indigo-50",
		color: "text-indigo-600",
		label: "Resume Created",
	},
	UPDATED: {
		icon: <PencilSimpleIcon weight="duotone" className="size-4" />,
		bg: "bg-sky-50",
		color: "text-sky-600",
		label: "Resume Updated",
	},
	COMMENTED: {
		icon: <ChatDotsIcon weight="duotone" className="size-4" />,
		bg: "bg-amber-50",
		color: "text-amber-600",
		label: "Comment Added",
	},
	EVALUATED: {
		icon: <ExamIcon weight="duotone" className="size-4" />,
		bg: "bg-emerald-50",
		color: "text-emerald-600",
		label: "Evaluation Done",
	},
	FORWARDED: {
		icon: <ShareNetworkIcon weight="duotone" className="size-4" />,
		bg: "bg-violet-50",
		color: "text-violet-600",
		label: "Forwarded to PO",
	},
};

const defaultConfig = {
	icon: <ClockIcon weight="duotone" className="size-4" />,
	bg: "bg-slate-100",
	color: "text-slate-500",
	label: "Activity",
};

export function StudentTimeline({ entries, studentName }: StudentTimelineProps) {
	if (entries.length === 0) {
		return (
			<div className="rounded-2xl bg-slate-50 p-8 text-center">
				<p className="text-slate-400 text-sm">No activity recorded yet</p>
			</div>
		);
	}

	return (
		<div className="space-y-3">
			{studentName && <h4 className="font-semibold text-slate-900 text-sm">Activity for {studentName}</h4>}
			<div className="space-y-1">
				{entries.map((entry) => {
					const config = actionConfig[entry.action] ?? defaultConfig;
					return (
						<div
							key={entry.id}
							className="flex items-center gap-3 rounded-2xl bg-slate-50/80 px-4 py-3 transition-all hover:bg-slate-100"
						>
							<div
								className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl", config.bg, config.color)}
							>
								{config.icon}
							</div>
							<div className="min-w-0 flex-1">
								<p className="font-medium text-slate-900 text-sm">{config.label}</p>
								<p className="text-slate-400 text-xs">
									by {entry.actorType.toLowerCase()} · {new Date(entry.createdAt).toLocaleDateString()}
								</p>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
