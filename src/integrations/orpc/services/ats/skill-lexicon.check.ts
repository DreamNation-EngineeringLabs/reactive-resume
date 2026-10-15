// Run: pnpm exec tsx --test src/integrations/orpc/services/ats/skill-lexicon.check.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import type { ResumeData } from "@/schema/resume/data";
import { sampleResumeData } from "@/schema/resume/sample";
import { isListedSkill, keysIn, skillKey } from "./branches";
import {
	buildCorpus,
	classifySkills,
	extraSkills,
	isSkillLike,
	learnedTerms,
	MAX_AI_SKILLS,
	MAX_VERDICTS,
} from "./skill-lexicon";

const resumeOf = (userId: string, area: string, skills: string[]) => {
	const data = structuredClone(sampleResumeData) as ResumeData;
	data.sections.education.items = [{ ...data.sections.education.items[0], degree: "B.Tech", area }];
	data.sections.skills.items = skills.map((name) => ({ ...data.sections.skills.items[0], name, keywords: [] }));
	return { userId, data };
};
/** Stand-in for the static lists: only "autocad" is "already known". */
const isStatic = (t: string) => /autocad/i.test(t);
const noAi = async () => [] as string[];

// Three other Civil students list Revit and STAAD Pro; one lists ETABS; all three list "hardworking".
const civilPeers = ["p1", "p2", "p3"].map((id, i) =>
	resumeOf(id, "Civil Engineering", [
		"Revit",
		i === 0 ? "STAAD.Pro" : "STAAD Pro",
		"AutoCAD",
		"Hardworking",
		...(i === 0 ? ["ETABS"] : []),
	]),
);
const mech = ["m1", "m2", "m3"].map((id) => resumeOf(id, "Mechanical Engineering", ["SolidWorks", "Ansys"]));
const corpus = buildCorpus([...civilPeers, ...mech]);

test("skillKey: spelling variants of one tool collapse to one key", () => {
	assert.equal(skillKey("STAAD.Pro"), skillKey("STAAD Pro"));
	assert.equal(skillKey("staad-pro"), "staadpro");
	assert.equal(skillKey("C++"), "c++");
	assert.equal(skillKey("Node.js"), "nodejs");
});

test("isSkillLike rejects soft skills, headings, languages, urls and gibberish shapes", () => {
	for (const t of [
		"Hardworking",
		"Good Communication",
		"Team leadership",
		"Technical Skills",
		"Programming Languages",
		"English",
		"ab",
		"",
		"x@y.com",
		"12345",
		"a very long phrase with too many words here",
	])
		assert.equal(isSkillLike(t), false, t);
	for (const t of ["Revit", "STAAD.Pro", "Primavera P6", "Finite Element Analysis", "Cadence"])
		assert.equal(isSkillLike(t), true, t);
});

test("keysIn finds terms of one to four words, however they are punctuated", () => {
	const keys = keysIn("Modelled in Revit/ETABS and checked in STAAD Pro. Scheduled with Primavera P6, MS Project.");
	for (const k of ["revit", "etabs", "staadpro", "primaverap6", "msproject"]) assert.ok(keys.has(k), k);
	assert.equal(keys.has("revi"), false);
});

test("a term is learned for a branch once 3 OTHER students of that branch list it", () => {
	const learned = learnedTerms(corpus, "civil", "someone-else", isStatic);
	assert.deepEqual(learned.map((l) => l.key).sort(), ["revit", "staadpro"]); // not ETABS (1), AutoCAD (static), Hardworking (soft)
	assert.equal(learned.find((l) => l.key === "revit")?.students, 3);
	// the scored student does not confirm their own claim: with p1 excluded only 2 others remain
	assert.deepEqual(learnedTerms(corpus, "civil", "p1", isStatic), []);
	// other branches are separate
	assert.deepEqual(
		learnedTerms(corpus, "mechanical", "someone-else", isStatic)
			.map((l) => l.key)
			.sort(),
		["ansys", "solidworks"],
	);
	assert.deepEqual(learnedTerms(corpus, "general", "someone-else", isStatic), []);
});

test("the app's own sample skills are not learned from", () => {
	const sampled = ["s1", "s2", "s3", "s4"].map((id) => {
		const data = structuredClone(sampleResumeData) as ResumeData;
		data.sections.education.items = [
			{ ...data.sections.education.items[0], area: "Computer Science", degree: "B.Tech" },
		];
		return { userId: id, data };
	});
	assert.deepEqual(
		learnedTerms(buildCorpus(sampled), "software", "x", () => false),
		[],
	);
});

test("extraSkills: learned terms found in the text count; learned terms missing from it become peer suggestions", async () => {
	const me = resumeOf("me", "Civil Engineering", ["Revit", "Site supervision"]);
	const text = "Revit, Site supervision. Modelled a frame in Revit.";
	const { extra, peers } = await extraSkills({
		corpus,
		branch: "civil",
		userId: "me",
		data: me.data,
		text,
		isStatic,
		ask: noAi,
	});
	assert.deepEqual(extra, ["Revit"]);
	assert.equal(peers.length, 1); // not Revit: already on the resume
	assert.equal(skillKey(peers[0].skill), "staadpro");
	assert.equal(peers[0].students, 3);
});

