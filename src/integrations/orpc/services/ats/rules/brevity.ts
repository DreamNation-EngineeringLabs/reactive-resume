import type { ResumeData } from "@/schema/resume/data";
import type { CategoryScore, RuleResult } from "../index";
import { estimatePageCount, getAllBullets, stripHtml } from "../index";
import { countFillerWords } from "./impact-metrics";

const MAX_SCORE = 10;

const MIN_BULLETS_PER_ROLE = 3;
const MAX_BULLETS_PER_ROLE = 6;
const MAX_WORDS_PER_BULLET = 30;
const MAX_PAGES = 1;
const RECOMMENDED_WORD_RANGE = { min: 400, max: 675 } as const;
const RECOMMENDED_BULLET_RANGE = { min: 12, max: 20 } as const;

/** Count total words in the visible resume text */
function countResumeWords(data: ResumeData): number {
	let text = "";
	text += stripHtml(data.summary.content) + " ";
	text += data.basics.name + " " + data.basics.headline + " ";

	const sectionKeys = Object.keys(data.sections) as (keyof typeof data.sections)[];
	for (const key of sectionKeys) {
		const section = data.sections[key];
		if (section.hidden) continue;
		for (const item of section.items) {
			if (item.hidden) continue;
			for (const [, val] of Object.entries(item)) {
				if (typeof val === "string") text += stripHtml(val) + " ";
				if (Array.isArray(val)) text += val.filter((v) => typeof v === "string").join(" ") + " ";
			}
		}
	}

	return text.split(/\s+/).filter(Boolean).length;
}

export { countResumeWords, RECOMMENDED_WORD_RANGE, RECOMMENDED_BULLET_RANGE };

export async function scoreBrevity(data: ResumeData): Promise<CategoryScore> {
	const details: RuleResult[] = [];
	const bullets = getAllBullets(data);
	const wordCount = countResumeWords(data);

	// GUARD: Resume is too thin to evaluate brevity
	if (wordCount < 100 || bullets.length === 0) {
		return {
			score: 0,
			max: MAX_SCORE,
			details: [
				{
					ruleId: "BR-0",
					ruleName: "Minimum content",
					score: 0,
					maxScore: MAX_SCORE,
					details: "Resume is too thin to evaluate brevity. Add at least 100 words and several experience bullets.",
				},
			],
		};
	}

	// BR-1: Bullet word count (2 pts)
	const longBullets = bullets.filter((b) => b.text.split(/\s+/).length > MAX_WORDS_PER_BULLET);
	const br1Score = Math.round((1 - longBullets.length / bullets.length) * 2);

	details.push({
		ruleId: "BR-1",
		ruleName: "Bullet word count",
		score: br1Score,
		maxScore: 2,
		details:
			longBullets.length > 0
				? `${longBullets.length} bullet(s) exceed ${MAX_WORDS_PER_BULLET} words. Aim for concise bullets.`
				: `All bullets are within ${MAX_WORDS_PER_BULLET} words.`,
	});

	// BR-2: Bullets per role (2 pts)
	const expSection = data.sections.experience;
	let roleViolations = 0;
	let totalRoles = 0;

	if (!expSection.hidden) {
		for (const item of expSection.items) {
			if (item.hidden) continue;
			totalRoles++;
			const desc = "description" in item ? (item as { description: string }).description : "";
			const roleBullets = (desc.match(/<li[^>]*>/gi) || []).length;
			if (roleBullets < MIN_BULLETS_PER_ROLE || roleBullets > MAX_BULLETS_PER_ROLE) {
				roleViolations++;
			}
		}
	}

	const br2Score = totalRoles === 0 ? 0 : Math.round((1 - roleViolations / totalRoles) * 2);

	details.push({
		ruleId: "BR-2",
		ruleName: "Bullets per role",
		score: br2Score,
		maxScore: 2,
		details:
			totalRoles === 0
				? "No experience entries found."
				: roleViolations > 0
					? `${roleViolations}/${totalRoles} role(s) have suboptimal bullet counts. Aim for ${MIN_BULLETS_PER_ROLE}-${MAX_BULLETS_PER_ROLE} bullets per role.`
					: "All experience entries have optimal bullet counts.",
	});

	// BR-3: Page count (2 pts)
	const pages = estimatePageCount(data);
	const br3Score = pages <= MAX_PAGES ? 2 : pages <= 2 ? 1 : 0;

	details.push({
		ruleId: "BR-3",
		ruleName: "Page count",
		score: br3Score,
		maxScore: 2,
		details:
			pages <= MAX_PAGES
				? `Estimated ${pages} page(s) — ideal length.`
				: `Estimated ${pages} pages — try to keep it under 2 pages for ATS readability.`,
	});

	// BR-4: Filler words (1 pt)
	const totalFillers = bullets.reduce((sum, b) => sum + countFillerWords(b.text), 0);
	const summaryFillers = countFillerWords(stripHtml(data.summary.content));
	const allFillers = totalFillers + summaryFillers;
	const br4Score = allFillers === 0 ? 1 : 0;

	details.push({
		ruleId: "BR-4",
		ruleName: "No filler words",
		score: br4Score,
		maxScore: 1,
		details:
			allFillers > 0
				? `Detected ${allFillers} filler words/phrases. Be more direct.`
				: "No unnecessary filler language detected.",
	});

	// BR-5: Word count (2 pts)
	const inRange = wordCount >= RECOMMENDED_WORD_RANGE.min && wordCount <= RECOMMENDED_WORD_RANGE.max;
	const br5Score = inRange ? 2 : wordCount < RECOMMENDED_WORD_RANGE.min ? 1 : 0;

	details.push({
		ruleId: "BR-5",
		ruleName: "Word count",
		score: br5Score,
		maxScore: 2,
		details:
			wordCount < RECOMMENDED_WORD_RANGE.min
				? `Low word count (${wordCount}). Target ${RECOMMENDED_WORD_RANGE.min}-${RECOMMENDED_WORD_RANGE.max} words.`
				: inRange
					? `Great word count (${wordCount}).`
					: `Too wordy (${wordCount}). Target under ${RECOMMENDED_WORD_RANGE.max} words.`,
	});

	// BR-6: Total bullet count (1 pt)
	const totalBulletCount = bullets.length;
	const bulletsInRange =
		totalBulletCount >= RECOMMENDED_BULLET_RANGE.min && totalBulletCount <= RECOMMENDED_BULLET_RANGE.max;
	const br6Score = bulletsInRange ? 1 : 0;

	details.push({
		ruleId: "BR-6",
		ruleName: "Bullet point density",
		score: br6Score,
		maxScore: 1,
		details:
			totalBulletCount < RECOMMENDED_BULLET_RANGE.min
				? `Too few bullets (${totalBulletCount}). Aim for ${RECOMMENDED_BULLET_RANGE.min}-${RECOMMENDED_BULLET_RANGE.max}.`
				: bulletsInRange
					? `Good bullet density (${totalBulletCount} bullets).`
					: `Too many bullets (${totalBulletCount}). Keep it under ${RECOMMENDED_BULLET_RANGE.max}.`,
	});

	const totalScore = Math.min(MAX_SCORE, br1Score + br2Score + br3Score + br4Score + br5Score + br6Score);
	return { score: totalScore, max: MAX_SCORE, details };
}
