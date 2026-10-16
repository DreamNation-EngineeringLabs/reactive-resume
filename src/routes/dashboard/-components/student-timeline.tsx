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
		bg: "bg-primary/5",
		color: "text-primary",
		label: "Resume Created",
	},
	UPDATED: {
		icon: <PencilSimpleIcon weight="duotone" className="size-4" />,
		bg: "bg-primary/5",
		color: "text-primary",
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
		bg: "bg-primary/5",
		color: "text-primary",
		label: "Forwarded to PO",
	},
};

const defaultConfig = {
	icon: <ClockIcon weight="duotone" className="size-4" />,
	bg: "bg-muted",
	color: "text-muted-foreground",
	label: "Activity",
};

export function StudentTimeline({ entries, studentName }: StudentTimelineProps) {
	if (entries.length === 0) {
		return (
			<div className="rounded-2xl bg-muted/50 p-8 text-center">
				<p className="text-muted-foreground text-sm">No activity recorded yet</p>
			</div>
		);
	}

	return (
		<div className="space-y-3">
			{studentName && <h4 className="font-semibold text-foreground text-sm">Activity for {studentName}</h4>}
			<div className="space-y-1">
				{entries.map((entry) => {
					const config = actionConfig[entry.action] ?? defaultConfig;
					return (
						<div
							key={entry.id}
							className="flex items-center gap-3 rounded-2xl bg-muted/50 px-4 py-3 transition-all hover:bg-muted"
						>
							<div
								className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl", config.bg, config.color)}
							>
								{config.icon}
							</div>
							<div className="min-w-0 flex-1">
								<p className="font-medium text-foreground text-sm">{config.label}</p>
								<p className="text-muted-foreground text-xs">
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
