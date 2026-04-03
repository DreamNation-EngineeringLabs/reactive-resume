import actionVerbs from "@/data/action-verbs.json";
import fillerData from "@/data/filler-words.json";
import type { ResumeData } from "@/schema/resume/data";
import type { CategoryScore, RuleResult } from "../index";
import { getAllBullets } from "../index";

const MAX_SCORE = 20;

const allActionVerbs = Object.values(actionVerbs)
	.flat()
	.map((v) => v.toLowerCase());

const weakPhrases = [
	"responsible for",
	"helped with",
	"helped develop",
	"assisted with",
	"assisted in",
	"worked on",
	"involved in",
	"participated in",
	"tasked with",
	"was able to",
	"successfully",
	"various",
	"multiple",
	"different",
	"several",
];

/** Patterns that indicate placeholder / extremely vague content */
const VAGUE_PATTERNS = [
	/^a\s+simple\s+/i,
	/^a\s+basic\s+/i,
	/^a\s+sample\s+/i,
	/\ba\s+simple\s+project\b/i,
	/\ba\s+sample\s+website\b/i,
	/\ba\s+basic\s+(app|application|website|project)\b/i,
	/developed\s+and\s+maintained\s+a\s+(sample|simple|basic)\s+/i,
	/worked\s+on\s+(a\s+)?(simple|sample|basic)\s+/i,
	/created\s+a\s+(simple|basic|sample)\s+/i,
];

/** Check if a bullet is too vague or placeholder-like */
function isVagueBullet(bullet: string): string | null {
	const lower = bullet.toLowerCase().trim();
	// Too short to be meaningful
	if (lower.split(/\s+/).filter(Boolean).length < 6) {
		return "too short (< 6 words)";
	}
	// Matches placeholder patterns
	for (const pattern of VAGUE_PATTERNS) {
		if (pattern.test(lower)) return "placeholder/generic content detected";
	}
	return null;
}

/** Check if a bullet starts with a strong action verb */
function startsWithActionVerb(bullet: string): boolean {
	const firstWord = bullet.trim().split(/\s+/)[0]?.toLowerCase();
	if (!firstWord) return false;
	return allActionVerbs.includes(firstWord);
}

/** Check if a bullet contains a quantified metric (number + context) */
function hasQuantifiedMetric(bullet: string): boolean {
	// Match patterns like: 25%, $1.2M, 50+, 1000 users, 3x, reduced by 20
	return /\d+[%xX]|\$[\d,.]+[KkMmBb]?|\d+\+|\d+\s*(users|customers|clients|employees|teams|projects|features|tickets|requests|servers|endpoints|transactions|orders|records|days|hours|minutes|months|years)/i.test(
		bullet,
	);
}

/** Check if a bullet follows XYZ formula: "Accomplished X, as measured by Y, by doing Z" */
function isXYZCompliant(bullet: string): boolean {
	// A bullet is XYZ-like if it has: action verb + result/metric + method/context
	const hasVerb = startsWithActionVerb(bullet);
	const hasMetric = hasQuantifiedMetric(bullet);
	// Has some indication of method (by, through, using, via, leveraging)
	const hasMethod = /\b(by|through|using|via|leveraging|with|resulting in|leading to)\b/i.test(bullet);

	return hasVerb && hasMetric && hasMethod;
}

/** Check for weak/filler phrases */
function containsWeakPhrase(bullet: string): string | null {
	const lower = bullet.toLowerCase();
	for (const phrase of weakPhrases) {
		if (lower.includes(phrase)) return phrase;
	}
	return null;
}

/**
 * Find bullets that start with the same first word (action verb or otherwise).
 * Returns a map of firstWord → count, filtered to those appearing ≥ threshold times.
 */
export function findRepetitiveOpeners(bullets: string[], threshold = 3): Map<string, number> {
	const counts = new Map<string, number>();
	for (const b of bullets) {
		const first = b.trim().split(/\s+/)[0]?.toLowerCase();
		if (!first || first.length < 3) continue;
		counts.set(first, (counts.get(first) ?? 0) + 1);
	}
	const repeated = new Map<string, number>();
	for (const [word, count] of counts) {
		if (count >= threshold) repeated.set(word, count);
	}
	return repeated;
}

/**
 * Compute Jaccard similarity between two strings (bag of words).
 * Returns a value 0–1 where 1 = identical word sets.
 */
