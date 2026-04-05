import { createOpenAI } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import z from "zod";
import type { ResumeData } from "@/schema/resume/data";
import { env } from "@/utils/env";
import type { AtsScoringContext, JDAnalysis, Suggestion, SuggestionBodySection } from "./index";
import { estimatePageCount, getAllBullets, getResumeSkills, SCORING_LLM_CONFIG, stripHtml } from "./index";
import { countResumeWords, RECOMMENDED_BULLET_RANGE, RECOMMENDED_WORD_RANGE } from "./rules/brevity";
import {
	ATS_SAFE_FONTS,
	ATS_SAFE_TEMPLATES,
	findEmojis,
	isProfilePictureDisplayedOnResume,
	isStandardDateFormat,
} from "./rules/formatting";
import {
	containsWeakPhrase,
	findNearDuplicateBullets,
	findRepetitiveOpeners,
	hasQuantifiedMetric,
	isXYZCompliant,
	startsWithActionVerb,
} from "./rules/impact-metrics";
import { getIndustryTaxonomyMatchCount, getJdKeywordsNotInBulletText } from "./rules/keyword-match";
import { extractLatestYear, isReverseChronological } from "./rules/structure";

const comprehensiveSchema = z.object({
	bulletRewrites: z.array(
		z.object({
			index: z.number(),
			original: z.string(),
			rewritten: z.string(),
			reason: z.string(),
		}),
	),
	dateCorrections: z.array(
		z.object({
			index: z.number(),
			original: z.string(),
			corrected: z.string(),
		}),
	),
	brevityEdits: z.array(
		z.object({
			index: z.number(),
			action: z.enum(["shorten", "hide"]),
			rewritten: z.string().nullable(),
			reason: z.string(),
		}),
	),
	summary: z.string().nullable(),
	tailoredSummary: z.string().nullable(),
	projectRewrites: z
		.array(
			z.object({
				index: z.number(),
				rewritten: z.string(),
				reason: z.string(),
			}),
		)
		.default([]),
	/**
	 * New bullets to add to existing experience/project items, each weaving in a JD keyword
	 * that currently appears only in the skills list but not in any bullet.
	 */
	keywordBulletAdditions: z
		.array(
			z.object({
				keyword: z.string().describe("The JD keyword this bullet is demonstrating"),
				sectionKey: z.string().describe("Which section: 'experience' or 'projects'"),
				itemIndex: z.number().describe("Zero-based index of the item within that section"),
				newBullet: z
					.string()
					.describe(
						"Plain text for the new bullet (no HTML). Must start with a past-tense action verb, include the keyword, and follow XYZ format where possible.",
					),
			}),
		)
		.default([]),
});

export type GenerateSuggestionsResult = {
	suggestions: Suggestion[];
	/** Comprehensive LLM pass was needed but did not return usable output. */
	aiRewriteUnavailable: boolean;
};

