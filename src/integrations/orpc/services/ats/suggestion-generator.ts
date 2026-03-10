import { createOpenAI } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import z from "zod";
import type { ResumeData } from "@/schema/resume/data";
import type { Suggestion, JDAnalysis } from "./index";
import { getAllBullets, stripHtml, SCORING_LLM_CONFIG } from "./index";
import { startsWithActionVerb, hasQuantifiedMetric, containsWeakPhrase, isXYZCompliant } from "./rules/impact-metrics";
import { isStandardDateFormat, findEmojis, ATS_SAFE_FONTS, ATS_SAFE_TEMPLATES } from "./rules/formatting";
import { env } from "@/utils/env";

const comprehensiveSchema = z.object({
	bulletRewrites: z.array(z.object({
		index: z.number(),
		original: z.string(),
		rewritten: z.string(),
		reason: z.string(),
	})),
	dateCorrections: z.array(z.object({
		index: z.number(),
		original: z.string(),
		corrected: z.string(),
	})),
	summary: z.string().nullable(),
});

export async function generateSuggestions(
	data: ResumeData,
	jdAnalysis: JDAnalysis | null,
	missingRequired: string[],
	missingNiceToHave: string[] = [],
): Promise<Suggestion[]> {
	const suggestions: Suggestion[] = [];
	const bullets = getAllBullets(data);

	// ── 1. Required keyword suggestions (score impact) ──
	for (const keyword of missingRequired.slice(0, 5)) {
		suggestions.push({
			id: `KW-S1-${keyword.toLowerCase().replace(/\s+/g, "-")}`,
			ruleId: "KW-1",
			category: "keywordMatch",
			severity: "critical",
			title: `Add missing keyword: ${keyword}`,
			description: `The job description requires "${keyword}" but it's not in your resume. Add it to your Skills section.`,
			autoApplicable: true,
			patches: [{
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
			}],
			estimatedScoreGain: Math.ceil(25 / Math.max(1, missingRequired.length)),
			diff: {
				type: "add_item",
				location: "Skills",
				fieldPath: "/sections/skills/items/-",
				hunks: [{ added: keyword }],
			},
		});
	}

	// ── 1b. Nice-to-have keyword suggestions (no score impact) ──
	for (const keyword of missingNiceToHave.slice(0, 3)) {
		suggestions.push({
			id: `KW-S2-${keyword.toLowerCase().replace(/\s+/g, "-")}`,
			ruleId: "KW-1",
			category: "keywordMatch",
			severity: "info",
			title: `Good to have: ${keyword}`,
			description: `The job description mentions "${keyword}" — adding it could strengthen your application.`,
			autoApplicable: true,
			patches: [{
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
			}],
			estimatedScoreGain: 0,
			diff: {
				type: "add_item",
				location: "Skills",
				fieldPath: "/sections/skills/items/-",
				hunks: [{ added: keyword }],
			},
		});
	}

	// ── 2. Collect ALL problematic bullets (no limits) ──
	const seen = new Set<number>();
	const bulletsToRewrite: Array<{
		text: string; sectionKey: string; itemIndex: number; path: string;
		bulletIndex: number; reason: string; weakness: string | null;
	}> = [];

	// Weak phrase bullets
	for (const [i, b] of bullets.entries()) {
		const weakness = containsWeakPhrase(b.text);
		if (weakness) {
			seen.add(i);
			bulletsToRewrite.push({ ...b, bulletIndex: i, reason: `weak phrase: "${weakness}"`, weakness });
		}
	}

	// No action verb bullets
	for (const [i, b] of bullets.entries()) {
		if (!seen.has(i) && !startsWithActionVerb(b.text)) {
			seen.add(i);
			bulletsToRewrite.push({ ...b, bulletIndex: i, reason: "no action verb", weakness: null });
		}
	}

	// No quantified metric bullets
	for (const [i, b] of bullets.entries()) {
		if (!seen.has(i) && !hasQuantifiedMetric(b.text)) {
			seen.add(i);
			bulletsToRewrite.push({ ...b, bulletIndex: i, reason: "no quantified metric", weakness: null });
		}
	}

	// XYZ non-compliant bullets (has verb + metric but missing method, or other combos)
	for (const [i, b] of bullets.entries()) {
		if (!seen.has(i) && !isXYZCompliant(b.text)) {
			seen.add(i);
			bulletsToRewrite.push({ ...b, bulletIndex: i, reason: "not XYZ compliant (add action verb + metric + method)", weakness: null });
		}
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

	// ── 5. Single LLM call for ALL actionable suggestions ──
	if (bulletsToRewrite.length > 0 || datesToFix.length > 0 || needsSummary) {
		const llmResult = await getComprehensiveSuggestions(data, bulletsToRewrite, datesToFix, needsSummary, jdAnalysis);

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

				const sectionName = bullet.sectionKey === "experience" ? "Experience" :
					bullet.sectionKey === "projects" ? "Projects" : "Volunteer";

				const section = data.sections[bullet.sectionKey as keyof typeof data.sections];
				const item = section.items[bullet.itemIndex] as { company?: string; name?: string; position?: string };
				const itemLabel = item.company || item.name || item.position || "";

				const ruleId = bullet.weakness ? "IM-4" : !startsWithActionVerb(bullet.text) ? "IM-1"
					: !hasQuantifiedMetric(bullet.text) ? "IM-2" : "IM-3";
				const severity: "critical" | "warning" = bullet.weakness ? "critical" : "warning";

				suggestions.push({
					id: `IM-S-${bullet.sectionKey}-${bullet.itemIndex}-${rewrite.index}`,
					ruleId,
					category: "impactMetrics",
					severity,
					title: bullet.weakness
						? `Weak phrase: "${bullet.weakness}"`
						: !startsWithActionVerb(bullet.text)
							? "Missing action verb"
							: !hasQuantifiedMetric(bullet.text)
								? "No quantified metric"
								: "Not XYZ compliant",
					description: rewrite.reason,
					autoApplicable: true,
					patches: [{
						op: "replace",
						path: bullet.path,
						value: replaceBulletInHtml(
							(item as { description?: string }).description ?? "",
							bullet.text,
							rewrite.rewritten,
						),
					}],
					estimatedScoreGain: severity === "critical" ? 3 : 2,
					diff: {
						type: "text_replace",
						location: `${sectionName} → ${itemLabel}`,
						fieldPath: bullet.path,
						hunks: [
							{ removed: bullet.text },
							{ added: rewrite.rewritten },
						],
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
				const item = section.items[dateItem.itemIndex] as { company?: string; name?: string; position?: string; institution?: string };
				const itemLabel = item.company || item.institution || item.name || item.position || "";

				suggestions.push({
					id: `FM-S-date-${dateItem.sectionKey}-${dateItem.itemIndex}`,
					ruleId: "FM-4",
					category: "formatting",
					severity: "warning",
					title: `Fix date format: "${dateItem.period}"`,
					description: `Change to ATS-standard format: "${dateFix.corrected}"`,
					autoApplicable: true,
					patches: [{
						op: "replace",
						path: `/sections/${dateItem.sectionKey}/items/${dateItem.itemIndex}/period`,
						value: dateFix.corrected,
					}],
					estimatedScoreGain: 1,
					diff: {
						type: "field_replace",
						location: `${sectionLabel} → ${itemLabel}`,
						fieldPath: `/sections/${dateItem.sectionKey}/items/${dateItem.itemIndex}/period`,
						hunks: [
							{ removed: dateItem.period },
							{ added: dateFix.corrected },
						],
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
						hunks: [
							{ added: llmResult.summary },
						],
					},
				});
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
				hunks: [
					{ removed: `Font: ${currentFont}` },
					{ added: 'Font: Inter' },
				],
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
				hunks: [
					{ removed: `Template: ${template}` },
					{ added: 'Template: onyx' },
				],
			},
		});
	}

	// Hide profile picture
	if (!data.picture.hidden) {
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
				hunks: [
					{ removed: "Picture: visible" },
					{ added: "Picture: hidden" },
				],
			},
		});
	}

	// Remove emojis from resume fields
	const emojiFields: Array<{ path: string; value: string; cleaned: string; location: string }> = [];

	// Check basics fields
	for (const field of ["name", "headline", "email", "phone", "location"] as const) {
		const val = data.basics[field];
		if (val && findEmojis(val).length > 0) {
			emojiFields.push({ path: `/basics/${field}`, value: val, cleaned: removeEmojis(val), location: `Basics → ${field}` });
		}
	}

	// Check summary
	const summaryText = data.summary.content;
	if (summaryText && findEmojis(stripHtml(summaryText)).length > 0) {
		emojiFields.push({ path: "/summary/content", value: summaryText, cleaned: removeEmojis(summaryText), location: "Summary" });
	}

	// Check section item fields
	for (const key of ["experience", "projects", "volunteer", "education", "skills", "awards", "certifications"] as const) {
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
				hunks: [
					{ removed: ef.value },
					{ added: ef.cleaned },
				],
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
					hunks: [
						{ removed: data.basics.headline },
						{ added: jdAnalysis.jobTitle },
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

	return suggestions;
}

async function getComprehensiveSuggestions(
	data: ResumeData,
	bulletsToRewrite: Array<{ text: string; reason: string }>,
	datesToFix: Array<{ sectionKey: string; itemIndex: number; period: string }>,
	needsSummary: boolean,
	jdAnalysis: JDAnalysis | null,
): Promise<z.infer<typeof comprehensiveSchema> | null> {
	try {
		const apiKey = env.OPENAI_API_KEY;
		if (!apiKey) return null;

		const model = createOpenAI({ apiKey, baseURL: env.OPENAI_BASE_URL })
			.languageModel(SCORING_LLM_CONFIG.model);

		// Build sections of the prompt dynamically
		const promptParts: string[] = [];

		if (bulletsToRewrite.length > 0) {
			promptParts.push(`## BULLET REWRITES
Fix each bullet's specific tagged issue. Make MINIMAL edits — only fix what's tagged.
Rules:
- [weak phrase "..."]: replace only that phrase, keep everything else
- [no action verb]: replace only the first word/phrase with a past-tense action verb
- [no quantified metric]: add ONE brief metric naturally, don't restructure
- [not XYZ compliant]: restructure to: "Action-verb + result/metric + by/using/via method"
- Keep within ±5 words of original length
- Preserve all existing metrics, numbers, technologies, proper nouns exactly

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

		const result = await generateText({
			model,
			temperature: SCORING_LLM_CONFIG.temperature,
			seed: SCORING_LLM_CONFIG.seed,
			output: Output.object({ schema: comprehensiveSchema }),
			messages: [
				{
					role: "system",
					content: `You are an expert resume writer. You will receive multiple types of resume improvements to make. Return ALL fixes in a single structured response. Every bullet rewrite, every date correction, and a professional summary (if requested) — all at once.

${promptParts.join("\n\n")}`,
				},
				{
					role: "user",
					content: `Fix everything listed above. Return bulletRewrites array (with index, original, rewritten, reason), dateCorrections array (with index, original, corrected), and summary (string or null).${
						bulletsToRewrite.length === 0 ? " bulletRewrites should be an empty array." : ""
					}${
						datesToFix.length === 0 ? " dateCorrections should be an empty array." : ""
					}${
						!needsSummary ? " summary should be null." : ""
					}`,
				},
			],
		});

		return result.output;
	} catch {
		return null;
	}
}

/** Replace a specific bullet text within an HTML description, preserving HTML structure */
function replaceBulletInHtml(html: string, oldText: string, newText: string): string {
	// Try to find and replace within <li> tags
	const liRegex = new RegExp(`(<li[^>]*>)([\\s\\S]*?)(</li>)`, "gi");

	let replaced = false;
	const result = html.replace(liRegex, (match, openTag, content, closeTag) => {
		if (replaced) return match;
		const strippedContent = stripHtml(content);
		if (strippedContent === oldText || strippedContent.includes(oldText)) {
			replaced = true;
			return `${openTag}${newText}${closeTag}`;
		}
		return match;
	});

	if (replaced) return result;

	// Fallback: simple text replacement
	return html.replace(oldText, newText);
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