function jaccardSimilarity(a: string, b: string): number {
	const setA = new Set(a.toLowerCase().split(/\s+/).filter((w) => w.length > 2));
	const setB = new Set(b.toLowerCase().split(/\s+/).filter((w) => w.length > 2));
	if (setA.size === 0 || setB.size === 0) return 0;
	let intersection = 0;
	for (const w of setA) {
		if (setB.has(w)) intersection++;
	}
	return intersection / (setA.size + setB.size - intersection);
}

/**
 * Find pairs of bullets with Jaccard similarity above the given threshold.
 * Returns the indices of the near-duplicate pairs.
 */
export function findNearDuplicateBullets(bullets: string[], threshold = 0.65): Array<[number, number]> {
	const pairs: Array<[number, number]> = [];
	for (let i = 0; i < bullets.length; i++) {
		for (let j = i + 1; j < bullets.length; j++) {
			if (jaccardSimilarity(bullets[i], bullets[j]) >= threshold) {
				pairs.push([i, j]);
			}
		}
	}
	return pairs;
}

/** Check for filler words */
function countFillerWords(bullet: string): number {
	const lower = bullet.toLowerCase();
	let count = 0;

	for (const word of fillerData.words) {
		const regex = new RegExp(`\\b${word}\\b`, "gi");
		const matches = lower.match(regex);
		if (matches) count += matches.length;
	}

	for (const phrase of fillerData.phrases) {
		if (lower.includes(phrase)) count++;
	}

	return count;
}

/**
 * Return the distinct filler words/phrases found in the given text.
 * Deduplicates — each term appears at most once regardless of how many times it occurs.
 */
export function getFillerWords(text: string): string[] {
	const lower = text.toLowerCase();
	const found: string[] = [];

	for (const word of fillerData.words) {
		const regex = new RegExp(`\\b${word}\\b`, "gi");
		if (regex.test(lower)) found.push(word);
	}

	for (const phrase of fillerData.phrases) {
		if (lower.includes(phrase)) found.push(phrase);
	}

	return [...new Set(found)];
}

const MIN_EXPECTED_BULLETS = 6;

/**
 * Single graduated quality cap based on bullet count.
 * Replaces the previous dual-penalty (thinBulletCap × contentPenalty) which double-penalized
 * resumes with < 5 bullets. Now uses one transparent cap:
 *
 * 0 bullets → 0/20  |  1 → 2/20  |  2 → 5/20  |  3 → 9/20  |  4 → 13/20  |  5 → 17/20  |  6+ → 20/20
 */
function getBulletCountCap(count: number): number {
	if (count === 0) return 0;
	if (count === 1) return 0.1;
	if (count === 2) return 0.25;
	if (count === 3) return 0.45;
	if (count === 4) return 0.65;
	if (count === 5) return 0.85;
	return 1.0;
}