test("AI: only terms literally on the resume count, invented ones are dropped, the verdict is cached, the cap holds", async () => {
	let calls = 0;
	const ask = async (terms: string[]) => (calls++, [...terms.filter((t) => !/asdf/i.test(t)), "Invented Tool"]);
	const own = resumeOf("me", "Civil Engineering", ["Primavera P6", "Total Station", "asdf", "Hardworking"]);
	const text = "Primavera P6, Total Station, asdf, Hardworking";
	const args = { corpus: buildCorpus([]), branch: "civil" as const, userId: "me", data: own.data, text, isStatic, ask };
	const first = await extraSkills(args);
	assert.deepEqual(first.extra, ["Primavera P6", "Total Station"]); // not asdf (rejected), not Hardworking (soft), not Invented Tool (not on the resume)
	const second = await extraSkills(args);
	assert.deepEqual(second.extra, first.extra);
	assert.equal(calls, 1, "the second run is served from the cache");

	const many = Array.from({ length: 25 }, (_, i) => `Toolz${String.fromCharCode(97 + i)}${i}`);
	const big = resumeOf("me", "Civil Engineering", many);
	const capped = await extraSkills({ ...args, data: big.data, text: many.join(", "), ask: async (t) => t });
	assert.equal(capped.extra.length, MAX_AI_SKILLS);
});

test("AI: an error or no key adds nothing and never throws", async () => {
	const own = resumeOf("me", "Civil Engineering", ["Cavity Wall Tie Design"]);
	const base = {
		corpus: buildCorpus([]),
		branch: "civil" as const,
		userId: "me",
		data: own.data,
		text: "Cavity Wall Tie Design",
		isStatic,
	};
	assert.deepEqual(
		(
			await extraSkills({
				...base,
				ask: async () => {
					throw new Error("boom");
				},
			})
		).extra,
		[],
	);
	assert.deepEqual((await extraSkills({ ...base, ask: noAi })).extra, []);
	assert.equal((await classifySkills(["Cavity Wall Tie Design"], noAi)).size, 0);
});

test("empty corpus and no AI: nothing is added, exactly like the static lists alone", async () => {
	const own = resumeOf("me", "Civil Engineering", ["AutoCAD", "STAAD.Pro", "Revit"]);
	const out = await extraSkills({
		corpus: buildCorpus([]),
		branch: "civil",
		userId: "me",
		data: own.data,
		text: "AutoCAD, STAAD.Pro, Revit",
		isStatic,
		ask: noAi,
	});
	assert.deepEqual(out, { extra: [], peers: [] });
});

test("a skill the lists know is not counted again under a peer's spelling of it", async () => {
	const spellings = ["MSExcel", "MS Excel", "MS-Excel"]; // the first one is what the corpus keeps
	const peers = spellings.map((name, i) => resumeOf(`p${i}`, "Civil Engineering", [name]));
	const me = resumeOf("me", "Civil Engineering", ["MS Excel"]);
	const out = await extraSkills({
		corpus: buildCorpus(peers),
		branch: "civil",
		userId: "me",
		data: me.data,
		text: "MS Excel",
		isStatic: isListedSkill,
		ask: noAi,
	});
	assert.deepEqual(out, { extra: [], peers: [] });
});

/** An AI that confirms every term it is sent, and remembers what it was sent. */
const sent: string[] = [];
const confirmAll = async (terms: string[]) => {
	sent.push(...terms);
	return terms;
};

test("AI: only short plain skill names are sent, never free text", async () => {
	sent.length = 0;
	await classifySkills(
		["Navisworks", "Line one\nline two {x}", "a".repeat(31), "Primavera `P6`", "Navisworks Manage 2024"],
		confirmAll,
	);
	assert.deepEqual(sent, ["Navisworks", "Navisworks Manage 2024"]);
});

test("AI: one student's verdicts never decide another student's terms", async () => {
	const none = async () => [];
	assert.equal((await classifySkills(["Scopetool"], none, "student-a")).size, 0);
	assert.deepEqual([...(await classifySkills(["Scopetool"], confirmAll, "student-b"))], ["scopetool"]);
});

test("AI: the verdict cache is bounded and drops the oldest verdict first", async () => {
	const names = Array.from({ length: MAX_VERDICTS + 1 }, (_, i) => `Boundtool${i}`);
	for (let i = 0; i < names.length; i += 50) await classifySkills(names.slice(i, i + 50), confirmAll);
	sent.length = 0;
	await classifySkills([names[names.length - 1]], confirmAll);
	assert.deepEqual(sent, [], "the newest verdict is still cached");
	await classifySkills([names[0]], confirmAll);
	assert.deepEqual(sent, [names[0]], "the oldest was dropped, so it is asked again");
});