export async function generateSuggestions(
	data: ResumeData,
	jdAnalysis: JDAnalysis | null,
	missingRequired: string[],
	missingNiceToHave: string[] = [],
	scoringContext: AtsScoringContext | null = null,
): Promise<GenerateSuggestionsResult> {
	const suggestions: Suggestion[] = [];
	const bullets = getAllBullets(data);
	const resumeSkills = getResumeSkills(data).map((s: string) => s.toLowerCase());
	const kwCategoryScore = scoringContext?.categories.keywordMatch;
	const taxonomyCount = getIndustryTaxonomyMatchCount(data);

	const cqSuggestionCategory = jdAnalysis ? "impactMetrics" : "tailoring";

	// ── 1. Keyword suggestions ──
	if (missingRequired.length > 0) {
		// Specific JD-based suggestions
		for (const keyword of missingRequired.slice(0, 5)) {
			suggestions.push({
				id: `KW-S1-${keyword.toLowerCase().replace(/\s+/g, "-")}`,
				ruleId: "KW-1",
				category: "keywordMatch",
				severity: "critical",
				title: `Add missing keyword: ${keyword}`,
				description: `The job description requires "${keyword}" but it's not in your resume. Add it to your Skills section.`,
				autoApplicable: true,
				patches: [
					{
						op: "add",
						path: "/sections/skills/items/-",
						value: {
							id: crypto.randomUUID(),
							hidden: false,
							options: { showLinkInTitle: false },
							icon: "",
							name: keyword,
							proficiency: "",
							level: 0,
							keywords: [],
						},
					},
				],
				estimatedScoreGain: Math.ceil(25 / Math.max(1, missingRequired.length)),
				diff: {
					type: "add_item",
					location: "Skills",
					fieldPath: "/sections/skills/items/-",
					hunks: [{ added: keyword }],
				},
			});
		}
	} else if (!jdAnalysis) {
		// NO JD — align with taxonomy-based keyword score, not only skills row count
		const popularFoundations = [
			{ name: "Programming Languages", examples: "Python, JavaScript, Java, C++" },
			{ name: "Frameworks / Libraries", examples: "React, Node.js, Spring Boot, Django" },
			{ name: "Database Systems", examples: "PostgreSQL, MySQL, MongoDB" },
			{ name: "Cloud & DevOps", examples: "AWS, Docker, Kubernetes, Git" },
		];

		const hasLanguage = resumeSkills.some((s: string) =>
			["python", "javascript", "java", "cpp", "c++", "golang", "ruby", "typescript"].includes(s),
		);
		const hasFramework = resumeSkills.some((s: string) =>
			["react", "angular", "vue", "node", "spring", "django", "flask", "express", "next.js"].includes(s),
		);

		const scoreRatio = kwCategoryScore && kwCategoryScore.max > 0 ? kwCategoryScore.score / kwCategoryScore.max : 1;
		const needsDensityHelp =
			taxonomyCount < 12 || scoreRatio < 0.55 || !hasLanguage || !hasFramework || resumeSkills.length < 10;

		if (needsDensityHelp) {
			const skillsSectionHidden = data.sections.skills.hidden;
			const skillsRows = resumeSkills.length;
			const skillsExplainer = skillsSectionHidden
				? "Your Skills section is hidden. Turn it on in the editor and list your main languages, frameworks, and tools — that helps scanners and recruiters."
				: skillsRows === 0
					? `Your Skills section is empty, but we still see about ${taxonomyCount} technical term${taxonomyCount !== 1 ? "s" : ""} elsewhere (e.g. bullets or summary). Filling the Skills section with those same tools makes them easier for ATS to find.`
					: `Your Skills section has ${skillsRows} entr${skillsRows !== 1 ? "ies" : "y"}. We also see about ${taxonomyCount} familiar terms resume-wide — aim for more total coverage (15–25 is a good target) and repeat key tools in your bullets.`;

			const bodySections: SuggestionBodySection[] = [
				{
					title: "What this score means",
					items: [
						"Without a pasted job description, we count how many standard tech terms (languages, frameworks, databases, cloud tools, etc.) appear anywhere on your resume.",
						skillsExplainer,
						"Next step: add each important tool as its own line under Skills, and mention the same tools when you describe what you built or shipped.",
					],
				},
				{
					title: "Examples of what to list",
					items: popularFoundations.map((f) => `${f.name}: ${f.examples}`),
				},
			];
			suggestions.push({
				id: "KW-S-thin-skills",
				ruleId: "KW-1",
				category: "keywordMatch",
				severity: "warning",
				title: "Add more tools and technologies",
				description:
					"Your resume doesn’t show enough recognizable technical terms for a strong general ATS result. Use the Skills section and your bullet points so scanners see what you actually use.",
				bodySections,
				autoApplicable: false,
				estimatedScoreGain: 5,
				diff: {
					type: "add_item",
					location: "Skills",
					fieldPath: "/sections/skills/items/-",
					hunks: [
						{
							context:
								"Add skills one per row (e.g. Python, React, PostgreSQL). The examples above are inspiration — use what you truly know.",
						},
					],
				},
			});
		}
	}

	// JD: keywords that appear on the resume but only in skills/summary — hurts KW-2
	if (jdAnalysis && scoringContext?.requiredJdKeywords?.length) {
		const notInBullets = getJdKeywordsNotInBulletText(data, scoringContext.requiredJdKeywords);
		const toSurface = notInBullets.slice(0, 8);
		if (toSurface.length > 0) {
			const bodySections: SuggestionBodySection[] = [
				{
					title: "Say what you did with each term",
					items: toSurface.map(
						(kw) =>
							`"${kw}" — add a bullet that says how you used it (e.g. "Built … using ${kw}" or "Shipped … with ${kw}").`,
					),
				},
				{
					title: "Quick fix",
					items: [
						"Accept the generated bullet suggestions below — each one adds a keyword-backed achievement to your work or project bullets automatically.",
					],
				},
			];
			suggestions.push({
				id: "KW-S-context-gap",
				ruleId: "KW-2",
				category: "keywordMatch",
				severity: "warning",
				title: "Mention these skills in your work or project bullets",
				description: `${toSurface.length} keyword${toSurface.length !== 1 ? "s" : ""} from the job description appear only in your skills list — not in any bullet point. ATS tools and recruiters weight skills-in-context far more than a bare skills entry. Accept the generated bullet suggestions below to fix this automatically.`,
				bodySections,
				descriptionBullets: toSurface,
				autoApplicable: false,
				estimatedScoreGain: Math.min(6, toSurface.length * 2),
				diff: {
					type: "text_replace",
					location: "Experience / Projects",
					fieldPath: "",
					hunks: [
						{
							context:
								"Edit an experience or project bullet so the term appears next to something you built, improved, or shipped.",
						},
					],
				},
			});
		}
	}

	// ── 1b. Nice-to-have keyword suggestions (no score impact) ──
	if (missingNiceToHave.length > 0) {
		for (const keyword of missingNiceToHave.slice(0, 3)) {
			suggestions.push({
				id: `KW-S2-${keyword.toLowerCase().replace(/\s+/g, "-")}`,
				ruleId: "KW-1",
				category: "keywordMatch",
				severity: "info",
				title: `Good to have: ${keyword}`,
				description: `The job description mentions "${keyword}" — adding it could strengthen your application.`,
				autoApplicable: true,
				patches: [
					{
						op: "add",
						path: "/sections/skills/items/-",
						value: {
							id: crypto.randomUUID(),
							hidden: false,
							options: { showLinkInTitle: false },
							icon: "",
							name: keyword,
							proficiency: "",
							level: 0,
							keywords: [],
						},
					},
				],
				estimatedScoreGain: 0,
				diff: {
					type: "add_item",
					location: "Skills",
					fieldPath: "/sections/skills/items/-",
					hunks: [{ added: keyword }],
				},
			});
		}
	}

	// ── 2. Collect ALL problematic bullets — merge ALL issues per bullet into one entry ──
	const bulletsToRewrite: Array<{
		text: string;
		sectionKey: string;
		itemIndex: number;
		path: string;
		bulletIndex: number;
		reason: string;
		reasons: string[];
		weakness: string | null;
	}> = [];

	for (const [i, b] of bullets.entries()) {
		const issues: string[] = [];
		const weakness = containsWeakPhrase(b.text);

		if (weakness) issues.push(`weak phrase: "${weakness}"`);
		if (!startsWithActionVerb(b.text)) issues.push("no action verb");
		if (!hasQuantifiedMetric(b.text)) issues.push("no quantified metric");
		if (!isXYZCompliant(b.text) && issues.length === 0) {
			// Only add XYZ if no other issues — otherwise the other fixes will likely make it XYZ compliant
			issues.push("not XYZ compliant (add action verb + metric + method)");
		} else if (!isXYZCompliant(b.text)) {
			issues.push("not XYZ compliant");
		}

		if (issues.length > 0) {
			bulletsToRewrite.push({
				...b,
				bulletIndex: i,
				reason: issues.join(" + "),
				reasons: issues,
				weakness,
			});
		}
	}

	// ── 2b. Collect brevity candidates (long bullets + hide candidates) ──
	const wordCount = countResumeWords(data);
	const totalBulletCount = bullets.length;
	const pages = estimatePageCount(data);
	const tooManyWords = pages > 1 || wordCount > RECOMMENDED_WORD_RANGE.max;
	const tooManyBullets = totalBulletCount > RECOMMENDED_BULLET_RANGE.max;

	const brevityCandidates: Array<{
		text: string;
		sectionKey: string;
		itemIndex: number;
		path: string;
		bulletIndex: number;
		wordCount: number;
	}> = [];

	if (tooManyWords || tooManyBullets) {
		for (const [i, b] of bullets.entries()) {
			brevityCandidates.push({
				...b,
				bulletIndex: i,
				wordCount: b.text.split(/\s+/).length,
			});
		}
		// Sort by word count descending — longest bullets are best candidates
		brevityCandidates.sort((a, b) => b.wordCount - a.wordCount);
	}

	// ── 3. Collect ALL non-standard dates ──
	const datesToFix: Array<{ sectionKey: string; itemIndex: number; period: string }> = [];
	for (const key of ["experience", "education", "projects", "volunteer"] as const) {
		const section = data.sections[key];
		if (section.hidden) continue;
		for (const [idx, item] of section.items.entries()) {
			if (item.hidden) continue;
			if ("period" in item && typeof (item as { period?: string }).period === "string") {
				const period = (item as { period: string }).period;
				if (!period.trim()) continue;
				const parts = period.split(/\s*(?:[-–—]+|\bto\b)\s*/i);
				if (parts.some((part) => part.length > 0 && !isStandardDateFormat(part.trim()))) {
					datesToFix.push({ sectionKey: key, itemIndex: idx, period });
				}
			}
		}
	}

	// ── 4. Check if summary is needed ──
	const needsSummary = data.summary.hidden || !stripHtml(data.summary.content).trim();

	// Check if existing summary needs tailoring to JD
	const needsTailoredSummary = (() => {
		if (!jdAnalysis || !jdAnalysis.jobTitle) return false;
		if (needsSummary) return false; // No summary at all — needsSummary handles that
		const summaryText = stripHtml(data.summary.content).toLowerCase();
		const jdTitle = jdAnalysis.jobTitle.toLowerCase();
		const mentionsRole =
			summaryText.includes(jdTitle) ||
			jdTitle
				.split(" ")
				.filter((w) => w.length > 3)
				.every((w) => summaryText.includes(w));
		const jdKeyTerms = [...jdAnalysis.hardSkills, ...jdAnalysis.tools].map((s) => s.toLowerCase());
		const matched = jdKeyTerms.filter((term) => summaryText.includes(term));
		const matchRatio = jdKeyTerms.length > 0 ? matched.length / jdKeyTerms.length : 1;
		return !mentionsRole || matchRatio < 0.3;
	})();

	// ── 4b. Weak project descriptions (LLM can rewrite full HTML field) ──
	type ProjectCoachingRow = { itemIndex: number; name: string; plain: string; rawHtml: string };
	const projectsToRewrite: ProjectCoachingRow[] = [];
	for (const [idx, project] of (data.sections.projects?.items ?? []).entries()) {
		if (project.hidden) continue;
		const projectName = String((project as { name?: string }).name ?? "").trim() || "Untitled Project";
		const rawDesc = "description" in project ? (project as { description: string }).description : "";
		const desc = stripHtml(rawDesc).trim();
		const descWords = desc.split(/\s+/).filter(Boolean).length;
		const hasTechStack =
			/\b(react|vue|angular|node|python|java|typescript|javascript|aws|docker|kubernetes|sql|api|mongodb|postgresql|git|flutter|kotlin|swift|django|flask|express|firebase|tailwind|next\.?js|fastapi|spring|redis|graphql|pytorch|tensorflow|sklearn|pandas|numpy|supabase|prisma|vercel|netlify)\b/i.test(
				desc,
			);
		const hasOutcome =
			/\b(\d+\s*(users|customers|downloads|stars|requests|records|entries)|improved|reduced|increased|deployed|launched|live|production|active|published)\b/i.test(
				desc,
			);
		const isVague = /\b(simple|basic|sample|just|only|small|mini|practice|learning|demo|placeholder)\b/i.test(desc);
		const needsCoaching = descWords < 20 || (!hasTechStack && !hasOutcome) || isVague;
		if (!needsCoaching) continue;
		projectsToRewrite.push({ itemIndex: idx, name: projectName, plain: desc, rawHtml: rawDesc });
	}

	// ── 4c. Collect JD keywords in skills but not in any bullet (for keyword bullet weaving) ──
	const keywordsNotInBullets =
		jdAnalysis && scoringContext?.requiredJdKeywords?.length
			? getJdKeywordsNotInBulletText(data, scoringContext.requiredJdKeywords).slice(0, 5)
			: [];

	let aiRewriteUnavailable = false;
	// ── 5. Single LLM call for ALL actionable suggestions ──
	if (
		bulletsToRewrite.length > 0 ||
		datesToFix.length > 0 ||
		needsSummary ||
		needsTailoredSummary ||
		brevityCandidates.length > 0 ||
		projectsToRewrite.length > 0 ||
		keywordsNotInBullets.length > 0
	) {
		const llmResult = await getComprehensiveSuggestions(
			data,
			bulletsToRewrite,
			datesToFix,
			needsSummary,
			jdAnalysis,
			brevityCandidates,
			{ wordCount, totalBulletCount, pages, tooManyWords },
			needsTailoredSummary,
			projectsToRewrite,
			keywordsNotInBullets,
		);

		if (!llmResult) {
			// Only show the banner when an API key was configured but the call genuinely failed.
			// When no API key is present at all, this is expected — generate heuristic fallbacks instead.
			if (env.OPENAI_API_KEY) {
				aiRewriteUnavailable = true;
			}

			// ── Fallback: generate coaching suggestions without LLM ──

			// Bullet coaching (non-auto-applicable)
			for (const bullet of bulletsToRewrite.slice(0, 6)) {
				const sectionName =
					bullet.sectionKey === "experience"
						? "Experience"
						: bullet.sectionKey === "projects"
							? "Projects"
							: "Volunteer";
				const section = data.sections[bullet.sectionKey as keyof typeof data.sections];
				const item = section.items[bullet.itemIndex] as { company?: string; name?: string; position?: string };
				const itemLabel = item.company || item.name || item.position || "";
				const ruleId = bullet.weakness ? "IM-4" : !startsWithActionVerb(bullet.text) ? "IM-1" : "IM-2";

				suggestions.push({
					id: `IM-S-fallback-${bullet.sectionKey}-${bullet.itemIndex}-${bullet.bulletIndex}`,
					ruleId,
					category: "impactMetrics",
					severity: bullet.weakness ? "critical" : "warning",
					title: `Rewrite bullet: ${bullet.reasons[0] ?? bullet.reason}`,
					description: `"${bullet.text.slice(0, 90)}${bullet.text.length > 90 ? "…" : ""}" — ${bullet.reason}. Edit this bullet in the builder to fix the issue.`,
					autoApplicable: false,
					estimatedScoreGain: Math.min(4, bullet.reasons.length * 2),
					diff: {
						type: "text_replace",
						location: `${sectionName} → ${itemLabel}`,
						fieldPath: bullet.path,
						hunks: [{ removed: bullet.text }],
					},
				});
			}

			// Summary coaching (non-auto)
			if (needsSummary) {
				suggestions.push({
					id: "SC-S1-summary-fallback",
					ruleId: "SC-2",
					category: "structure",
					severity: "warning",
					title: "Add a professional summary",
					description:
						"Your resume is missing a summary section. Write 2–3 sentences covering: who you are (role + level), what you've built (key project or achievement), and what role you're targeting.",
					autoApplicable: false,
					estimatedScoreGain: 2,
					diff: {
						type: "add_item",
						location: "Summary",
						fieldPath: "/summary/content",
						hunks: [
							{
								added:
									"e.g. 'Final-year CS student with experience building full-stack apps using React and Node.js. Looking for backend or full-stack roles.'",
							},
						],
					},
				});
			}

			// Date format coaching (non-auto)
			for (const dateItem of datesToFix.slice(0, 3)) {
				const sectionLabel = dateItem.sectionKey.charAt(0).toUpperCase() + dateItem.sectionKey.slice(1);
				const section = data.sections[dateItem.sectionKey as keyof typeof data.sections];
				const item = section.items[dateItem.itemIndex] as {
					company?: string;
					institution?: string;
					name?: string;
					position?: string;
				};
				const itemLabel = item.company || item.institution || item.name || item.position || "";

				suggestions.push({
					id: `FM-S-date-fallback-${dateItem.sectionKey}-${dateItem.itemIndex}`,
					ruleId: "FM-4",
					category: "formatting",
					severity: "warning",
					title: `Fix date format: "${dateItem.period}"`,
					description: `Change "${dateItem.period}" to a standard ATS format: "Jan 2023 - Dec 2023" or "Jan 2023 - Present".`,
					autoApplicable: false,
					estimatedScoreGain: 1,
					diff: {
						type: "field_replace",
						location: `${sectionLabel} → ${itemLabel}`,
						fieldPath: `/sections/${dateItem.sectionKey}/items/${dateItem.itemIndex}/period`,
						hunks: [{ removed: dateItem.period }, { added: "Jan YYYY - Mon YYYY  (or Present)" }],
					},
				});
			}

			// Project coaching (non-auto)
			for (const project of projectsToRewrite.slice(0, 3)) {
				suggestions.push({
					id: `CQ-S-proj-fallback-${project.itemIndex}`,
					ruleId: "CQ-3",
					category: cqSuggestionCategory,
					severity: "warning",
					title: `Strengthen project: "${project.name}"`,
					description: `"${project.name}" needs a stronger description. Expand it to cover: (1) what the project does, (2) the full tech stack (e.g. React, Node.js, PostgreSQL), (3) your specific contribution, and (4) an outcome or metric (users, performance, deployment).`,
					autoApplicable: false,
					estimatedScoreGain: 2,
					diff: {
						type: "text_replace",
						location: `Projects → ${project.name}`,
						fieldPath: `/sections/projects/items/${project.itemIndex}/description`,
						hunks: project.plain ? [{ removed: project.plain }] : [{ added: "Add description" }],
					},
				});
			}

			// Tailored summary fallback — auto-applicable with a template
			if (needsTailoredSummary && jdAnalysis) {
				const currentSummary = stripHtml(data.summary.content);

				// Detect entry-level role
				const isFallbackEntryLevel =
					/\b(trainee|intern|fresher|graduate|entry|junior|associate|apprentice|campus)\b/i.test(jdAnalysis.jobTitle) ||
					jdAnalysis.experienceLevel === "entry";

				// Build a concise template from available resume data
				// Prefer technical skills (languages, frameworks, tools) over soft skills
				const softSkillTerms =
					/\b(communication|teamwork|leadership|problem.?solving|collaboration|interpersonal|adaptability|creativity|time.?management|work.?ethic|critical.?thinking|attention.?to.?detail)\b/i;
				const resumeSkillNames = data.sections.skills.items
					.filter((s) => !s.hidden)
					.map((s) => s.name)
					.filter((n) => Boolean(n) && !softSkillTerms.test(n));
				const matchingSkills = [...jdAnalysis.hardSkills, ...jdAnalysis.tools].filter((sk) =>
					resumeSkillNames.some((r) => r.toLowerCase().includes(sk.toLowerCase())),
				);
				const topSkillsStr =
					matchingSkills.slice(0, 3).join(", ") || resumeSkillNames.slice(0, 3).join(", ") || "software development";

				// Sanitize headline — reject generic section-heading placeholders
				const PLACEHOLDER_HEADLINES = /^(overview|summary|about|profile|about me|objective|bio)$/i;
				const rawHeadline = data.basics.headline?.trim() ?? "";
				const cleanHeadline = PLACEHOLDER_HEADLINES.test(rawHeadline) ? "" : rawHeadline;

				const latestRole = data.sections.experience.items.find((e) => !e.hidden);
				const roleContext = latestRole
					? `with experience as ${latestRole.position ?? "developer"} at ${latestRole.company ?? "previous company"}`
					: "with hands-on project experience";

				let generatedSummary: string;
				if (isFallbackEntryLevel) {
					// Entry-level: open with "Aspiring X", don't repeat title in closing
					const opener = `Aspiring ${jdAnalysis.jobTitle}`;
					generatedSummary = `${opener} ${roleContext}, with a strong foundation in ${topSkillsStr}. Passionate about building real-world solutions and eager to contribute to a high-impact team.`;
				} else {
					// Mid/senior: lead with current identity, mention target role once in closing
					const opener = cleanHeadline || `${latestRole?.position ?? "Software engineer"}`;
					generatedSummary = `${opener} ${roleContext}, skilled in ${topSkillsStr}. Seeking a ${jdAnalysis.jobTitle} role to bring hands-on technical depth and drive meaningful outcomes.`;
				}

				suggestions.push({
					id: "TR-S2-summary-fallback",
					ruleId: "TR-2",
					category: "tailoring",
					severity: "warning",
					title: "Tailor summary to job description",
					description: `Your summary doesn't mention the target role "${jdAnalysis.jobTitle}" or key JD skills. A tailored version has been generated — accept it or use it as a starting point.`,
					autoApplicable: true,
					patches: [{ op: "replace", path: "/summary/content", value: `<p>${generatedSummary}</p>` }],
					estimatedScoreGain: 3,
					diff: {
						type: "text_replace",
						location: "Summary",
						fieldPath: "/summary/content",
						hunks: [
							{ removed: currentSummary.slice(0, 120) + (currentSummary.length > 120 ? "…" : "") },
							{ added: generatedSummary },
						],
					},
				});
			}
		}

		// Process bullet rewrites
		if (llmResult) {
			for (const rewrite of llmResult.bulletRewrites) {
				const bullet = bulletsToRewrite[rewrite.index];
				if (!bullet) continue;

				// Word count guard
				const originalWords = bullet.text.split(/\s+/).length;
				const rewriteWords = rewrite.rewritten.split(/\s+/).length;
				if (rewriteWords > originalWords + 5) continue;
				if (rewrite.rewritten.trim() === bullet.text.trim()) continue;

				const sectionName =
					bullet.sectionKey === "experience"
						? "Experience"
						: bullet.sectionKey === "projects"
							? "Projects"
							: "Volunteer";

				const section = data.sections[bullet.sectionKey as keyof typeof data.sections];
				const item = section.items[bullet.itemIndex] as { company?: string; name?: string; position?: string };
				const itemLabel = item.company || item.name || item.position || "";

				// Pick the most severe rule for categorization
				const severity: "critical" | "warning" = bullet.weakness ? "critical" : "warning";
				const ruleId =
					bullet.reasons.length > 1
						? "IM-ALL"
						: bullet.weakness
							? "IM-4"
							: !startsWithActionVerb(bullet.text)
								? "IM-1"
								: !hasQuantifiedMetric(bullet.text)
									? "IM-2"
									: "IM-3";

				// Build a coaching-oriented title
				const issueLabels: string[] = [];
				if (bullet.weakness) issueLabels.push(`replace "${bullet.weakness}"`);
				else if (!startsWithActionVerb(bullet.text)) issueLabels.push("start with an action verb");
				if (!hasQuantifiedMetric(bullet.text)) issueLabels.push("add a measurable outcome");
				if (isXYZCompliant(bullet.text) === false && issueLabels.length === 0) issueLabels.push("follow XYZ formula");
				const title = `Strengthen bullet: ${issueLabels.join(" + ")}`;

				suggestions.push({
					id: `IM-S-${bullet.sectionKey}-${bullet.itemIndex}-${rewrite.index}`,
					ruleId,
					category: "impactMetrics",
					severity,
					title,
					description: rewrite.reason,
					autoApplicable: true,
					patches: [
						{
							op: "replace-bullet",
							path: bullet.path,
							oldText: bullet.text,
							newText: rewrite.rewritten,
						},
					],
					estimatedScoreGain: Math.min(5, bullet.reasons.length * 2),
					diff: {
						type: "text_replace",
						location: `${sectionName} → ${itemLabel}`,
						fieldPath: bullet.path,
						hunks: [{ removed: bullet.text }, { added: rewrite.rewritten }],
					},
				});
			}

			// Process date corrections
			for (const dateFix of llmResult.dateCorrections) {
				const dateItem = datesToFix[dateFix.index];
				if (!dateItem) continue;
				if (dateFix.corrected.trim() === dateItem.period.trim()) continue;

				const sectionLabel = dateItem.sectionKey.charAt(0).toUpperCase() + dateItem.sectionKey.slice(1);
				const section = data.sections[dateItem.sectionKey as keyof typeof data.sections];
				const item = section.items[dateItem.itemIndex] as {
					company?: string;
					name?: string;
					position?: string;
					institution?: string;
				};
				const itemLabel = item.company || item.institution || item.name || item.position || "";

				suggestions.push({
					id: `FM-S-date-${dateItem.sectionKey}-${dateItem.itemIndex}`,
					ruleId: "FM-4",
					category: "formatting",
					severity: "warning",
					title: `Fix date format: "${dateItem.period}"`,
					description: `Change to ATS-standard format: "${dateFix.corrected}"`,
					autoApplicable: true,
					patches: [
						{
							op: "replace",
							path: `/sections/${dateItem.sectionKey}/items/${dateItem.itemIndex}/period`,
							value: dateFix.corrected,
						},
					],
					estimatedScoreGain: 1,
					diff: {
						type: "field_replace",
						location: `${sectionLabel} → ${itemLabel}`,
						fieldPath: `/sections/${dateItem.sectionKey}/items/${dateItem.itemIndex}/period`,
						hunks: [{ removed: dateItem.period }, { added: dateFix.corrected }],
					},
				});
			}

			// Process generated summary
			if (llmResult.summary && needsSummary) {
				const summaryPatches: Array<{ op: "replace"; path: string; value: unknown }> = [
					{ op: "replace", path: "/summary/content", value: `<p>${llmResult.summary}</p>` },
				];
				if (data.summary.hidden) {
					summaryPatches.push({ op: "replace", path: "/summary/hidden", value: false });
				}

				suggestions.push({
					id: "SC-S1-summary",
					ruleId: "SC-2",
					category: "structure",
					severity: "warning",
					title: "Add a professional summary",
					description: "Generated professional summary based on your experience and skills.",
					autoApplicable: true,
					patches: summaryPatches,
					estimatedScoreGain: 2,
					diff: {
						type: "field_replace",
						location: "Summary",
						fieldPath: "/summary/content",
						hunks: [{ added: llmResult.summary }],
					},
				});
			}

			// Process tailored summary (rewrite existing summary to match JD)
			if (llmResult.tailoredSummary && needsTailoredSummary) {
				const currentSummary = stripHtml(data.summary.content);
				suggestions.push({
					id: "TR-S2-summary",
					ruleId: "TR-2",
					category: "tailoring",
					severity: "warning",
					title: "Tailor summary to job description",
					description: `Your summary doesn't mention the target role "${jdAnalysis?.jobTitle}" or key JD skills. Here's a tailored version based on your experience.`,
					autoApplicable: true,
					patches: [{ op: "replace", path: "/summary/content", value: `<p>${llmResult.tailoredSummary}</p>` }],
					estimatedScoreGain: 3,
					diff: {
						type: "text_replace",
						location: "Summary",
						fieldPath: "/summary/content",
						hunks: [{ removed: currentSummary }, { added: llmResult.tailoredSummary }],
					},
				});
			}

			// Process project description rewrites
			for (const pr of llmResult.projectRewrites ?? []) {
				const row = projectsToRewrite[pr.index];
				if (!row) continue;
				const sanitized = pr.rewritten.trim();
				if (!sanitized) continue;
				if (stripHtml(sanitized) === row.plain && row.plain.length > 0) continue;

				suggestions.push({
					id: `CQ-S-proj-rewrite-${row.itemIndex}`,
					ruleId: "CQ-3",
					category: cqSuggestionCategory,
					severity: "warning",
					title: `Rewrite project: "${row.name}"`,
					description: pr.reason,
					autoApplicable: true,
					patches: [
						{
							op: "replace",
							path: `/sections/projects/items/${row.itemIndex}/description`,
							value: sanitized,
						},
					],
					estimatedScoreGain: 2,
					diff: {
						type: "field_replace",
						location: `Projects → ${row.name}`,
						fieldPath: `/sections/projects/items/${row.itemIndex}/description`,
						hunks: [
							{ removed: row.plain || "(empty)" },
							{ added: stripHtml(sanitized).slice(0, 200) + (stripHtml(sanitized).length > 200 ? "…" : "") },
						],
					},
				});
			}

			// Process keyword bullet additions
			for (const addition of llmResult.keywordBulletAdditions ?? []) {
				const { keyword, sectionKey, itemIndex, newBullet } = addition;
				if (!newBullet?.trim()) continue;

				// Validate that sectionKey and itemIndex refer to a real, visible item
				const section = data.sections[sectionKey as keyof typeof data.sections];
				if (!section) continue;
				const item = section.items[itemIndex] as
					| { hidden?: boolean; description?: string; company?: string; name?: string; position?: string }
					| undefined;
				if (!item || item.hidden) continue;

				const currentHtml = (item as { description?: string }).description ?? "";
				const newHtml = insertBulletIntoHtml(currentHtml, newBullet.trim());
				const fieldPath = `/sections/${sectionKey}/items/${itemIndex}/description`;

				const sectionLabel =
					sectionKey === "experience" ? "Experience" : sectionKey === "projects" ? "Projects" : "Volunteer";
				const itemLabel = item.company || item.name || item.position || `${sectionLabel} item ${itemIndex + 1}`;

				suggestions.push({
					id: `KW-S-bullet-add-${keyword.toLowerCase().replace(/\s+/g, "-")}-${sectionKey}-${itemIndex}`,
					ruleId: "KW-2",
					category: "keywordMatch",
					severity: "warning",
					title: `Add "${keyword}" to a bullet`,
					description: `"${keyword}" is in your skills list but not in any work or project bullet. A generated bullet demonstrates real usage, which ATS tools weight more heavily than skills lists alone.`,
					autoApplicable: true,
					patches: [{ op: "replace", path: fieldPath, value: newHtml }],
					estimatedScoreGain: 2,
					diff: {
						type: "text_replace",
						location: `${sectionLabel} → ${itemLabel}`,
						fieldPath,
						hunks: [{ added: newBullet }],
					},
				});
			}

			// Process brevity edits (shorten or hide bullets)
			for (const edit of llmResult.brevityEdits) {
				const candidate = brevityCandidates[edit.index];
				if (!candidate) continue;

				// Only allow "shorten" when words are over limit, not just for excess bullets
				if (edit.action === "shorten" && !tooManyWords) continue;

				const sectionName =
					candidate.sectionKey === "experience"
						? "Experience"
						: candidate.sectionKey === "projects"
							? "Projects"
							: "Volunteer";
				const section = data.sections[candidate.sectionKey as keyof typeof data.sections];
				const item = section.items[candidate.itemIndex] as { company?: string; name?: string; position?: string };
				const itemLabel = item.company || item.name || item.position || "";

				if (edit.action === "hide") {
					// Find the bullet's <li> index within the description HTML to hide it
					suggestions.push({
						id: `BR-S-hide-${candidate.sectionKey}-${candidate.itemIndex}-${edit.index}`,
						ruleId: "BR-6",
						category: "brevity",
						severity: "warning",
						title: `Hide bullet in ${sectionName} → ${itemLabel}`,
						description: edit.reason,
						autoApplicable: true,
						patches: [
							{
								op: "remove-bullet",
								path: candidate.path,
								oldText: candidate.text,
							},
						],
						estimatedScoreGain: 1,
						diff: {
							type: "text_replace",
							location: `${sectionName} → ${itemLabel}`,
							fieldPath: candidate.path,
							hunks: [{ removed: candidate.text }],
						},
					});
				} else if (edit.action === "shorten" && edit.rewritten) {
					if (edit.rewritten.trim() === candidate.text.trim()) continue;
					const rewriteWords = edit.rewritten.split(/\s+/).length;
					if (rewriteWords >= candidate.wordCount) continue; // Must actually be shorter

					suggestions.push({
						id: `BR-S-shorten-${candidate.sectionKey}-${candidate.itemIndex}-${edit.index}`,
						ruleId: "BR-5",
						category: "brevity",
						severity: "warning",
						title: `Shorten bullet in ${sectionName} → ${itemLabel}`,
						description: edit.reason,
						autoApplicable: true,
						patches: [
							{
								op: "replace-bullet",
								path: candidate.path,
								oldText: candidate.text,
								newText: edit.rewritten,
							},
						],
						estimatedScoreGain: 1,
						diff: {
							type: "text_replace",
							location: `${sectionName} → ${itemLabel}`,
							fieldPath: candidate.path,
							hunks: [{ removed: candidate.text }, { added: edit.rewritten }],
						},
					});
				}
			}
		}
	}

	// ── 6. Non-LLM actionable suggestions ──

	// Unsafe font
	const bodyFont = (data.metadata.typography?.body?.fontFamily ?? "").toLowerCase();
	const headingFont = (data.metadata.typography?.heading?.fontFamily ?? "").toLowerCase();
	const currentFont = bodyFont || headingFont;
	if (currentFont && !ATS_SAFE_FONTS.some((f) => currentFont.includes(f))) {
		suggestions.push({
			id: "FM-S-font",
			ruleId: "FM-1",
			category: "formatting",
			severity: "warning",
			title: `Font "${currentFont}" is not ATS-safe`,
			description: 'Switch to an ATS-safe font like "Inter" for better ATS parsing.',
			autoApplicable: true,
			patches: [
				{ op: "replace", path: "/metadata/typography/body/fontFamily", value: "Inter" },
				{ op: "replace", path: "/metadata/typography/heading/fontFamily", value: "Inter" },
			],
			estimatedScoreGain: 4,
			diff: {
				type: "field_replace",
				location: "Typography",
				fieldPath: "/metadata/typography/body/fontFamily",
				hunks: [{ removed: `Font: ${currentFont}` }, { added: "Font: Inter" }],
			},
		});
	}

	// Unsafe template
	const template = data.metadata.template?.toLowerCase() ?? "";
	if (template && !ATS_SAFE_TEMPLATES.includes(template)) {
		suggestions.push({
			id: "FM-S-template",
			ruleId: "FM-3",
			category: "formatting",
			severity: "warning",
			title: `Template "${template}" may not be ATS-safe`,
			description: 'Switch to an ATS-verified single-column template like "Onyx" for best compatibility.',
			autoApplicable: true,
			patches: [{ op: "replace", path: "/metadata/template", value: "onyx" }],
			estimatedScoreGain: 2,
			diff: {
				type: "field_replace",
				location: "Template",
				fieldPath: "/metadata/template",
				hunks: [{ removed: `Template: ${template}` }, { added: "Template: onyx" }],
			},
		});
	}

	// Hide profile picture (only when one actually displays — same rules as PagePicture + hidden flag)
	if (isProfilePictureDisplayedOnResume(data)) {
		suggestions.push({
			id: "FM-S1-picture",
			ruleId: "FM-2",
			category: "formatting",
			severity: "warning",
			title: "Profile picture visible",
			description: "Most ATS systems can't parse images. Hide your profile picture for better ATS compatibility.",
			autoApplicable: true,
			patches: [{ op: "replace", path: "/picture/hidden", value: true }],
			estimatedScoreGain: 2,
			diff: {
				type: "field_replace",
				location: "Picture",
				fieldPath: "/picture/hidden",
				hunks: [{ removed: "Picture: visible" }, { added: "Picture: hidden" }],
			},
		});
	}

	// Remove emojis from resume fields
	const emojiFields: Array<{ path: string; value: string; cleaned: string; location: string }> = [];

	// Check basics fields
	for (const field of ["name", "headline", "email", "phone", "location"] as const) {
		const val = data.basics[field];
		if (val && findEmojis(val).length > 0) {
			emojiFields.push({
				path: `/basics/${field}`,
				value: val,
				cleaned: removeEmojis(val),
				location: `Basics → ${field}`,
			});
		}
	}

	// Check summary
	const summaryText = data.summary.content;
	if (summaryText && findEmojis(stripHtml(summaryText)).length > 0) {
		emojiFields.push({
			path: "/summary/content",
			value: summaryText,
			cleaned: removeEmojis(summaryText),
			location: "Summary",
		});
	}

	// Check section item fields
	for (const key of [
		"experience",
		"projects",
		"volunteer",
		"education",
		"skills",
		"awards",
		"certifications",
	] as const) {
		const section = data.sections[key];
		if (section.hidden) continue;
		for (const [idx, item] of section.items.entries()) {
			if (item.hidden) continue;
			for (const [fieldName, val] of Object.entries(item)) {
				if (typeof val === "string" && findEmojis(val).length > 0) {
					const sectionLabel = key.charAt(0).toUpperCase() + key.slice(1);
					emojiFields.push({
						path: `/sections/${key}/items/${idx}/${fieldName}`,
						value: val,
						cleaned: removeEmojis(val),
						location: `${sectionLabel} → item ${idx + 1} → ${fieldName}`,
					});
				}
			}
		}
	}

	for (const ef of emojiFields) {
		suggestions.push({
			id: `FM-S-emoji-${ef.path.replace(/\//g, "-")}`,
			ruleId: "FM-5",
			category: "formatting",
			severity: "warning",
			title: `Remove emoji from ${ef.location}`,
			description: "ATS parsers cannot read emojis. Remove them for better compatibility.",
			autoApplicable: true,
			patches: [{ op: "replace", path: ef.path, value: ef.cleaned }],
			estimatedScoreGain: 1,
			diff: {
				type: "text_replace",
				location: ef.location,
				fieldPath: ef.path,
				hunks: [{ removed: ef.value }, { added: ef.cleaned }],
			},
		});
	}

	// Missing contact info
	const missingContact: string[] = [];
	if (!data.basics.email.trim()) missingContact.push("email");
	if (!data.basics.phone.trim()) missingContact.push("phone");
	if (!data.basics.location.trim()) missingContact.push("location");

	for (const field of missingContact) {
		suggestions.push({
			id: `SC-S2-${field}`,
			ruleId: "SC-4",
			category: "structure",
			severity: "warning",
			title: `Missing ${field}`,
			description: `Add your ${field} to ensure recruiters and ATS systems can contact you.`,
			autoApplicable: false,
			estimatedScoreGain: 1,
			diff: {
				type: "add_item",
				location: "Basics",
				fieldPath: `/basics/${field}`,
				hunks: [{ added: `Add your ${field}` }],
			},
		});
	}

	// Headline alignment with JD
	if (jdAnalysis && jdAnalysis.jobTitle) {
		const headline = data.basics.headline.toLowerCase();
		const jobTitle = jdAnalysis.jobTitle.toLowerCase();
		if (!headline.includes(jobTitle) && headline !== jobTitle) {
			suggestions.push({
				id: "TR-S1-headline",
				ruleId: "TR-1",
				category: "tailoring",
				severity: "warning",
				title: "Headline doesn't match JD title",
				description: `Your headline "${data.basics.headline}" doesn't match the job title "${jdAnalysis.jobTitle}". Aligning them improves ATS matching.`,
				autoApplicable: true,
				patches: [{ op: "replace", path: "/basics/headline", value: jdAnalysis.jobTitle }],
				estimatedScoreGain: 3,
				diff: {
					type: "field_replace",
					location: "Headline",
					fieldPath: "/basics/headline",
					hunks: [{ removed: data.basics.headline }, { added: jdAnalysis.jobTitle }],
				},
			});
		}
	}

	// ── Tailoring: Education match (TR-4) ──
	if (jdAnalysis && jdAnalysis.educationRequirements.length > 0) {
		const eduItems = data.sections.education.items.filter((item) => !item.hidden);
		const allEduText = eduItems.map((item) => `${item.degree} ${item.area} ${item.school}`.toLowerCase()).join(" ");

		const unmatchedReqs = jdAnalysis.educationRequirements.filter((req) => !allEduText.includes(req.toLowerCase()));

		if (unmatchedReqs.length > 0) {
			suggestions.push({
				id: "TR-S4-education",
				ruleId: "TR-4",
				category: "tailoring",
				severity: "info",
				title: "Education doesn't match JD requirements",
				description: `The job expects: ${jdAnalysis.educationRequirements.join(", ")}. ${unmatchedReqs.length === jdAnalysis.educationRequirements.length ? "None of these appear in your education section." : `Missing: ${unmatchedReqs.join(", ")}.`} If you have relevant coursework or certifications, add them.`,
				autoApplicable: false,
				estimatedScoreGain: 1,
				diff: {
					type: "text_replace",
					location: "Education",
					fieldPath: "/sections/education",
					hunks: [
						{ context: `JD requires: ${jdAnalysis.educationRequirements.join(", ")}` },
						{ added: `Add relevant coursework or highlight: ${unmatchedReqs.join(", ")}` },
					],
				},
			});
		}
	}

	// ── Hide irrelevant education entries (e.g. class 10th/12th when graduate) ──
	const eduSection = data.sections.education;
	if (!eduSection.hidden) {
		const visibleEdu = eduSection.items.map((item, idx) => ({ ...item, idx })).filter((item) => !item.hidden);

		const highSchoolPatterns =
			/\b(class\s*(?:10|ten|x|xth|10th)|class\s*(?:12|twelve|xii|xiith|12th)|ssc|hsc|sslc|cbse|icse|isc|(?:10th|12th)\s*(?:grade|standard|std)|secondary|sr\.?\s*secondary|sr\.?\s*sec|higher\s*secondary|high\s*school|intermediate|matriculat|(?:std|standard)\s*(?:10|12|x|xii))\b/i;

		const hasHigherDegree = visibleEdu.some((item) => {
			const combined = `${item.degree} ${item.area} ${item.school}`.toLowerCase();
			return /\b(b\.?tech|b\.?e|b\.?sc|b\.?a|b\.?com|bca|bba|m\.?tech|m\.?e|m\.?sc|m\.?a|mca|mba|m\.?com|ph\.?d|bachelor|master|doctor|diploma|associate|undergraduate|graduate|postgraduate|engineering|university|college)\b/i.test(
				combined,
			);
		});

		if (hasHigherDegree) {
			for (const item of visibleEdu) {
				const combined = `${item.degree} ${item.area} ${item.school}`;
				if (highSchoolPatterns.test(combined)) {
					const label = item.school || item.degree || "entry";
					suggestions.push({
						id: `BR-S-edu-${item.idx}`,
						ruleId: "BR-3",
						category: "brevity",
						severity: "warning",
						title: `Hide "${label}" from Education`,
						description: `You have a higher degree — class 10th/12th details are irrelevant for recruiters and waste resume space.`,
						autoApplicable: true,
						patches: [{ op: "replace", path: `/sections/education/items/${item.idx}/hidden`, value: true }],
						estimatedScoreGain: 1,
						diff: {
							type: "field_replace",
							location: `Education → ${label}`,
							fieldPath: `/sections/education/items/${item.idx}/hidden`,
							hunks: [{ removed: `${item.degree}${item.area ? ` — ${item.area}` : ""} at ${item.school}` }],
						},
					});
				}
			}
		}
	}

	// ── 7. Reverse chronological order suggestions ──
	const datedSections = [
		{ key: "experience", label: "Experience" },
		{ key: "education", label: "Education" },
		{ key: "projects", label: "Projects" },
		{ key: "volunteer", label: "Volunteer" },
		{ key: "awards", label: "Awards" },
		{ key: "certifications", label: "Certifications" },
		{ key: "publications", label: "Publications" },
	] as const;

	for (const { key, label } of datedSections) {
		const section = data.sections[key];
		if (section.hidden) continue;
		const items = section.items as Array<{ period?: string; date?: string; hidden?: boolean; [k: string]: unknown }>;
		if (isReverseChronological(items)) continue;

		// Build the correctly sorted items array (by latest year, descending)
		const visibleWithIdx = items
			.map((item, idx) => ({ item, idx, year: extractLatestYear(item.period || item.date) }))
			.filter(({ item }) => !item.hidden);

		const sorted = [...visibleWithIdx].sort((a, b) => b.year - a.year);

		// Build a full reordered items array (preserving hidden items at their positions isn't worth the complexity — just sort all)
		const sortedItems = [...items]
			.map((item, idx) => ({
				item,
				idx,
				year: extractLatestYear((item as { period?: string }).period || (item as { date?: string }).date),
			}))
			.sort((a, b) => {
				// Hidden items go to the end
				if (a.item.hidden && !b.item.hidden) return 1;
				if (!a.item.hidden && b.item.hidden) return -1;
				if (a.item.hidden && b.item.hidden) return 0;
				return b.year - a.year;
			})
			.map(({ item }) => item);

		const currentOrder = visibleWithIdx
			.map((v) => {
				const name =
					(v.item as Record<string, unknown>).company ||
					(v.item as Record<string, unknown>).school ||
					(v.item as Record<string, unknown>).name ||
					(v.item as Record<string, unknown>).title ||
					(v.item as Record<string, unknown>).organization ||
					`Item ${v.idx + 1}`;
				const dateStr = v.item.period || v.item.date || "";
				return `${name} (${dateStr})`;
			})
			.join(" → ");

		const correctOrder = sorted
			.map((v) => {
				const name =
					(v.item as Record<string, unknown>).company ||
					(v.item as Record<string, unknown>).school ||
					(v.item as Record<string, unknown>).name ||
					(v.item as Record<string, unknown>).title ||
					(v.item as Record<string, unknown>).organization ||
					`Item ${v.idx + 1}`;
				const dateStr = v.item.period || v.item.date || "";
				return `${name} (${dateStr})`;
			})
			.join(" → ");

		suggestions.push({
			id: `SC-S3-${key}`,
			ruleId: "SC-3",
			category: "structure",
			severity: "warning",
			title: `Reorder ${label} — latest first`,
			description: `${label} items should be in reverse chronological order (most recent first). Current: ${currentOrder}`,
			autoApplicable: true,
			patches: [{ op: "replace", path: `/sections/${key}/items`, value: sortedItems }],
			estimatedScoreGain: 1,
			diff: {
				type: "reorder",
				location: label,
				fieldPath: `/sections/${key}/items`,
				hunks: [{ removed: currentOrder }, { added: correctOrder }],
			},
		});
	}

	// ── 8. Column layout suggestions (save space for short-item sections) ──
	const allSectionKeys = Object.keys(data.sections) as (keyof typeof data.sections)[];

	for (const key of allSectionKeys) {
		const section = data.sections[key];
		if (section.hidden) continue;
		const visibleItems = section.items.filter((item) => !item.hidden);
		if (visibleItems.length < 3) continue;
		if (section.columns >= 2) continue; // Already multi-column

		// Calculate average visible text length per item
		const avgWords =
			visibleItems.reduce((sum, item) => {
				const texts: string[] = [];
				for (const [, val] of Object.entries(item)) {
					if (typeof val === "string") texts.push(stripHtml(val));
					if (Array.isArray(val)) texts.push(...val.filter((v): v is string => typeof v === "string"));
				}
				return sum + texts.join(" ").split(/\s+/).filter(Boolean).length;
			}, 0) / visibleItems.length;

		// Only suggest multi-column for sections with short items (avg ≤ 8 words per item)
		if (avgWords > 8) continue;

		const recommended = visibleItems.length >= 6 ? 3 : 2;
		const label = section.title || key.charAt(0).toUpperCase() + key.slice(1);

		suggestions.push({
			id: `BR-S-cols-${key}`,
			ruleId: "BR-3",
			category: "brevity",
			severity: "info",
			title: `Use ${recommended} columns for ${label}`,
			description: `${label} has ${visibleItems.length} items averaging ~${Math.round(avgWords)} words each. Using ${recommended} columns saves vertical space.`,
			autoApplicable: true,
			patches: [{ op: "replace", path: `/sections/${key}/columns`, value: recommended }],
			estimatedScoreGain: 1,
			diff: {
				type: "field_replace",
				location: label,
				fieldPath: `/sections/${key}/columns`,
				hunks: [
					{ removed: `${section.columns} column${section.columns > 1 ? "s" : ""}` },
					{ added: `${recommended} columns` },
				],
			},
		});
	}

	// ── 9. Project coaching (non-auto when LLM did not supply a rewrite) ──
	const projectItems = (data.sections.projects?.items ?? []).filter((i) => !i.hidden);
	const autoAppliedProjectPaths = new Set(suggestions.map((s) => s.diff.fieldPath));

	for (const project of projectItems) {
		const projectName = String((project as { name?: string }).name ?? "").trim() || "Untitled Project";
		const rawDesc = "description" in project ? (project as { description: string }).description : "";
		const desc = stripHtml(rawDesc).trim();
		const descWords = desc.split(/\s+/).filter(Boolean).length;

		const hasTechStack =
			/\b(react|vue|angular|node|python|java|typescript|javascript|aws|docker|kubernetes|sql|api|mongodb|postgresql|git|flutter|kotlin|swift|django|flask|express|firebase|tailwind|next\.?js|fastapi|spring|redis|graphql|pytorch|tensorflow|sklearn|pandas|numpy|supabase|prisma|vercel|netlify)\b/i.test(
				desc,
			);
		const hasOutcome =
			/\b(\d+\s*(users|customers|downloads|stars|requests|records|entries)|improved|reduced|increased|deployed|launched|live|production|active|published)\b/i.test(
				desc,
			);
		const isVague = /\b(simple|basic|sample|just|only|small|mini|practice|learning|demo|placeholder)\b/i.test(desc);

		const needsCoaching = descWords < 20 || (!hasTechStack && !hasOutcome) || isVague;
		if (!needsCoaching) continue;

		const realIdx = data.sections.projects?.items.indexOf(project) ?? -1;
		if (realIdx === -1) continue;

		const fieldPath = `/sections/projects/items/${realIdx}/description`;
		if (autoAppliedProjectPaths.has(fieldPath)) continue;

		const issues: string[] = [];
		if (descWords === 0) issues.push("no description");
		else if (descWords < 20) issues.push(`only ${descWords} word${descWords !== 1 ? "s" : ""}`);
		if (!hasTechStack) issues.push("no tech stack");
		if (!hasOutcome) issues.push("no outcomes or impact");
		if (isVague) issues.push("contains filler words");

		const bodySections: SuggestionBodySection[] = [
			{
				title: `Issues: ${issues.join(", ")}`,
				items: [
					"What does it do? Example: A web app that helps students track internship applications.",
					"What tech did you use? Example: React, Node.js, PostgreSQL.",
					"What was the impact? Example: Used by 200+ students; deployed on Vercel.",
				],
			},
		];
		if (!hasTechStack) {
			bodySections.push({
				title: "Add technologies",
				items: ["Name frameworks, databases, cloud services, and languages you used."],
			});
		}
		if (!hasOutcome) {
			bodySections.push({
				title: "Add a measurable result",
				items: ["Users, uptime, accuracy, latency, GitHub stars, or class size — estimates are better than none."],
			});
		}
		if (isVague && desc) {
			bodySections.push({
				title: "Tone",
				items: ['Drop vague words like "simple", "basic", and "just" — they weaken how your work reads.'],
			});
		}

		suggestions.push({
			id: `CQ-S-proj-${realIdx}`,
			ruleId: "CQ-3",
			category: cqSuggestionCategory,
			severity: descWords < 5 || !hasTechStack ? "critical" : "warning",
			title: `Strengthen project: "${projectName}"`,
			description: `"${projectName}" needs a stronger description (${issues.join(", ")}). Expand with tech stack, your role, and outcomes — or use Accept Change if an AI rewrite is available after re-scoring.`,
			bodySections,
			autoApplicable: false,
			estimatedScoreGain: 2,
			diff: {
				type: "text_replace",
				location: `Projects → ${projectName}`,
				fieldPath,
				hunks: desc ? [{ removed: desc }] : [{ added: "Add description" }],
			},
		});
	}

	// ── 10. Action verb coaching (aggregate tip when multiple bullets are affected) ──
	const bulletsLackingVerb = bullets.filter((b) => !startsWithActionVerb(b.text));
	if (bulletsLackingVerb.length >= 2) {
		const examples = bulletsLackingVerb
			.slice(0, 2)
			.map((b) => `"${b.text.trim().split(/\s+/).slice(0, 3).join(" ")}..."`)
			.join(", ");

		suggestions.push({
			id: "IM-S-actionverb-coach",
			ruleId: "IM-1",
			category: "impactMetrics",
			severity: "warning",
			title: `${bulletsLackingVerb.length} bullet${bulletsLackingVerb.length !== 1 ? "s" : ""} need a strong action verb`,
			description: `Bullets like ${examples} don't open with an action verb — they hide your contribution and look passive to recruiters.\n\nEvery bullet must start with a past-tense verb that shows what YOU did:\n• Technical work: Built, Engineered, Developed, Implemented, Deployed, Designed, Automated, Integrated, Architected\n• Performance improvements: Optimized, Reduced, Increased, Improved, Streamlined, Accelerated, Eliminated\n• Leadership: Led, Coordinated, Mentored, Managed, Spearheaded, Directed, Organized\n• Research/analysis: Analyzed, Investigated, Evaluated, Researched, Identified, Benchmarked\n• Creation: Created, Launched, Established, Authored, Founded, Initiated\n\nAvoid passive openers: "Responsible for", "Worked on", "Helped", "Assisted", "Participated in", "Was involved in" — replace these with the verb that describes your actual action.`,
			autoApplicable: false,
			estimatedScoreGain: 3,
			diff: {
				type: "text_replace",
				location: "Multiple bullets",
				fieldPath: "",
				hunks: [{ context: `${bulletsLackingVerb.length} bullets need action verbs` }],
			},
		});
	}

	// ── 11. Metric/impact coaching (aggregate tip when multiple bullets lack numbers) ──
	const bulletsLackingMetric = bullets.filter((b) => !hasQuantifiedMetric(b.text) && startsWithActionVerb(b.text));
	if (bulletsLackingMetric.length >= 3) {
		suggestions.push({
			id: "IM-S-metric-coach",
			ruleId: "IM-2",
			category: "impactMetrics",
			severity: "warning",
			title: `${bulletsLackingMetric.length} bullet${bulletsLackingMetric.length !== 1 ? "s" : ""} have no measurable outcome`,
			description: `Quantified bullets are 40% more likely to pass ATS filters and get recruiter attention. Add specific numbers to show the scale and impact of your work.\n\nAsk yourself for each bullet:\n• How many users/customers/records were affected?\n• What percentage did something improve, reduce, or increase?\n• How long did it save? How much faster?\n• What was the scale — requests/sec, GB of data, number of endpoints?\n\nExamples:\n• "Built a REST API" → "Built a REST API serving 500+ daily requests across 3 microservices"\n• "Improved performance" → "Reduced page load time by 40% through lazy loading and caching"\n• "Managed a database" → "Managed a PostgreSQL database with 10,000+ student records"\n• "Trained a model" → "Trained a classification model achieving 92% accuracy on 5,000 samples"\n\nFor student projects, even estimates are better than nothing — if your app was used in class, mention how many students.`,
			autoApplicable: false,
			estimatedScoreGain: 4,
			diff: {
				type: "text_replace",
				location: "Multiple bullets",
				fieldPath: "",
				hunks: [{ context: `${bulletsLackingMetric.length} bullets lack measurable outcomes` }],
			},
		});
	}

	// ── 12. XYZ formula coaching (if overall compliance is low) ──
	const nonXYZBullets = bullets.filter((b) => !isXYZCompliant(b.text));
	if (nonXYZBullets.length >= 3 && bullets.length >= 4) {
		const xyzRatio = nonXYZBullets.length / bullets.length;
		if (xyzRatio > 0.6) {
			suggestions.push({
				id: "IM-S-xyz-coach",
				ruleId: "IM-3",
				category: "impactMetrics",
				severity: "info",
				title: "Apply the XYZ formula to your bullets",
				description: `${nonXYZBullets.length} of your ${bullets.length} bullets don't follow the XYZ formula — the gold standard for resume bullets used by Google's hiring guidelines.\n\nXYZ Formula: "Accomplished [X] as measured by [Y], by doing [Z]"\n\n• X = what you achieved (the result/outcome)\n• Y = how you measured it (the metric)\n• Z = how you did it (the method/tool/approach)\n\nExamples:\n• "Reduced API response time [X] by 35% [Y] by implementing Redis caching [Z]"\n• "Built an internship tracker [X] used by 200 students [Y] using React and Supabase [Z]"\n• "Increased test coverage [X] from 45% to 87% [Y] by writing 120 unit tests with Jest [Z]"\n\nNot every bullet needs all three, but aim for at least X + Y or X + Z. Bullets with only X ("Developed a feature") are the weakest.`,
				autoApplicable: false,
				estimatedScoreGain: 2,
				diff: {
					type: "text_replace",
					location: "Multiple bullets",
					fieldPath: "",
					hunks: [{ context: `${nonXYZBullets.length}/${bullets.length} bullets don't follow XYZ formula` }],
				},
			});
		}
	}

	// ── 13. Summary coaching (when summary exists but is generic boilerplate) ──
	if (!needsSummary) {
		const summaryPlain = stripHtml(data.summary.content).trim();
		const boilerplateTerms = [
			"results-driven",
			"dynamic professional",
			"passionate about",
			"strong communication skills",
			"team player",
			"hardworking",
			"detail-oriented",
			"self-motivated",
			"fast learner",
			"quick learner",
			"seeking impactful opportunities",
			"adept at collaborating",
		];
		const summaryLower = summaryPlain.toLowerCase();
		const boilerplateCount = boilerplateTerms.filter((t) => summaryLower.includes(t)).length;
		const summaryHasTech =
			/\b(react|vue|angular|node|python|java|typescript|javascript|aws|docker|sql|machine learning|deep learning|spring|django|flask|express|mongodb|postgresql|kubernetes|graphql)\b/i.test(
				summaryPlain,
			);
		const summaryHasMetric = /\d+[%+]|\d+\s*(years?|months?|projects?|apps?|systems?)/i.test(summaryPlain);

		if (boilerplateCount >= 2 || (!summaryHasTech && !summaryHasMetric && summaryPlain.length > 20)) {
			const problems: string[] = [];
			if (boilerplateCount >= 2)
				problems.push(`${boilerplateCount} generic buzzword${boilerplateCount !== 1 ? "s" : ""}`);
			if (!summaryHasTech) problems.push("no specific technologies mentioned");
			if (!summaryHasMetric) problems.push("no quantified experience");

			suggestions.push({
				id: "SC-S4-summary-coach",
				ruleId: "SC-2",
				category: "structure",
				severity: "warning",
				title: `Summary is too generic (${problems.join(", ")})`,
				description: `Your summary reads as boilerplate — recruiters see hundreds of "results-driven team players" and skip them. A strong summary is specific to YOU.\n\nRewrite it to answer:\n1. Who are you? — your field, level, and specialization (e.g., "Final-year Computer Science student specializing in full-stack development")\n2. What have you built/done? — name 1-2 specific projects or achievements with tech/metrics (e.g., "Built a React + Node.js internship tracker used by 200+ students")\n3. What are you targeting? — the role or domain you're applying for\n\nExample: "Final-year B.Tech student with hands-on experience building full-stack web apps using React, Node.js, and PostgreSQL. Developed an internship management platform used by 200+ students at our college. Looking for backend/full-stack engineer roles where I can work on scalable systems."\n\nRemove: "${boilerplateTerms
					.filter((t) => summaryLower.includes(t))
					.slice(0, 3)
					.join('", "')}"`,
				autoApplicable: false,
				estimatedScoreGain: 2,
				diff: {
					type: "text_replace",
					location: "Summary",
					fieldPath: "/summary/content",
					hunks: [{ removed: summaryPlain.slice(0, 120) + (summaryPlain.length > 120 ? "..." : "") }],
				},
			});
		}
	}

	// ── 14. Brevity explanation (what this score means) ──
	if (scoringContext) {
		const brevCat = scoringContext.categories.brevity;
		const brevPct = brevCat.max > 0 ? brevCat.score / brevCat.max : 1;
		const hasBrevitySuggestion = suggestions.some((s) => s.category === "brevity" && s.ruleId !== "BR-S-cols");

		if (!hasBrevitySuggestion && brevPct < 0.8) {
			const wc = countResumeWords(data);
			const pages = estimatePageCount(data);
			const bulletCount = bullets.length;
			const brevityIssues: string[] = [];
			if (wc > RECOMMENDED_WORD_RANGE.max)
				brevityIssues.push(`${wc} words (target: ${RECOMMENDED_WORD_RANGE.min}–${RECOMMENDED_WORD_RANGE.max})`);
			if (pages > 1) brevityIssues.push(`${pages} pages (target: 1)`);
			if (bulletCount > RECOMMENDED_BULLET_RANGE.max)
				brevityIssues.push(
					`${bulletCount} bullets (target: ${RECOMMENDED_BULLET_RANGE.min}–${RECOMMENDED_BULLET_RANGE.max})`,
				);

			if (brevityIssues.length > 0) {
				suggestions.push({
					id: "BR-S-explain",
					ruleId: "BR-5",
					category: "brevity",
					severity: "info",
					title: `Brevity: ${brevityIssues.join(" | ")}`,
					description: `The Brevity score checks: word count (400–675), total bullet count (12–20), and page length (ideally 1). Concise resumes perform better in ATS — recruiters spend ~7 seconds on a first pass.\n\nTo improve:\n• Cut filler phrases ("responsible for", "participated in") — replace with direct verbs\n• Limit each role to 3–5 bullets; keep only the strongest achievements\n• Aim for bullets under 20 words\n• If you have high school education listed alongside a degree, hide it — it wastes space and looks junior`,
					autoApplicable: false,
					estimatedScoreGain: Math.ceil((brevCat.max - brevCat.score) / 2),
					diff: {
						type: "text_replace",
						location: "Overall resume",
						fieldPath: "",
						hunks: [{ context: brevityIssues.join(" | ") }],
					},
				});
			}
		}
	}

	// ── 15. Content Quality / Tailoring explanation ──
	if (scoringContext && scoringContext.categories.tailoring) {
		const cqCat = scoringContext.categories.tailoring;
		const cqPct = cqCat.max > 0 ? cqCat.score / cqCat.max : 1;
		const hasCQSuggestion = suggestions.some((s) => s.category === "tailoring");
		const isJDMode = scoringContext.jdProvided;

		if (!hasCQSuggestion && cqPct < 0.8) {
			if (isJDMode) {
				suggestions.push({
					id: "TR-S-explain",
					ruleId: "TR-0",
					category: "tailoring",
					severity: "info",
					title: "How Tailoring is scored",
					description: `In Job Match mode, Tailoring (${cqCat.score}/${cqCat.max}) checks 4 dimensions:\n\n• **Title alignment** (0–3): Does your headline match the JD title? Even partial match (e.g. "Software Engineer" vs "Backend Software Engineer") earns points.\n• **Summary relevance** (0–3): Does your summary mention the target role and key required skills?\n• **Experience relevance** (0–2): Do your recent positions reflect the JD role's domain?\n• **Education match** (0–2): Does your degree/area match what the JD requires?\n\nTo improve: update your headline to include the exact job title, rewrite your summary to reference the role and 2–3 required skills, and ensure your experience bullets use JD-relevant terminology.`,
					autoApplicable: false,
					estimatedScoreGain: Math.ceil((cqCat.max - cqCat.score) / 2),
					diff: {
						type: "text_replace",
						location: "Summary + Headline",
						fieldPath: "",
						hunks: [
							{
								context: `Tailoring score: ${cqCat.score}/${cqCat.max} — update headline, summary, and bullets to match the JD`,
							},
						],
					},
				});
			} else {
				suggestions.push({
					id: "CQ-S-explain",
					ruleId: "CQ-0",
					category: "tailoring",
					severity: "info",
					title: "How Content Quality is scored",
					description: `Without a job description, Content Quality (${cqCat.score}/${cqCat.max}) measures the inherent strength of your resume content across 4 dimensions:\n\n• **Bullet specificity** (0–4): Are your bullets concrete? Do they name technologies, scales, and outcomes? Generic bullets ("developed a website") score 0.\n• **Summary quality** (0–2): Is your summary specific to YOU, or boilerplate ("results-driven professional")?\n• **Project depth** (0–2): Do your project descriptions include tech stack + what it does + outcome?\n• **Career narrative** (0–2): Does your overall resume tell a coherent story (skills + experience + education aligned)?\n\nPaste a job description to switch to Job Match mode and get role-specific tailoring feedback.`,
					autoApplicable: false,
					estimatedScoreGain: Math.ceil((cqCat.max - cqCat.score) / 2),
					diff: {
						type: "text_replace",
						location: "Summary + Projects + Bullets",
						fieldPath: "",
						hunks: [
							{ context: `Content Quality: ${cqCat.score}/${cqCat.max} — add specifics, tech names, and outcomes` },
						],
					},
				});
			}
		}
	}

	// ── Repetition checks (IM-6) ──
	// These run statically — no LLM needed. Added after the main pass so they always appear.
	const bulletTexts = bullets.map((b) => b.text);

	// Repetitive openers
	const repeatedOpeners = findRepetitiveOpeners(bulletTexts, 3);
	if (repeatedOpeners.size > 0 && !suggestions.some((s) => s.id === "IM-6-openers")) {
		const examples = [...repeatedOpeners.entries()].map(([word, count]) => `"${word}" (${count}×)`).join(", ");
		const offendingWords = [...repeatedOpeners.keys()];
		suggestions.push({
			id: "IM-6-openers",
			ruleId: "IM-6",
			category: "impactMetrics",
			severity: "warning",
			title: "Repetitive bullet openers",
			description: `The following starting words appear 3 or more times across your bullets: ${examples}. Recruiters notice when every bullet starts the same way — it makes your experience look narrow and copy-pasted.`,
			descriptionBullets: [
				`Replace repeated openers with varied action verbs from different categories — e.g. instead of only "Developed", try "Designed", "Architected", "Shipped", "Optimised", "Integrated".`,
				`Aim for no single opener appearing more than 2 times across all bullets.`,
				`Words to diversify: ${offendingWords.join(", ")}.`,
			],
			autoApplicable: false,
			estimatedScoreGain: 1,
			diff: {
				type: "text_replace",
				location: "Experience / Projects bullets",
				fieldPath: "",
				hunks: offendingWords.map((word) => ({
					context: `Find bullets starting with "${word}" and replace with a different strong action verb that better describes that specific contribution.`,
				})),
			},
		});
	}

	// Near-duplicate bullets
	const duplicatePairs = findNearDuplicateBullets(bulletTexts, 0.65);
	if (duplicatePairs.length > 0 && !suggestions.some((s) => s.id === "IM-6-duplicates")) {
		const pairExamples = duplicatePairs.slice(0, 3).map(([i, j]) => {
			const a = bulletTexts[i] ? `"${bulletTexts[i].slice(0, 55)}${bulletTexts[i].length > 55 ? "…" : ""}"` : "";
			const b = bulletTexts[j] ? `"${bulletTexts[j].slice(0, 55)}${bulletTexts[j].length > 55 ? "…" : ""}"` : "";
			return `${a} ↔ ${b}`;
		});
		suggestions.push({
			id: "IM-6-duplicates",
			ruleId: "IM-6",
			category: "impactMetrics",
			severity: "warning",
			title: `${duplicatePairs.length} near-duplicate bullet${duplicatePairs.length > 1 ? "s" : ""} detected`,
			description: `${duplicatePairs.length} pair${duplicatePairs.length > 1 ? "s" : ""} of bullets share more than 65% of their words. Each bullet should describe a distinct accomplishment — duplicates dilute impact and waste your limited resume space.`,
			descriptionBullets: [
				...pairExamples,
				"For each duplicate pair: keep the stronger bullet and rewrite the other to highlight a different outcome, tool, or scale.",
			],
			autoApplicable: false,
			estimatedScoreGain: 1,
			diff: {
				type: "text_replace",
				location: "Experience / Projects bullets",
				fieldPath: "",
				hunks: duplicatePairs.slice(0, 3).map(([i, j]) => ({
					removed: bulletTexts[j]?.slice(0, 100),
					context: `This bullet is too similar to bullet starting: "${bulletTexts[i]?.slice(0, 60)}"`,
				})),
			},
		});
	}

	ensureCategoryCoverage(suggestions, scoringContext);

	// ── Cross-category consistency signal ──
	// When keyword coverage is high but impact bullets are weak, the resume will pass ATS
	// but fail recruiter review — flag this explicitly so students understand the gap.
	if (scoringContext) {
		const kwCat = scoringContext.categories.keywordMatch;
		const imCat = scoringContext.categories.impactMetrics;
		const kwPct = kwCat.max > 0 ? kwCat.score / kwCat.max : 0;
		const imPct = imCat.max > 0 ? imCat.score / imCat.max : 0;

		if (kwPct > 0.8 && imPct < 0.4 && !suggestions.some((s) => s.id === "CROSS-KW-IM")) {
			suggestions.push({
				id: "CROSS-KW-IM",
				ruleId: "CROSS-1",
				category: "impactMetrics",
				severity: "warning",
				title: "Your keywords aren't backed by demonstrated experience",
				description: `Your keyword coverage is strong (${kwCat.score}/${kwCat.max}) but your impact bullets are weak (${imCat.score}/${imCat.max}). Keywords get you past the ATS filter — but recruiters will see bullets that don't back them up. Each key skill should appear in at least one bullet showing what you built, shipped, or improved using it.\n\nExample: if "PostgreSQL" is in your skills, add a bullet like "Designed and optimized PostgreSQL schema for 10,000+ records, reducing query time by 35%".`,
				autoApplicable: false,
				estimatedScoreGain: 5,
				diff: {
					type: "text_replace",
					location: "Experience / Projects",
					fieldPath: "",
					hunks: [
						{
							context:
								"For each listed skill, write a bullet showing HOW you used it — tool + action + result (even an estimate).",
						},
					],
				},
			});
		}
	}

	// Sort by estimated score gain (highest first), then by severity
	const severityOrder = { critical: 0, warning: 1, info: 2 };
	suggestions.sort((a, b) => {
		if (b.estimatedScoreGain !== a.estimatedScoreGain) return b.estimatedScoreGain - a.estimatedScoreGain;
		return severityOrder[a.severity] - severityOrder[b.severity];
	});

	return { suggestions, aiRewriteUnavailable };
}

