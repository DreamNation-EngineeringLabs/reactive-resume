import { createOpenAI } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import z from "zod";
import type { ResumeData } from "@/schema/resume/data";
import type { Suggestion, JDAnalysis } from "./index";
import { getAllBullets, stripHtml, estimatePageCount, SCORING_LLM_CONFIG } from "./index";
import { startsWithActionVerb, hasQuantifiedMetric, containsWeakPhrase, isXYZCompliant } from "./rules/impact-metrics";
import { isStandardDateFormat, findEmojis, ATS_SAFE_FONTS, ATS_SAFE_TEMPLATES } from "./rules/formatting";
import { countResumeWords, RECOMMENDED_WORD_RANGE, RECOMMENDED_BULLET_RANGE } from "./rules/brevity";
import { isReverseChronological, extractLatestYear } from "./rules/structure";
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
	brevityEdits: z.array(z.object({
		index: z.number(),
		action: z.enum(["shorten", "hide"]),
		rewritten: z.string().nullable(),
		reason: z.string(),
	})),
	summary: z.string().nullable(),
	tailoredSummary: z.string().nullable(),
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

	// ── 2. Collect ALL problematic bullets — merge ALL issues per bullet into one entry ──
	const bulletsToRewrite: Array<{
		text: string; sectionKey: string; itemIndex: number; path: string;
		bulletIndex: number; reason: string; reasons: string[]; weakness: string | null;
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
		text: string; sectionKey: string; itemIndex: number; path: string;
		bulletIndex: number; wordCount: number;
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
		const mentionsRole = summaryText.includes(jdTitle) ||
			jdTitle.split(" ").filter((w) => w.length > 3).every((w) => summaryText.includes(w));
		const jdKeyTerms = [...jdAnalysis.hardSkills, ...jdAnalysis.tools].map((s) => s.toLowerCase());
		const matched = jdKeyTerms.filter((term) => summaryText.includes(term));
		const matchRatio = jdKeyTerms.length > 0 ? matched.length / jdKeyTerms.length : 1;
		return !mentionsRole || matchRatio < 0.3;
	})();

	// ── 5. Single LLM call for ALL actionable suggestions ──
	if (bulletsToRewrite.length > 0 || datesToFix.length > 0 || needsSummary || needsTailoredSummary || brevityCandidates.length > 0) {
		const llmResult = await getComprehensiveSuggestions(data, bulletsToRewrite, datesToFix, needsSummary, jdAnalysis, brevityCandidates, { wordCount, totalBulletCount, pages, tooManyWords }, needsTailoredSummary);

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

				// Pick the most severe rule for categorization
				const severity: "critical" | "warning" = bullet.weakness ? "critical" : "warning";
				const ruleId = bullet.reasons.length > 1 ? "IM-ALL" : bullet.weakness ? "IM-4" 
					: !startsWithActionVerb(bullet.text) ? "IM-1"
					: !hasQuantifiedMetric(bullet.text) ? "IM-2" : "IM-3";

				// Build a combined title showing all issues
				const issueLabels: string[] = [];
				if (bullet.weakness) issueLabels.push(`weak phrase`);
				if (!startsWithActionVerb(bullet.text)) issueLabels.push("no action verb");
				if (!hasQuantifiedMetric(bullet.text)) issueLabels.push("no metric");
				if (!isXYZCompliant(bullet.text)) issueLabels.push("not XYZ");
				const title = `Rewrite bullet: ${issueLabels.join(", ")}`;

				suggestions.push({
					id: `IM-S-${bullet.sectionKey}-${bullet.itemIndex}-${rewrite.index}`,
					ruleId,
					category: "impactMetrics",
					severity,
					title,
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
					estimatedScoreGain: Math.min(5, bullet.reasons.length * 2),
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

			// Process tailored summary (rewrite existing summary to match JD)
			if (llmResult.tailoredSummary && needsTailoredSummary) {
				const currentSummary = stripHtml(data.summary.content);
				suggestions.push({
					id: "TR-S2-summary",
					ruleId: "TR-2",
					category: "tailoring",
					severity: "warning",
					title: "Tailor summary to job description",
					description: `Your summary doesn't mention the target role "${jdAnalysis!.jobTitle}" or key JD skills. Here's a tailored version based on your experience.`,
					autoApplicable: true,
					patches: [{ op: "replace", path: "/summary/content", value: `<p>${llmResult.tailoredSummary}</p>` }],
					estimatedScoreGain: 3,
					diff: {
						type: "text_replace",
						location: "Summary",
						fieldPath: "/summary/content",
						hunks: [
							{ removed: currentSummary },
							{ added: llmResult.tailoredSummary },
						],
					},
				});
			}

			// Process brevity edits (shorten or hide bullets)
			for (const edit of llmResult.brevityEdits) {
				const candidate = brevityCandidates[edit.index];
				if (!candidate) continue;

				// Only allow "shorten" when words are over limit, not just for excess bullets
				if (edit.action === "shorten" && !tooManyWords) continue;

				const sectionName = candidate.sectionKey === "experience" ? "Experience" :
					candidate.sectionKey === "projects" ? "Projects" : "Volunteer";
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
						patches: [{
							op: "replace",
							path: candidate.path,
							value: removeBulletFromHtml(
								(item as { description?: string }).description ?? "",
								candidate.text,
							),
						}],
						estimatedScoreGain: 1,
						diff: {
							type: "text_replace",
							location: `${sectionName} → ${itemLabel}`,
							fieldPath: candidate.path,
							hunks: [
								{ removed: candidate.text },
							],
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
						patches: [{
							op: "replace",
							path: candidate.path,
							value: replaceBulletInHtml(
								(item as { description?: string }).description ?? "",
								candidate.text,
								edit.rewritten,
							),
						}],
						estimatedScoreGain: 1,
						diff: {
							type: "text_replace",
							location: `${sectionName} → ${itemLabel}`,
							fieldPath: candidate.path,
							hunks: [
								{ removed: candidate.text },
								{ added: edit.rewritten },
							],
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

	// ── Tailoring: Education match (TR-4) ──
	if (jdAnalysis && jdAnalysis.educationRequirements.length > 0) {
		const eduItems = data.sections.education.items.filter((item) => !item.hidden);
		const allEduText = eduItems
			.map((item) => `${item.degree} ${item.area} ${item.school}`.toLowerCase())
			.join(" ");

		const unmatchedReqs = jdAnalysis.educationRequirements.filter(
			(req) => !allEduText.includes(req.toLowerCase()),
		);

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
		const visibleEdu = eduSection.items
			.map((item, idx) => ({ ...item, idx }))
			.filter((item) => !item.hidden);

		const highSchoolPatterns = /\b(class\s*(?:10|ten|x|xth|10th)|class\s*(?:12|twelve|xii|xiith|12th)|ssc|hsc|sslc|cbse|icse|isc|(?:10th|12th)\s*(?:grade|standard|std)|secondary|sr\.?\s*secondary|sr\.?\s*sec|higher\s*secondary|high\s*school|intermediate|matriculat|(?:std|standard)\s*(?:10|12|x|xii))\b/i;

		const hasHigherDegree = visibleEdu.some((item) => {
			const combined = `${item.degree} ${item.area} ${item.school}`.toLowerCase();
			return /\b(b\.?tech|b\.?e|b\.?sc|b\.?a|b\.?com|bca|bba|m\.?tech|m\.?e|m\.?sc|m\.?a|mca|mba|m\.?com|ph\.?d|bachelor|master|doctor|diploma|associate|undergraduate|graduate|postgraduate|engineering|university|college)\b/i.test(combined);
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
							hunks: [
								{ removed: `${item.degree}${item.area ? ` — ${item.area}` : ""} at ${item.school}` },
							],
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
			.map((item, idx) => ({ item, idx, year: extractLatestYear((item as { period?: string }).period || (item as { date?: string }).date) }))
			.sort((a, b) => {
				// Hidden items go to the end
				if (a.item.hidden && !b.item.hidden) return 1;
				if (!a.item.hidden && b.item.hidden) return -1;
				if (a.item.hidden && b.item.hidden) return 0;
				return b.year - a.year;
			})
			.map(({ item }) => item);

		const currentOrder = visibleWithIdx.map((v) => {
			const name = (v.item as Record<string, unknown>).company
				|| (v.item as Record<string, unknown>).school
				|| (v.item as Record<string, unknown>).name
				|| (v.item as Record<string, unknown>).title
				|| (v.item as Record<string, unknown>).organization
				|| `Item ${v.idx + 1}`;
			const dateStr = v.item.period || v.item.date || "";
			return `${name} (${dateStr})`;
		}).join(" → ");

		const correctOrder = sorted.map((v) => {
			const name = (v.item as Record<string, unknown>).company
				|| (v.item as Record<string, unknown>).school
				|| (v.item as Record<string, unknown>).name
				|| (v.item as Record<string, unknown>).title
				|| (v.item as Record<string, unknown>).organization
				|| `Item ${v.idx + 1}`;
			const dateStr = v.item.period || v.item.date || "";
			return `${name} (${dateStr})`;
		}).join(" → ");

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
				hunks: [
					{ removed: currentOrder },
					{ added: correctOrder },
				],
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
		const avgWords = visibleItems.reduce((sum, item) => {
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
	brevityCandidates: Array<{ text: string; wordCount: number; sectionKey: string }>,
	brevityStats: { wordCount: number; totalBulletCount: number; pages: number; tooManyWords: boolean },
	needsTailoredSummary: boolean,
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
- Each bullet may have MULTIPLE tagged issues (e.g. [no action verb + no quantified metric + not XYZ compliant])
- Fix ALL tagged issues in a single rewrite — the output must be the FINAL improved version
- Start with a strong past-tense action verb
- Add quantified metrics where tagged (numbers, percentages, dollar amounts)
- Follow XYZ formula: "Action-verb + result/metric + by/using/via method"
- If a weak phrase is tagged, replace it entirely
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

			promptParts.push(`## TAILORED SUMMARY
The current summary is NOT tailored to the target job. Rewrite it (plain text, no HTML) to specifically target this role.

Current summary: "${currentSummary}"
Target role: ${jdAnalysis.jobTitle}
Required hard skills: ${jdAnalysis.hardSkills.join(", ") || "none"}
Required tools: ${jdAnalysis.tools.join(", ") || "none"}
Resume skills: ${skills.join(", ") || "not listed"}
Recent experience: ${experiences.join("; ") || "not listed"}
Key projects: ${projects.join("; ") || "not listed"}

Rules:
- Keep it 2-3 sentences, concise
- Mention the target role title ("${jdAnalysis.jobTitle}")
- Incorporate JD hard skills and tools that are ACTUALLY in the resume (don't fabricate)
- Reference real experience and projects from the resume
- Return the tailored summary in the "tailoredSummary" field`);
		}

		if (brevityCandidates.length > 0) {
			const excessWords = brevityStats.wordCount > RECOMMENDED_WORD_RANGE.max
				? brevityStats.wordCount - RECOMMENDED_WORD_RANGE.max : 0;
			const excessBullets = brevityStats.totalBulletCount > RECOMMENDED_BULLET_RANGE.max
				? brevityStats.totalBulletCount - RECOMMENDED_BULLET_RANGE.max : 0;

			const allowedActions = brevityStats.tooManyWords
				? '"shorten" or "hide"'
				: '"hide" only (do NOT use "shorten")';

			promptParts.push(`## BREVITY EDITS
The resume needs trimming. Current stats:
- ${brevityStats.wordCount} words (recommended: ${RECOMMENDED_WORD_RANGE.min}-${RECOMMENDED_WORD_RANGE.max})${excessWords > 0 ? ` — ${excessWords} words over limit` : " — OK"}
- ${brevityStats.totalBulletCount} bullet points (recommended: ${RECOMMENDED_BULLET_RANGE.min}-${RECOMMENDED_BULLET_RANGE.max})${excessBullets > 0 ? ` — ${excessBullets} bullets over limit` : " — OK"}
- ${brevityStats.pages} page(s) (recommended: 1)

Allowed actions: ${allowedActions}

For each bullet below, decide:
${brevityStats.tooManyWords ? '- "shorten": Rewrite it more concisely (reduce word count by 30-50%) while keeping the key achievement/impact. Provide the shortened version in "rewritten".' : ''}
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
					content: `Fix everything listed above. Return bulletRewrites array (with index, original, rewritten, reason), dateCorrections array (with index, original, corrected), brevityEdits array (with index, action, rewritten, reason), summary (string or null), and tailoredSummary (string or null).${
						bulletsToRewrite.length === 0 ? " bulletRewrites should be an empty array." : ""
					}${
						datesToFix.length === 0 ? " dateCorrections should be an empty array." : ""
					}${
						brevityCandidates.length === 0 ? " brevityEdits should be an empty array." : ""
					}${
						!needsSummary ? " summary should be null." : ""
					}${
						!needsTailoredSummary ? " tailoredSummary should be null." : ""
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

/** Remove a specific bullet from an HTML description by matching its text */
function removeBulletFromHtml(html: string, bulletText: string): string {
	const liRegex = new RegExp(`<li[^>]*>[\\s\\S]*?</li>`, "gi");

	return html.replace(liRegex, (match) => {
		const stripped = stripHtml(match);
		if (stripped === bulletText || stripped.includes(bulletText)) {
			return ""; // Remove the entire <li> element
		}
		return match;
	});
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
