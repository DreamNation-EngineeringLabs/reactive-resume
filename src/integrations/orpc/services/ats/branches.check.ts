// Run: pnpm exec tsx --test src/integrations/orpc/services/ats/branches.check.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import type { ResumeData } from "@/schema/resume/data";
import { sampleResumeData } from "@/schema/resume/sample";
import { type BranchKey, branchPromptLine, namesSkill, QUALITY_TERMS, termsOf, understandProfile } from "./branches";

const studying = (degree: string, area: string) => {
	const data = structuredClone(sampleResumeData) as ResumeData;
	data.sections.education.items = [{ ...data.sections.education.items[0], degree, area }];
	return data;
};
const noStudy = studying("", "");
const home = (units: string[], data: ResumeData) => understandProfile(units, data, "").home;

const CIVIL = "AutoCAD, STAAD.Pro, ETABS, Primavera P6, Total Station. Designed beams as per IS 456.";
const SOFTWARE = "Python, Java, React, Node.js, SQL, Git, Docker. Built a REST API with Express.";

test("eng-labs units decide the home branch, nearest unit first", () => {
	const cases: [string[], string][] = [
		[["CSE-A CSE-A", "Computer Science CSE", "Demo Institute DIT"], "software"],
		[
			["IT-A IT-A", "2024", "IT IT", "B.Tech BTECH", "VNR Vignana Jyothi Institute of Engineering and Technology"],
			"software",
		],
		[["CSE-AIML-B", "CSE (AI & ML) CSM"], "software"],
		[["Civil Engineering CE"], "civil"],
		[["CE-A CE-A", "CE"], "civil"],
		[["Computer Engineering CE"], "software"], // a field named in full beats another branch's short code
		[["ECE-B ECE-B", "Demo Institute of Information Technology"], "electronics"], // the nearest unit decides, not a field word on the institute
		[["Electrical and Electronics Engineering EEE"], "electrical"],
		[["ECE-B ECE-B"], "electronics"],
		[["EIE EIE"], "electronics"],
		[["Automobile Engineering"], "mechanical"],
		[["MECH-A MECH-A", "Mechanical Engineering ME"], "mechanical"],
	];
	for (const [units, branch] of cases)
		assert.equal(home(units, studying("B.Tech", "Computer Science")), branch, units.join(" / "));
});

test("without a department, the resume's field of study decides; short codes are not trusted there", () => {
	assert.equal(home(["Demo Institute DIT"], studying("B.Tech", "Civil Engineering")), "civil");
	assert.equal(home([], studying("Bachelor of Technology", "Mechanical Engineering")), "mechanical");
	assert.equal(home([], studying("B.E.", "Electronics and Communication Engineering")), "electronics");
	assert.equal(home([], studying("ME", "")), "general"); // ME = Master of Engineering too
	assert.equal(home([], studying("B.Tech", "IT")), "software"); // capital IT only
	assert.equal(home([], studying("B.Tech", "it")), "general");
	assert.equal(home([], noStudy), "general");
});

test("profile: suggestions follow the resume when it clearly targets another field", () => {
	const civilDept = ["Civil Engineering CE"];
	assert.equal(understandProfile(civilDept, noStudy, CIVIL).focus, "civil");
	assert.equal(understandProfile(civilDept, noStudy, SOFTWARE).focus, "software"); // Civil student aiming at IT
	assert.equal(understandProfile(civilDept, noStudy, `${CIVIL} Python, Java, SQL`).focus, "civil"); // not clear
	assert.equal(understandProfile(["CSE-A"], noStudy, SOFTWARE).focus, "software");
	assert.equal(understandProfile([], noStudy, CIVIL).focus, "civil"); // no department or field: the skills decide
	assert.equal(understandProfile([], noStudy, "Communication, teamwork").focus, "general");
	// the software evidence list is closed, so a CSE student is never moved to another branch by their skills
	const embedded = "C, Python, Arduino, Raspberry Pi, IoT, Embedded Systems";
	assert.equal(understandProfile(["CSE-A"], noStudy, embedded).focus, "software");
	assert.equal(understandProfile(["Civil Engineering CE"], noStudy, embedded).focus, "electronics");
});

test("AI prompt line follows the profile; CSE students get none", () => {
	assert.equal(branchPromptLine(understandProfile(["CSE-A"], noStudy, SOFTWARE)), "");
	const civil = branchPromptLine(understandProfile(["Civil Engineering CE"], noStudy, CIVIL));
	assert.match(civil, /studies Civil Engineering/);
	assert.match(civil, /Don't add programming languages/);
	assert.match(civil, /STAAD\.Pro/);
	const toIt = branchPromptLine(understandProfile(["Civil Engineering CE"], noStudy, SOFTWARE));
	assert.match(toIt, /studies Civil Engineering, but the resume targets Computer Science & IT roles/);
	assert.doesNotMatch(toIt, /Don't add programming languages/);
});

test("branch skills match whole words only", () => {
	assert.equal(namesSkill("Drafted column layouts in AutoCAD.", "civil"), true);
	assert.equal(namesSkill("Analysed the frame in STAAD.Pro", "civil"), true);
	assert.equal(namesSkill("Mapped the site with ArcGIS", "civil"), true);
	assert.equal(namesSkill("Built bar bending schedules in MS Excel", "civil"), true);
	assert.equal(namesSkill("Achieved excellent results in logistics and a decade of casting", "civil"), false);
	assert.equal(namesSkill("Designed beams as per IS 456", "civil"), true);
	assert.equal(namesSkill("this 4560 value", "civil"), false);
});

test("the no-AI content-quality check names a software skill exactly as it always did", () => {
	const names = (text: string) => namesSkill(text, "software", QUALITY_TERMS);
	assert.equal(names("Implemented REST endpoints for the hostel allocation module"), true);
	assert.equal(names("Built a chat app with Flutter and Firebase for the campus placement cell"), false);
	assert.equal(names("Built bar bending schedules in MS Excel"), false);
	assert.equal(names("Wired an Arduino and an IoT sensor to the lab server"), false);
	assert.equal(names("Built a chat app with Flutter and Python"), true);
	// the suggestions keep the wider software list
	assert.equal(namesSkill("Built a chat app with Flutter and Firebase", "software"), true);
});

test("the keyword count adds only the student's own branch; CSE counts the software taxonomy alone", () => {
	const count = (b: BranchKey, t: string) => termsOf(b).filter((re) => re.test(t)).length;
	const generic =
		"Version Control Systems (Git), data analysis, strive to excel, Arduino, IoT, MS Office, Quality Assurance";
	assert.equal(count("software", generic), 0);
	assert.ok(count("general", generic) >= 5); // branch unknown: every list
	assert.equal(count("civil", "Arduino, IoT, Simulink"), 0); // another branch's terms do not count
	assert.equal(count("civil", "MS Excel, AutoCAD, Revit"), 3); // its own and the general tools do
	assert.equal(count("electronics", "Arduino, IoT, Revit"), 2);
});

test("a Civil resume now has enough recognised terms to score (5+), software terms are left to the taxonomy", () => {
	const civil = `${CIVIL} MS Excel, Estimation & Costing, bar bending schedules.`;
	assert.ok(termsOf("civil").filter((re) => re.test(civil)).length >= 8);
	assert.equal(
		termsOf("general").some((re) => re.test("Python")),
		false,
	);
});