function ensureCategoryCoverage(suggestions: Suggestion[], scoringContext: AtsScoringContext | null) {
	if (!scoringContext) return;

	const cats = scoringContext.categories;
	const entries: { key: keyof typeof cats; cat: (typeof cats)[keyof typeof cats] }[] = [
		{ key: "keywordMatch", cat: cats.keywordMatch },
		{ key: "impactMetrics", cat: cats.impactMetrics },
		{ key: "structure", cat: cats.structure },
		{ key: "formatting", cat: cats.formatting },
		{ key: "brevity", cat: cats.brevity },
	];
	if (cats.tailoring) {
		entries.push({ key: "tailoring", cat: cats.tailoring });
	}

	for (const { key, cat } of entries) {
		if (!cat || cat.score >= cat.max) continue;
		const hasAny = suggestions.some((s) => s.category === key);
		if (hasAny) continue;

		const weakRules = cat.details.filter((r) => r.score < r.maxScore).slice(0, 2);
		for (const rule of weakRules) {
			suggestions.push({
				id: `FALLBACK-${key}-${rule.ruleId}`,
				ruleId: rule.ruleId,
				category: key,
				severity: "info",
				title: rule.ruleName,
				description: rule.details ?? "Review this area and edit in the resume builder.",
				autoApplicable: false,
				estimatedScoreGain: Math.max(1, Math.min(4, rule.maxScore - rule.score)),
				diff: {
					type: "text_replace",
					location: String(key),
					fieldPath: "",
					hunks: [],
				},
			});
		}
	}
}

