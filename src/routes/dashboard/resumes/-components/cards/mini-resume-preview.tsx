import { FileText } from "lucide-react";
import type { RouterOutput } from "@/integrations/orpc/client";
import type { ResumeData, SectionItem } from "@/schema/resume/data";

type Resume = RouterOutput["resume"]["list"][number];

function stripHtml(input?: string) {
	if (!input) return "";
	return input.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export function MiniResumePreview({ resume }: { resume: Resume }) {
	const data = resume.data as unknown as ResumeData | undefined;
	const basics = data?.basics;
	const sections = data?.sections;

	const experienceItems = (sections?.experience?.items ?? []) as SectionItem<"experience">[];
	const educationItems = (sections?.education?.items ?? []) as SectionItem<"education">[];
	const projectItems = (sections?.projects?.items ?? []) as SectionItem<"projects">[];
	const skillItems = (sections?.skills?.items ?? []) as SectionItem<"skills">[];

	const totalItems =
		experienceItems.length + educationItems.length + projectItems.length + skillItems.length;

	const hasName = Boolean(basics?.name?.trim());
	const isEmpty = !hasName && totalItems === 0;

	if (isEmpty) {
		return (
			<div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-white text-slate-300">
				<FileText strokeWidth={1.5} className="size-12" />
				<p className="font-semibold text-[11px] text-slate-400 uppercase tracking-wider">In Progress</p>
			</div>
		);
	}

	const displayName = basics?.name?.trim() || resume.name;
	const headline = basics?.headline?.trim();

	return (
		<div className="flex h-full flex-col bg-white px-5 pt-5 pb-3 font-serif text-[8px] text-slate-700 leading-tight">
			{/* Header */}
			<div className="border-slate-200 border-b pb-2.5">
				<h3 className="line-clamp-2 font-bold text-[13px] text-slate-900 leading-tight tracking-tight">
					{displayName}
				</h3>
				{headline && <p className="mt-0.5 line-clamp-1 text-[9px] text-slate-500">{headline}</p>}
			</div>

			<div className="mt-2.5 flex flex-1 flex-col gap-2 overflow-hidden">
				{experienceItems.length > 0 && (
					<Section title="Experience">
						{experienceItems.slice(0, 2).map((item, i) => (
							<Line
								key={i}
								primary={item.position || item.company}
								secondary={item.position && item.company ? item.company : item.period}
								tertiary={stripHtml(item.description)}
							/>
						))}
					</Section>
				)}

				{educationItems.length > 0 && (
					<Section title="Education">
						{educationItems.slice(0, 1).map((item, i) => (
							<Line
								key={i}
								primary={item.degree ? `${item.degree}${item.area ? `, ${item.area}` : ""}` : item.area || item.school}
								secondary={item.degree || item.area ? item.school : item.period}
							/>
						))}
					</Section>
				)}

				{projectItems.length > 0 && experienceItems.length + educationItems.length < 2 && (
					<Section title="Projects">
						{projectItems.slice(0, 1).map((item, i) => (
							<Line key={i} primary={item.name} secondary={stripHtml(item.description)} />
						))}
					</Section>
				)}

				{skillItems.length > 0 && (
					<div className="mt-auto">
						<SectionTitle>Skills</SectionTitle>
						<p className="line-clamp-2 text-[8.5px] text-slate-600">
							{skillItems
								.slice(0, 6)
								.map((skill) => skill.name)
								.filter(Boolean)
								.join(" • ")}
						</p>
					</div>
				)}
			</div>
		</div>
	);
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<div>
			<SectionTitle>{title}</SectionTitle>
			<div className="space-y-1">{children}</div>
		</div>
	);
}

function SectionTitle({ children }: { children: React.ReactNode }) {
	return (
		<p className="mb-1 font-bold text-[7.5px] text-slate-400 uppercase tracking-[0.12em]">{children}</p>
	);
}

function Line({
	primary,
	secondary,
	tertiary,
}: {
	primary?: string;
	secondary?: string;
	tertiary?: string;
}) {
	if (!primary && !secondary) return null;
	return (
		<div className="space-y-0.5">
			{primary && <p className="line-clamp-1 font-semibold text-[9px] text-slate-800">{primary}</p>}
			{secondary && <p className="line-clamp-1 text-[8.5px] text-slate-500">{secondary}</p>}
			{tertiary && <p className="line-clamp-2 text-[8px] text-slate-400 leading-snug">{tertiary}</p>}
		</div>
	);
}