export async function scoreImpactMetrics(data: ResumeData): Promise<CategoryScore> {
	const details: RuleResult[] = [];
	const bullets = getAllBullets(data);

	if (bullets.length === 0) {
		details.push({
			ruleId: "IM-0",
			ruleName: "Minimum content",
			score: 0,
			maxScore: MAX_SCORE,
			details: "No experience bullets found. Add detailed bullet points describing your accomplishments.",
		});
		return { score: 0, max: MAX_SCORE, details };
	}

	const bulletCap = getBulletCountCap(bullets.length);
	const maxScoreForBullets = Math.round(MAX_SCORE * bulletCap);

	// IM-1: Action verb usage (5 pts)
	const bulletsWithVerbs = bullets.filter((b) => startsWithActionVerb(b.text));
	const verbRatio = bulletsWithVerbs.length / bullets.length;
	const im1Score = Math.round(verbRatio * 5);

	const capNote =
		bulletCap < 1
			? `Only ${bullets.length} bullet${bullets.length !== 1 ? "s" : ""} found — max Impact score is ${maxScoreForBullets}/${MAX_SCORE} until you reach ${MIN_EXPECTED_BULLETS}+ bullets. `
			: "";

	details.push({
		ruleId: "IM-1",
		ruleName: "Action verb usage",
		score: im1Score,
		maxScore: 5,
		details: `${capNote}${bulletsWithVerbs.length}/${bullets.length} bullets start with action verbs (${Math.round(verbRatio * 100)}%).`,
	});

	// IM-2: Quantified metrics (5 pts)
	const bulletsWithMetrics = bullets.filter((b) => hasQuantifiedMetric(b.text));
	const metricRatio = bulletsWithMetrics.length / bullets.length;
	const im2Score = Math.round(metricRatio * 5);

	details.push({
		ruleId: "IM-2",
		ruleName: "Quantified metrics",
		score: im2Score,
		maxScore: 5,
		details: `${bulletsWithMetrics.length}/${bullets.length} bullets contain quantified metrics (${Math.round(metricRatio * 100)}%).`,
	});

	// IM-3: XYZ formula compliance (3 pts — reallocated 2pts to IM-6 Content Variety)
	const xyzBullets = bullets.filter((b) => isXYZCompliant(b.text));
	const xyzRatio = xyzBullets.length / bullets.length;
	const im3Score = Math.round(xyzRatio * 3);

	details.push({
		ruleId: "IM-3",
		ruleName: "XYZ formula compliance",
		score: im3Score,
		maxScore: 3,
		details: `${xyzBullets.length}/${bullets.length} bullets follow the XYZ formula (action verb + metric + method) (${Math.round(xyzRatio * 100)}%).`,
	});

	// IM-4: No weak phrases (3 pts) — deduct per weak phrase found
	const bulletsWithWeakPhrases = bullets.filter((b) => containsWeakPhrase(b.text) !== null);
	const weakRatio = 1 - bulletsWithWeakPhrases.length / bullets.length;
	const im4Score = Math.round(weakRatio * 3);

	details.push({
		ruleId: "IM-4",
		ruleName: "No weak phrases",
		score: im4Score,
		maxScore: 3,
		details:
			bulletsWithWeakPhrases.length > 0
				? `${bulletsWithWeakPhrases.length} bullet(s) use weak phrases like "responsible for", "worked on", or "assisted with". Replace with strong action verbs that own the impact.`
				: "No weak phrases found. Strong ownership language used throughout.",
	});

	// IM-5: No vague / placeholder content (2 pts)
	const vagueBullets = bullets
		.map((b) => ({ bullet: b, reason: isVagueBullet(b.text) }))
		.filter((x) => x.reason !== null);
	const vagueRatio = 1 - vagueBullets.length / bullets.length;
	const im5Score = Math.round(vagueRatio * 2);

	const vagueExamples = vagueBullets
		.slice(0, 2)
		.map((v) => `"${v.bullet.text.slice(0, 60)}${v.bullet.text.length > 60 ? "…" : ""}" (${v.reason})`)
		.join("; ");

	details.push({
		ruleId: "IM-5",
		ruleName: "No vague or placeholder content",
		score: im5Score,
		maxScore: 2,
		details:
			vagueBullets.length > 0
				? `${vagueBullets.length} bullet(s) are too vague or generic: ${vagueExamples}. Be specific — name the technology, the scale, the outcome, and your exact role.`
				: "All bullets have specific, concrete content.",
	});

	// IM-6: Content variety (2 pts)
	// Checks for (a) repetitive openers — same first word ≥3 bullets — and (b) near-duplicate bullets (Jaccard ≥0.65)
	const bulletTexts = bullets.map((b) => b.text);
	const repeatedOpeners = findRepetitiveOpeners(bulletTexts, 3);
	const duplicatePairs = findNearDuplicateBullets(bulletTexts, 0.65);

	const openerPenalty = repeatedOpeners.size > 0 ? 1 : 0;
	const duplicatePenalty = duplicatePairs.length > 0 ? 1 : 0;
	const im6Score = Math.max(0, 2 - openerPenalty - duplicatePenalty);

	const im6Issues: string[] = [];
	if (repeatedOpeners.size > 0) {
		const examples = [...repeatedOpeners.entries()]
			.map(([word, count]) => `"${word}" (${count}×)`)
			.join(", ");
		im6Issues.push(`Repetitive openers: ${examples} — vary your starting verb to show breadth`);
	}
	if (duplicatePairs.length > 0) {
		im6Issues.push(
			`${duplicatePairs.length} near-duplicate bullet${duplicatePairs.length > 1 ? "s" : ""} detected — each bullet should describe a distinct accomplishment`,
		);
	}

	details.push({
		ruleId: "IM-6",
		ruleName: "Content variety",
		score: im6Score,
		maxScore: 2,
		details:
			im6Issues.length > 0
				? im6Issues.join(". ")
				: "Good variety — no repetitive openers or near-duplicate bullets found.",
	});

	const totalScore = Math.round(Math.min(maxScoreForBullets, im1Score + im2Score + im3Score + im4Score + im5Score + im6Score));
	return { score: totalScore, max: MAX_SCORE, details };
}

// Export helpers for suggestion generator
export { startsWithActionVerb, hasQuantifiedMetric, isXYZCompliant, containsWeakPhrase, countFillerWords };
