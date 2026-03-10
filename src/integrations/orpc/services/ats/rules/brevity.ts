import type { ResumeData } from "@/schema/resume/data";
import type { CategoryScore, RuleResult } from "../index";
import { getAllBullets, estimatePageCount, stripHtml } from "../index";
import { countFillerWords } from "./impact-metrics";

const MAX_SCORE = 10;

const MIN_BULLETS_PER_ROLE = 2;
const MAX_BULLETS_PER_ROLE = 6;
const MAX_WORDS_PER_BULLET = 30;
const MAX_PAGES = 2;

export async function scoreBrevity(data: ResumeData): Promise<CategoryScore> {
	const details: RuleResult[] = [];
	const bullets = getAllBullets(data);

	// BR-1: Bullet word count (3 pts)
	const longBullets = bullets.filter((b) => b.text.split(/\s+/).length > MAX_WORDS_PER_BULLET);
	const br1Score = bullets.length === 0 ? 3 :
		Math.round((1 - longBullets.length / bullets.length) * 3);

	details.push({
		ruleId: "BR-1",
		ruleName: "Bullet word count",
		score: br1Score,
		maxScore: 3,
		details: longBullets.length > 0
			? `${longBullets.length} bullet(s) exceed ${MAX_WORDS_PER_BULLET} words. Aim for concise bullets.`
			: `All bullets are within ${MAX_WORDS_PER_BULLET} words.`,
	});

	// BR-2: Bullets per role (3 pts)
	const expSection = data.sections.experience;
	let roleViolations = 0;
	let totalRoles = 0;

	if (!expSection.hidden) {
		for (const item of expSection.items) {
			if (item.hidden) continue;
			totalRoles++;
			const desc = "description" in item ? (item as { description: string }).description : "";
			const roleBullets = (desc.match(/<li[^>]*>/gi) || []).length;
			if (roleBullets > 0 && (roleBullets < MIN_BULLETS_PER_ROLE || roleBullets > MAX_BULLETS_PER_ROLE)) {
				roleViolations++;
			}
		}
	}

	const br2Score = totalRoles === 0 ? 3 :
		Math.round((1 - roleViolations / totalRoles) * 3);

	details.push({
		ruleId: "BR-2",
		ruleName: "Bullets per role",
		score: br2Score,
		maxScore: 3,
		details: roleViolations > 0
			? `${roleViolations} role(s) have fewer than ${MIN_BULLETS_PER_ROLE} or more than ${MAX_BULLETS_PER_ROLE} bullets.`
			: `All roles have ${MIN_BULLETS_PER_ROLE}-${MAX_BULLETS_PER_ROLE} bullets.`,
	});

	// BR-3: Page count (2 pts)
	const pages = estimatePageCount(data);
	const br3Score = pages <= MAX_PAGES ? 2 : 0;

	details.push({
		ruleId: "BR-3",
		ruleName: "Page count",
		score: br3Score,
		maxScore: 2,
		details: pages <= MAX_PAGES
			? `Estimated ${pages} page(s) — within ${MAX_PAGES}-page limit.`
			: `Estimated ${pages} pages — exceeds recommended ${MAX_PAGES}-page limit.`,
	});

	// BR-4: Filler words (2 pts)
	const totalFillers = bullets.reduce((sum, b) => sum + countFillerWords(b.text), 0);
	const summaryFillers = countFillerWords(stripHtml(data.summary.content));
	const allFillers = totalFillers + summaryFillers;
	const br4Score = allFillers === 0 ? 2 : allFillers <= 3 ? 1 : 0;

	details.push({
		ruleId: "BR-4",
		ruleName: "Filler words",
		score: br4Score,
		maxScore: 2,
		details: allFillers > 0
			? `${allFillers} filler word(s)/phrase(s) detected. Remove unnecessary words.`
			: "No filler words or phrases detected.",
	});

	const totalScore = Math.min(MAX_SCORE, br1Score + br2Score + br3Score + br4Score);
	return { score: totalScore, max: MAX_SCORE, details };
}
