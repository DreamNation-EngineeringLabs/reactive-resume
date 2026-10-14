// Run: pnpm exec tsx --test src/integrations/orpc/services/ats/branches.check.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import type { ResumeData } from "@/schema/resume/data";
import { sampleResumeData } from "@/schema/resume/sample";
import { branchTerms, detectBranch, namesSkill } from "./branches";

const studying = (degree: string, area: string) => {
	const data = structuredClone(sampleResumeData) as ResumeData;
	data.sections.education.items = [{ ...data.sections.education.items[0], degree, area }];
	return data;
};
const noStudy = studying("", "");

test("eng-labs units decide the branch, nearest unit first", () => {
	const cases: [string[], string][] = [
		[["CSE-A CSE-A", "Computer Science CSE", "Demo Institute DIT"], "software"],
		[
			["IT-A IT-A", "2024", "IT IT", "B.Tech BTECH", "VNR Vignana Jyothi Institute of Engineering and Technology"],
			"software",
		],
		[["CSE-AIML-B", "CSE (AI & ML) CSM"], "software"],
		[["Civil Engineering CE"], "civil"],
		[["CE-A CE-A", "CE"], "civil"],
		[["Electrical and Electronics Engineering EEE"], "electrical"],
		[["ECE-B ECE-B"], "electronics"],
		[["EIE EIE"], "electronics"],
		[["Automobile Engineering"], "mechanical"],
		[["MECH-A MECH-A", "Mechanical Engineering ME"], "mechanical"],
	];
	for (const [units, branch] of cases)
		assert.equal(detectBranch(units, studying("B.Tech", "Computer Science")), branch, units.join(" / "));
});

test("without a department, the resume's field of study decides; short codes are not trusted there", () => {
	assert.equal(detectBranch(["Demo Institute DIT"], studying("B.Tech", "Civil Engineering")), "civil");
	assert.equal(detectBranch([], studying("Bachelor of Technology", "Mechanical Engineering")), "mechanical");
	assert.equal(detectBranch([], studying("B.E.", "Electronics and Communication Engineering")), "electronics");
	assert.equal(detectBranch([], studying("ME", "")), "general"); // ME = Master of Engineering too
	assert.equal(detectBranch([], studying("B.Tech", "IT")), "general");
	assert.equal(detectBranch([], noStudy), "general");
});

test("branch skills match whole words only", () => {
	assert.equal(namesSkill("Drafted column layouts in AutoCAD."), true);
	assert.equal(namesSkill("Analysed the frame in STAAD.Pro"), true);
	assert.equal(namesSkill("Mapped the site with ArcGIS"), true);
	assert.equal(namesSkill("Built bar bending schedules in MS Excel"), true);
	assert.equal(namesSkill("Achieved excellent results in logistics and a decade of casting"), false);
	assert.equal(namesSkill("Designed beams as per IS 456"), true);
	assert.equal(namesSkill("this 4560 value"), false);
});

test("a Civil resume now has enough recognised terms to score (5+), software terms are left to the taxonomy", () => {
	const civil =
		"AutoCAD STAAD.Pro ETABS Primavera P6 MS Excel Total Station Estimation & Costing. Designed beams as per IS 456 and prepared bar bending schedules.";
	assert.ok(branchTerms.filter((re) => re.test(civil)).length >= 8);
	assert.equal(
		branchTerms.some((re) => re.test("Python")),
		false,
	);
});