async function getComprehensiveSuggestions(
	data: ResumeData,
	bulletsToRewrite: Array<{ text: string; reason: string }>,
	datesToFix: Array<{ sectionKey: string; itemIndex: number; period: string }>,
	needsSummary: boolean,
	jdAnalysis: JDAnalysis | null,
	brevityCandidates: Array<{ text: string; wordCount: number; sectionKey: string }>,
	brevityStats: { wordCount: number; totalBulletCount: number; pages: number; tooManyWords: boolean },
	needsTailoredSummary: boolean,
	projectsToRewrite: Array<{ itemIndex: number; name: string; plain: string; rawHtml: string }>,
	keywordsNotInBullets: string[] = [],
): Promise<z.infer<typeof comprehensiveSchema> | null> {
	try {
		const apiKey = env.OPENAI_API_KEY;
		if (!apiKey) return null;

		const model = createOpenAI({ apiKey, baseURL: env.OPENAI_BASE_URL }).languageModel(SCORING_LLM_CONFIG.model);

		// Build sections of the prompt dynamically
		const promptParts: string[] = [];

		if (bulletsToRewrite.length > 0) {
			promptParts.push(`## BULLET REWRITES
Fix each bullet's specific tagged issue. Make MINIMAL edits — only fix what's tagged.
Rules:
- Each bullet may have MULTIPLE tagged issues (e.g. [no action verb + no quantified metric + not XYZ compliant])
- Fix ALL tagged issues in a single rewrite — the output must be the FINAL improved version
- Start with a strong past-tense action verb (Built, Engineered, Developed, Implemented, Designed, Deployed, Optimized, Reduced, Increased, Led, Created, Automated, Integrated, Analyzed, Launched)
- Add quantified metrics where tagged: use numbers (e.g. "500+ users", "40% faster", "3 services"), even estimates are better than none
- Follow XYZ formula: "Accomplished [X] as measured by [Y] by doing [Z]" — action verb + measurable result + method/tool
- If a weak phrase is tagged (e.g., "Worked on", "Responsible for", "Helped", "Participated in"), replace the entire opening — these hide the student's real contribution
- Keep within ±5 words of original length
- Preserve all existing metrics, numbers, technologies, proper nouns exactly

For the "reason" field write a coaching explanation in 2 sentences max:
1. Name the specific problem (e.g., "Opens with 'Participated in' — a passive phrase that hides your ownership")
2. State what makes the rewrite stronger (e.g., "Changed to 'Led' and added the team size '4 engineers' to show leadership and scale")
Be specific and educational — the student should understand what rule to apply on their own next time.

Input bullets:
${bulletsToRewrite.map((b, i) => `${i}. [${b.reason}] "${b.text}"`).join("\n")}`);
		}

		if (datesToFix.length > 0) {
			promptParts.push(`## DATE CORRECTIONS
Convert each date to standard ATS format: "Mon YYYY - Mon YYYY" or "Mon YYYY - Present".
Examples: "Jan 2023 - Present", "Mar 2021 - Dec 2022", "2023" (year-only is OK).
Only change the format, never invent dates. If a date says "Present" or "Current", keep it.

Input dates:
${datesToFix.map((d, i) => `${i}. "${d.period}"`).join("\n")}`);
		}

		if (needsSummary) {
			const skills = data.sections.skills.items
				.filter((s) => !s.hidden)
				.map((s) => s.name)
				.slice(0, 10);
			const experiences = data.sections.experience.items
				.filter((e) => !e.hidden)
				.slice(0, 3)
				.map((e) => `${e.position} at ${e.company}`);

			promptParts.push(`## PROFESSIONAL SUMMARY
Generate a concise 2-3 sentence professional summary (plain text, no HTML) for:
Name: ${data.basics.name}
Headline: ${data.basics.headline}
Skills: ${skills.join(", ") || "not listed"}
Recent experience: ${experiences.join("; ") || "not listed"}
${jdAnalysis?.jobTitle ? `Target role: ${jdAnalysis.jobTitle}` : ""}
Make it specific to their background. No generic filler.`);
		}

		if (needsTailoredSummary && jdAnalysis) {
			const currentSummary = stripHtml(data.summary.content);
			const skills = data.sections.skills.items
				.filter((s) => !s.hidden)
				.map((s) => s.name)
				.slice(0, 10);
			const experiences = data.sections.experience.items
				.filter((e) => !e.hidden)
				.slice(0, 3)
				.map((e) => `${e.position} at ${e.company}`);
			const projects = data.sections.projects.items
				.filter((p) => !p.hidden)
				.slice(0, 3)
				.map((p) => {
					const desc = stripHtml(p.description).slice(0, 100);
					return `${p.name}: ${desc}`;
				});

			const isEntryLevel =
				/\b(trainee|intern|fresher|graduate|entry|junior|associate|apprentice|campus)\b/i.test(jdAnalysis.jobTitle) ||
				jdAnalysis.experienceLevel === "entry";

			promptParts.push(`## TAILORED SUMMARY
The current summary is NOT tailored to the target job. Rewrite it (plain text, no HTML) to specifically target this role.

Current summary: "${currentSummary}"
Target role: ${jdAnalysis.jobTitle}
Experience level: ${isEntryLevel ? "entry-level / trainee / student (candidate does NOT yet hold this title)" : jdAnalysis.experienceLevel}
Required hard skills: ${jdAnalysis.hardSkills.join(", ") || "none"}
Required tools: ${jdAnalysis.tools.join(", ") || "none"}
Resume skills: ${skills.join(", ") || "not listed"}
Recent experience: ${experiences.join("; ") || "not listed"}
Key projects: ${projects.join("; ") || "not listed"}

Rules:
- Write 2-3 flowing sentences, professional but natural — not a list
- ${isEntryLevel ? `Open with "Aspiring ${jdAnalysis.jobTitle}" or "[Field] student/recent graduate" framing — the candidate is targeting this role, not claiming they already hold it` : `Lead with the candidate's current level and domain (e.g. "Senior backend engineer with 5 years...")`}
- Mention the target role EXACTLY ONCE — either in the opening framing OR as a closing career goal, never in both
- Prefer TECHNICAL skills (languages, frameworks, tools) over soft skills (teamwork, communication, leadership) — only use soft skills if no technical skills are available
- Include at least one specific project, company, or measurable achievement from the resume — name it explicitly rather than using vague phrases
- Do NOT use cliché fillers: "deliver impactful solutions", "apply my technical background", "passionate about", "seeking opportunities to", "results-driven", "leverage my skills"
- Do NOT fabricate experience, companies, skills, or details not present in the provided context
- Return the tailored summary in the "tailoredSummary" field`);
		}

		if (brevityCandidates.length > 0) {
			const excessWords =
				brevityStats.wordCount > RECOMMENDED_WORD_RANGE.max ? brevityStats.wordCount - RECOMMENDED_WORD_RANGE.max : 0;
			const excessBullets =
				brevityStats.totalBulletCount > RECOMMENDED_BULLET_RANGE.max
					? brevityStats.totalBulletCount - RECOMMENDED_BULLET_RANGE.max
					: 0;

			const allowedActions = brevityStats.tooManyWords ? '"shorten" or "hide"' : '"hide" only (do NOT use "shorten")';

			promptParts.push(`## BREVITY EDITS
The resume needs trimming. Current stats:
- ${brevityStats.wordCount} words (recommended: ${RECOMMENDED_WORD_RANGE.min}-${RECOMMENDED_WORD_RANGE.max})${excessWords > 0 ? ` — ${excessWords} words over limit` : " — OK"}
- ${brevityStats.totalBulletCount} bullet points (recommended: ${RECOMMENDED_BULLET_RANGE.min}-${RECOMMENDED_BULLET_RANGE.max})${excessBullets > 0 ? ` — ${excessBullets} bullets over limit` : " — OK"}
- ${brevityStats.pages} page(s) (recommended: 1)

Allowed actions: ${allowedActions}

For each bullet below, decide:
${brevityStats.tooManyWords ? '- "shorten": Rewrite it more concisely (reduce word count by 30-50%) while keeping the key achievement/impact. Provide the shortened version in "rewritten".' : ""}
- "hide": If the bullet is low-impact, generic, or redundant with other bullets, suggest hiding it. Set "rewritten" to null.

Prioritize hiding bullets that:
1. Are generic duties without specific achievements (e.g. "Participated in team meetings")
2. Repeat similar content as other bullets
3. Have the least quantifiable impact
4. Belong to older/less-relevant roles

Prioritize shortening bullets that:
1. Are wordy but contain valuable achievements
2. Have >25 words
3. Contain filler phrases that can be trimmed

Pick enough edits to bring the resume within the recommended ranges.
Each reason should explain WHY this specific bullet should be shortened/hidden.

Input bullets (sorted longest first):
${brevityCandidates.map((b, i) => `${i}. [${b.wordCount} words, ${b.sectionKey}] "${b.text}"`).join("\n")}`);
		}

		if (projectsToRewrite.length > 0) {
			const jdHint = jdAnalysis?.jobTitle
				? `Optional angle: you may lightly align wording with the target role "${jdAnalysis.jobTitle}" without inventing employers, dates, or tools the student did not imply.`
				: "No target job is provided — optimize for general ATS clarity and specificity only; do not invent employers, credentials, or tools not implied by the text.";
			promptParts.push(`## PROJECT DESCRIPTIONS (replace full HTML field)
${jdHint}
Rules:
- Output valid HTML for the resume JSON "description" field only.
- Allowed tags: <p>, <ul>, <li>, <strong>, <br> — no scripts, styles, iframes, or class attributes.
- Prefer a <ul> with 2–4 <li> items covering: problem/scope, tech stack, your contribution, outcome or metric.
- Ground every claim in the current plain text or project name; expand vague lines into concrete, plausible student-project detail — never fabricate company employment.

Projects (index matches projectRewrites array):
${projectsToRewrite.map((p, i) => `${i}. "${p.name}" — current: ${p.plain || "(empty)"}`).join("\n")}`);
		}

		if (keywordsNotInBullets.length > 0) {
			// Build a concise context snapshot for the LLM to write plausible bullets
			const expItems = data.sections.experience.items
				.filter((e) => !e.hidden)
				.slice(0, 4)
				.map((e, idx) => {
					const bullets = getAllBullets(data)
						.filter((b) => b.sectionKey === "experience" && b.itemIndex === idx)
						.map((b) => b.text)
						.slice(0, 3);
					return {
						sectionKey: "experience",
						itemIndex: idx,
						label: `${e.position ?? ""} at ${e.company ?? ""}`.trim() || `Experience ${idx + 1}`,
						bullets,
					};
				});
			const projItems = data.sections.projects.items
				.filter((p) => !p.hidden)
				.slice(0, 3)
				.map((p, idx) => {
					const plain = stripHtml((p as { description?: string }).description ?? "").slice(0, 120);
					return {
						sectionKey: "projects",
						itemIndex: idx,
						label: (p as { name?: string }).name ?? `Project ${idx + 1}`,
						bullets: [plain],
					};
				});
			const contextItems = [...expItems, ...projItems];

			promptParts.push(`## KEYWORD BULLET WEAVING
The following JD keywords appear on the resume (e.g. in the skills list) but are MISSING from all experience/project bullets. For each keyword, write ONE new bullet to add to the most relevant experience or project entry.

Rules:
- Start with a strong past-tense action verb (Built, Implemented, Deployed, Applied, Used, Integrated, Designed, etc.)
- Weave the keyword naturally into a realistic achievement (do NOT just say "Used Python")
- Follow XYZ format where possible: action verb + outcome + method/context
- Use scale or metrics when plausible (e.g. "processed 5,000+ records", "served 200 users")
- Base the bullet on the EXISTING bullets/description for that item — do not fabricate employers, dates, or roles
- Choose the item where the keyword fits most naturally; prefer experience over projects
- Output sectionKey ("experience" or "projects"), itemIndex (0-based), the keyword, and the new bullet text (plain text, no HTML)

Keywords to add (pick the best item for each):
${keywordsNotInBullets.map((kw) => `- "${kw}"`).join("\n")}

Available items:
${contextItems.map((c) => `[${c.sectionKey}][${c.itemIndex}] ${c.label}${c.bullets.length > 0 ? `\n  Existing bullets: ${c.bullets.map((b) => `"${b.slice(0, 80)}"`).join("; ")}` : "\n  (no bullets yet)"}`).join("\n")}`);
		}

		const result = await generateText({
			model,
			temperature: SCORING_LLM_CONFIG.temperature,
			seed: SCORING_LLM_CONFIG.seed,
			output: Output.object({ schema: comprehensiveSchema }),
			messages: [
				{
					role: "system",
					content: `You are an expert resume writer. Return ALL requested fixes in ONE structured response: bullet rewrites, date corrections, brevity edits, optional summaries, optional project description HTML — only for sections provided below.

${promptParts.join("\n\n")}`,
				},
				{
					role: "user",
					content: `Fix everything listed above. Return bulletRewrites (index, original, rewritten, reason), dateCorrections (index, original, corrected), brevityEdits (index, action, rewritten, reason), summary, tailoredSummary, projectRewrites (index, rewritten, reason), and keywordBulletAdditions (keyword, sectionKey, itemIndex, newBullet).${
						bulletsToRewrite.length === 0 ? " bulletRewrites must be []." : ""
					}${datesToFix.length === 0 ? " dateCorrections must be []." : ""}${
						brevityCandidates.length === 0 ? " brevityEdits must be []." : ""
					}${!needsSummary ? " summary must be null." : ""}${
						!needsTailoredSummary ? " tailoredSummary must be null." : ""
					}${
						projectsToRewrite.length === 0
							? " projectRewrites must be []."
							: ` projectRewrites must have exactly one object per project (indices 0-${projectsToRewrite.length - 1}), with full replacement HTML in "rewritten".`
					}${keywordsNotInBullets.length === 0 ? " keywordBulletAdditions must be []." : ` keywordBulletAdditions must have one entry per keyword (${keywordsNotInBullets.join(", ")}).`}`,
				},
			],
		});

		return result.output;
	} catch {
		return null;
	}
}

/**
 * Insert a plain-text bullet into an HTML description field.
 * If the description already has a <ul>, appends a new <li> before </ul>.
 * Otherwise wraps in a new <ul>.
 */
function insertBulletIntoHtml(html: string, newBullet: string): string {
	const escapedBullet = newBullet.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
	const newLi = `<li>${escapedBullet}</li>`;

	if (/<ul[^>]*>/i.test(html)) {
		// Insert before the last </ul>
		return html.replace(/<\/ul>(?![\s\S]*<\/ul>)/i, `${newLi}</ul>`);
	}
	if (html.trim()) {
		// Wrap existing content + new bullet in a <ul>
		return `${html}<ul>${newLi}</ul>`;
	}
	return `<ul>${newLi}</ul>`;
}

/** Remove all emoji characters from text, cleaning up extra spaces */
function removeEmojis(text: string): string {
	const emojis = findEmojis(text);
	let cleaned = text;
	for (const emoji of emojis) {
		cleaned = cleaned.replaceAll(emoji, "");
	}
	return cleaned.replace(/\s{2,}/g, " ").trim();
}
