import type { RouterOutput } from "@/integrations/orpc/client";
import type { ResumeData, SectionItem } from "@/schema/resume/data";

type Resume = RouterOutput["resume"]["list"][number];

export function MiniResumePreview({ resume }: { resume: Resume }) {
	const data = resume.data as unknown as ResumeData;
	const template = data?.metadata?.template ?? "onyx";
	const resumeName = resume.name;
	const templateColors: Record<string, { header: string; accent: string }> = {
		azurill: { header: "bg-blue-600", accent: "text-blue-600" },
		bronzor: { header: "bg-slate-600", accent: "text-slate-600" },
		chikorita: { header: "bg-green-600", accent: "text-green-600" },
		ditgar: { header: "bg-purple-600", accent: "text-purple-600" },
		ditto: { header: "bg-pink-600", accent: "text-pink-600" },
		gengar: { header: "bg-indigo-600", accent: "text-indigo-600" },
		glalie: { header: "bg-cyan-600", accent: "text-cyan-600" },
		kakuna: { header: "bg-yellow-600", accent: "text-yellow-600" },
		lapras: { header: "bg-blue-500", accent: "text-blue-500" },
		leafish: { header: "bg-emerald-600", accent: "text-emerald-600" },
		onyx: { header: "bg-slate-700", accent: "text-slate-700" },
		pikachu: { header: "bg-amber-500", accent: "text-amber-500" },
		rhyhorn: { header: "bg-orange-600", accent: "text-orange-600" },
	};

	const colors = templateColors[template] || templateColors.onyx;

	return (
		<div className="flex h-full flex-col bg-white text-slate-900">
			{/* Colored Header Bar - 25% of card height */}
			<div
				className={`${colors.header} flex flex-col items-center justify-center px-5 py-6 text-white`}
				style={{ height: "25%" }}
			>
				<h3 className="line-clamp-3 text-center font-bold text-lg leading-tight">{resumeName}</h3>
			</div>

			{/* Body Content */}
			<div className="flex flex-1 flex-col overflow-hidden px-4 py-3 text-xs">
				{/* Experience Section */}
				{data?.sections?.experience?.items && data.sections.experience.items.length > 0 && (
					<div className="mb-2">
						<p className={`${colors.accent} mb-1 font-bold text-xs uppercase tracking-wide`}>Experience</p>
						{data.sections.experience.items.slice(0, 1).map((exp: SectionItem<"experience">, i: number) => (
							<div key={i} className="space-y-0.5">
								<p className="line-clamp-1 font-semibold text-slate-900">{exp.position || exp.company}</p>
								<p className="line-clamp-1 text-slate-500">{exp.company}</p>
							</div>
						))}
					</div>
				)}

				{/* Education Section */}
				{data?.sections?.education?.items && data.sections.education.items.length > 0 && (
					<div className="mb-2">
						<p className={`${colors.accent} mb-1 font-bold text-xs uppercase tracking-wide`}>Education</p>
						{data.sections.education.items.slice(0, 1).map((edu: SectionItem<"education">, i: number) => (
							<div key={i} className="space-y-0.5">
								<p className="line-clamp-1 font-semibold text-slate-900">
									{edu.degree ? `${edu.degree} in ${edu.area}` : edu.area}
								</p>
								<p className="line-clamp-1 text-slate-500">{edu.school}</p>
							</div>
						))}
					</div>
				)}

				{/* Skills Section - Auto margin to bottom */}
				{data?.sections?.skills?.items && data.sections.skills.items.length > 0 && (
					<div className="mt-auto">
						<p className={`${colors.accent} mb-1 font-bold text-xs uppercase tracking-wide`}>Skills</p>
						<div className="flex flex-wrap gap-1">
							{data.sections.skills.items.slice(0, 4).map((skill: SectionItem<"skills">, i: number) => (
								<span
									key={i}
									className={`truncate rounded px-1.5 py-0.5 ${colors.header} font-medium text-white text-xs`}
								>
									{skill.name}
								</span>
							))}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
