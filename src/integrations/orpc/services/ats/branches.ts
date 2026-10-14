import skillsTaxonomy from "@/data/skills-taxonomy.json";
import type { ResumeData } from "@/schema/resume/data";

/**
 * Department-aware ATS content. Without a job description the keyword score counts skill terms from every field
 * (the software taxonomy plus the lists here), and the suggestions show examples from the student's own branch,
 * so a Civil student is no longer told to add Java and React.
 * The lists are a starting point, not the limit: `skill-lexicon.ts` adds the skills students of the same branch list
 * and the ones an AI check confirms, so skills missing here still count.
 */
type Branch = {
	label: string;
	/** Field of study as written on a resume or an eng-labs unit (full names and long codes). */
	study: RegExp;
	/** Short codes, only trusted on eng-labs units ("ME" on a resume can also mean Master of Engineering). */
	codes?: RegExp;
	/** What to list under Skills. */
	hint: string;
	/** What the no-JD keyword score counts. */
	counted: string;
	examples: [group: string, examples: string][];
	tools: string;
	stack: string;
	depth: string;
	project: string;
	impact: string;
	measures: string;
	/** Metric coaching: "What was the scale — …?" and how to estimate. */
	scale: string;
	estimate: string;
	summary: string;
	coach: { who: string; built: string; example: string };
	/** Weak → strong bullet pairs, and bullets in the XYZ formula. */
	metrics: string[];
	xyz: string[];
	/** Skill → aliases. Software skills live in `src/data/skills-taxonomy.json`. */
	skills?: Record<string, string[]>;
};

const NON_SOFTWARE = {
	counted: "skill terms (software, tools, methods and codes from any field)",
	stack: "tools and methods",
	estimate: "if your project was tested or used, say how many times or by how many people",
};

export const BRANCHES = {
	electrical: {
		...NON_SOFTWARE,
		label: "Electrical & Electronics Engineering",
		study: /\beee\b|electrical/i,
		hint: "simulation software, power and control tools, and standards",
		examples: [
			["Simulation & design", "MATLAB, Simulink, PSpice, ETAP"],
			["Power & machines", "Power Systems, Power Electronics, Electrical Machines, Switchgear"],
			["Automation & control", "PLC Programming, SCADA, Control Systems"],
			["Energy", "Solar PV, PVsyst, Electric Vehicles, Battery Management System"],
		],
		tools: "MATLAB, Simulink, PLC Programming",
		depth:
			"Add depth: simulation tools (e.g. MATLAB, Simulink, PSpice, ETAP), automation (PLC, SCADA), and power topics (power systems, power electronics, machines).",
		project: "A 5 kW rooftop solar system sized for the college hostel.",
		impact: "Cut simulated grid energy use by 30%; tested on a lab prototype.",
		measures: "Power, efficiency, losses, cost, or energy saved",
		scale: "kW, efficiency, losses, or energy saved",
		summary:
			"Final-year Electrical and Electronics Engineering student with project work in power electronics and MATLAB/Simulink. Looking for electrical design or power systems roles.",
		coach: {
			who: "Final-year EEE student specializing in power electronics",
			built: "Simulated a 5 kW solar inverter in MATLAB/Simulink and built a lab prototype",
			example:
				"Final-year B.Tech EEE student with project work in power electronics and automation. Designed and simulated a 5 kW rooftop solar system in MATLAB/Simulink and PVsyst. Looking for electrical design or power systems engineer roles.",
		},
		metrics: [
			'"Designed a solar system" → "Designed a 5 kW rooftop solar system in PVsyst covering 30% of the hostel\'s daytime load"',
			'"Worked on PLC programming" → "Programmed a PLC sequence for a 3-motor conveyor and cut changeover time by 10 minutes"',
			'"Studied power losses" → "Measured losses on 4 college feeders and proposed changes saving 6% energy"',
		],
		xyz: [
			'"Cut simulated inverter losses [X] by 12% [Y] by redesigning the switching scheme in MATLAB/Simulink [Z]"',
			'"Automated a 3-motor conveyor [X] with no missed stops in 2 weeks of trials [Y] using ladder logic on a PLC [Z]"',
		],
		skills: {
			Simulink: ["MATLAB Simulink"],
			PSpice: ["OrCAD PSpice"],
			ETAP: [],
			PSCAD: [],
			"PLC Programming": ["PLC", "Programmable Logic Controller", "Ladder Logic"],
			SCADA: [],
			"Power Systems": ["Power System Analysis"],
			"Power Electronics": [],
			"Electrical Machines": ["Electric Machines"],
			"Control Systems": [],
			Switchgear: ["Protection and Switchgear"],
			"Single Line Diagram": ["SLD"],
			"Electrical Design": ["Electrical Drawing", "AutoCAD Electrical"],
			"Solar PV": ["Solar Photovoltaic", "Solar Energy"],
			PVsyst: [],
			"Electric Vehicles": ["Electric Vehicle", "EV"],
			"Battery Management System": ["BMS"],
			"Renewable Energy": [],
		},
	},
	electronics: {
		...NON_SOFTWARE,
		label: "Electronics & Communication Engineering",
		study: /\b(ece|eie|ecm)\b|electronics|instrumentation/i,
		hint: "hardware design tools, embedded platforms, and HDLs like Verilog",
		examples: [
			["Embedded systems", "Embedded C, Arduino, Raspberry Pi, ARM Cortex"],
			["VLSI & digital design", "Verilog, VHDL, Xilinx Vivado, Cadence"],
			["Circuits & PCB", "PCB Design, KiCad, Proteus, Multisim"],
			["Signals & instrumentation", "MATLAB, Digital Signal Processing, LabVIEW, IoT"],
		],
		tools: "Embedded C, Arduino, Proteus",
		depth:
			"Add depth: embedded platforms (e.g. Arduino, ARM Cortex, Raspberry Pi), design tools (Verilog, Xilinx Vivado, Cadence), circuit and PCB tools (KiCad, Proteus, Multisim), and MATLAB.",
		project: "An IoT soil-moisture monitor that switches a water pump automatically.",
		impact: "Cut water use by 25% across 3 test beds; ran 4 weeks on battery.",
		measures: "Accuracy, power, range, latency, or cost",
		scale: "power drawn, range, accuracy, or data rate",
		summary:
			"Final-year Electronics and Communication Engineering student with hands-on embedded systems and VLSI design. Looking for embedded or VLSI engineer roles.",
		coach: {
			who: "Final-year ECE student specializing in embedded systems",
			built: "Built an IoT soil-moisture monitor on an ARM Cortex board in Embedded C",
			example:
				"Final-year B.Tech ECE student with hands-on work in embedded systems and digital design. Built an IoT soil-moisture monitor in Embedded C that cut water use by 25% in field tests. Looking for embedded or VLSI engineer roles.",
		},
		metrics: [
			'"Built an IoT device" → "Built an IoT soil-moisture monitor that cut water use by 25% across 3 test beds"',
			'"Designed a PCB" → "Designed a 2-layer PCB in KiCad that replaced 3 breadboard modules"',
			'"Worked on Verilog" → "Wrote a Verilog UART that passed 50 test vectors on a Xilinx FPGA at 115200 baud"',
		],
		xyz: [
			'"Cut water use [X] by 25% [Y] by building an IoT soil-moisture controller in Embedded C [Z]"',
			'"Reduced board size [X] by 40% [Y] by redesigning the circuit as a 2-layer PCB in KiCad [Z]"',
		],
		skills: {
			VLSI: ["VLSI Design"],
			Verilog: ["Verilog HDL", "SystemVerilog"],
			VHDL: [],
			FPGA: [],
			Cadence: ["Cadence Virtuoso"],
			"Xilinx Vivado": ["Vivado", "Xilinx ISE"],
			"Embedded C": ["Embedded Systems"],
			Microcontrollers: ["Microcontroller", "8051"],
			"ARM Cortex": ["ARM Microcontroller"],
			Arduino: [],
			"Raspberry Pi": [],
			IoT: ["Internet of Things"],
			"PCB Design": ["PCB", "Printed Circuit Board"],
			KiCad: [],
			"Altium Designer": ["Altium"],
			Proteus: [],
			Multisim: ["NI Multisim"],
			"Digital Signal Processing": ["DSP", "Signal Processing"],
			"Digital Electronics": [],
			"Analog Electronics": [],
			"Wireless Communication": [],
			"Antenna Design": ["HFSS", "CST Studio"],
			LabVIEW: ["NI LabVIEW"],
			Instrumentation: ["Process Control", "Sensors and Transducers"],
		},
	},
	civil: {
		...NON_SOFTWARE,
		label: "Civil Engineering",
		study: /civil/i,
		codes: /\bce\b/i,
		hint: "design software, site and survey tools, and the codes you design to",
		examples: [
			["Design & drafting", "AutoCAD, STAAD.Pro, ETABS, Revit"],
			["Planning & estimation", "MS Project, Primavera P6, Estimation & Costing, Quantity Surveying"],
			["Surveying & GIS", "Total Station, ArcGIS, QGIS"],
			["Codes & materials", "IS 456, IS 800, Concrete Mix Design"],
		],
		tools: "AutoCAD, STAAD.Pro, MS Excel",
		depth:
			"Add depth: design software (e.g. STAAD.Pro, ETABS, Revit), planning tools (Primavera P6, MS Project), surveying (Total Station, GIS), and the codes you designed to (IS 456, IS 800).",
		project: "A G+3 residential building designed for a 30 m × 15 m plot.",
		impact: "Bill of quantities for 1,200 m² of slab; design checked as per IS 456.",
		measures: "Area, quantities, cost, loads, or time saved",
		scale: "area, quantities, loads, or budget",
		summary:
			"Final-year Civil Engineering student with site experience in residential construction and structural design in STAAD.Pro. Looking for site or design engineer roles.",
		coach: {
			who: "Final-year Civil Engineering student specializing in structural design",
			built: "Designed a G+3 RCC building in STAAD.Pro and prepared its bill of quantities",
			example:
				"Final-year B.Tech Civil Engineering student with a site internship and structural design in STAAD.Pro and ETABS. Designed a G+3 residential building and prepared its bill of quantities. Looking for site engineer or structural design roles.",
		},
		metrics: [
			'"Prepared quantity estimates" → "Prepared quantity estimates for 1,200 m² of slab work, within 3% of the final bill"',
			'"Supervised site work" → "Supervised reinforcement checks on 3 floors of a G+3 block over 8 weeks"',
			'"Did surveying" → "Surveyed a 2-acre plot with a Total Station and plotted 40 contour points in AutoCAD"',
		],
		xyz: [
			'"Cut the steel quantity [X] by 8% [Y] by redesigning beam sections in STAAD.Pro [Z]"',
			'"Prepared the bill of quantities [X] for a 12,000 sq ft slab [Y] using MS Excel and IS 1200 rules [Z]"',
		],
		skills: {
			AutoCAD: ["Auto CAD"],
			"STAAD.Pro": ["STAAD Pro", "STAAD"],
			ETABS: [],
			SAP2000: ["SAP 2000"],
			Revit: ["Autodesk Revit"],
			"Tekla Structures": ["Tekla"],
			"Primavera P6": ["Primavera"],
			"MS Project": ["Microsoft Project"],
			"Estimation & Costing": ["Estimation and Costing", "Cost Estimation", "Rate Analysis"],
			"Quantity Surveying": ["Bill of Quantities", "BOQ", "Quantity Estimation"],
			"Bar Bending Schedule": ["BBS"],
			"Total Station": [],
			Surveying: ["Land Surveying"],
			GIS: ["ArcGIS", "QGIS", "Geographic Information System"],
			"Building Information Modeling": ["Building Information Modelling", "BIM"],
			"IS 456": ["IS456", "IS:456"],
			"IS 800": ["IS800", "IS:800"],
			"IS 875": ["IS875", "IS:875"],
			"Concrete Mix Design": ["Concrete Technology", "Mix Design"],
			"Structural Design": ["Structural Analysis", "RCC Design", "Steel Design"],
			"Geotechnical Engineering": ["Soil Mechanics", "Soil Testing"],
			"Transportation Engineering": ["Highway Engineering", "Traffic Engineering"],
			"Environmental Engineering": ["Water Treatment", "Wastewater Treatment"],
			"Site Execution": ["Site Supervision", "Site Engineering"],
			"HEC-RAS": [],
		},
	},
	mechanical: {
		...NON_SOFTWARE,
		label: "Mechanical Engineering",
		study: /mechanical|automobile|automotive|aeronautical|aerospace|mechatronics|production engineering|\bmech\b/i,
		codes: /\b(me|ae|mct)\b/i,
		hint: "CAD and analysis software, manufacturing methods, and tools",
		examples: [
			["CAD & modelling", "SolidWorks, CATIA, Creo, AutoCAD"],
			["Analysis & simulation", "ANSYS, FEA, CFD, MATLAB"],
			["Manufacturing", "CNC Programming, GD&T, 3D Printing, Lean Manufacturing"],
			["Quality & maintenance", "Six Sigma, Quality Control, Kaizen"],
		],
		tools: "SolidWorks, ANSYS, GD&T",
		depth:
			"Add depth: CAD software (e.g. SolidWorks, CATIA, Creo), analysis tools (ANSYS, FEA, CFD), and manufacturing methods (CNC, GD&T, Lean, Six Sigma).",
		project: "A go-kart chassis designed to take a 4g front impact load.",
		impact: "Cut part weight by 15%; prototype built and tested in the college workshop.",
		measures: "Weight, cost, efficiency, cycle time, or temperature",
		scale: "parts, cycle time, tolerances, or cost",
		summary:
			"Final-year Mechanical Engineering student with hands-on design in SolidWorks and FEA in ANSYS. Looking for design or manufacturing engineer roles.",
		coach: {
			who: "Final-year Mechanical Engineering student specializing in product design",
			built: "Designed a disc brake rotor in SolidWorks and validated it with FEA in ANSYS",
			example:
				"Final-year B.Tech Mechanical Engineering student with a manufacturing internship and hands-on design in SolidWorks and ANSYS. Redesigned a disc brake rotor that ran 18% cooler in simulation. Looking for design or production engineer roles.",
		},
		metrics: [
			'"Designed a fixture" → "Designed 2 welding fixtures in SolidWorks that cut setup time by 20%"',
			'"Worked on an assembly line" → "Mapped cycle times on 6 assembly stations and cut walking time by 12%"',
			'"Did FEA analysis" → "Ran FEA in ANSYS on 3 bracket designs and cut weight by 15% at the same safety factor"',
		],
		xyz: [
			'"Reduced bracket weight [X] by 15% [Y] by optimising the geometry with FEA in ANSYS [Z]"',
			'"Cut setup time [X] from 25 to 18 minutes [Y] by designing a quick-change fixture in SolidWorks [Z]"',
		],
		skills: {
			SolidWorks: ["Solid Works"],
			CATIA: [],
			Creo: ["PTC Creo", "Pro/E", "Pro Engineer"],
			"Siemens NX": ["Unigraphics", "NX CAD"],
			"Fusion 360": ["Autodesk Fusion"],
			AutoCAD: ["Auto CAD"],
			ANSYS: ["ANSYS Workbench", "ANSYS Fluent"],
			Abaqus: [],
			HyperMesh: ["Altair HyperMesh"],
			"Finite Element Analysis": ["FEA", "FEM"],
			"Computational Fluid Dynamics": ["CFD"],
			"GD&T": ["Geometric Dimensioning and Tolerancing"],
			"CNC Programming": ["CNC", "G-code"],
			"CAD/CAM": [],
			"3D Printing": ["Additive Manufacturing"],
			"Lean Manufacturing": ["Kaizen", "5S"],
			"Six Sigma": ["Lean Six Sigma", "DMAIC"],
			HVAC: [],
			Thermodynamics: [],
			"Heat Transfer": [],
			"Fluid Mechanics": [],
			"Strength of Materials": [],
			"Machine Design": [],
			"Manufacturing Processes": [],
			"IC Engines": ["Internal Combustion Engines"],
			"Automotive Engineering": ["Automobile Engineering", "Vehicle Dynamics"],
		},
	},
	software: {
		label: "Computer Science & IT",
		study:
			/\b(cse|csbs|aiml|aids|ai\s*&\s*ml|ai\s*&\s*ds)\b|computer|information technology|data science|artificial intelligence|machine learning|cyber|software/i,
		codes: /\b(cs|it|ds|iot|cys|csm|csd|csc|cso|mca|bca)\b/i,
		hint: "languages, frameworks, and tools",
		counted: "tech terms (languages, frameworks, databases, cloud tools, etc.)",
		examples: [
			["Programming Languages", "Python, JavaScript, Java, C++"],
			["Frameworks / Libraries", "React, Node.js, Spring Boot, Django"],
			["Database Systems", "PostgreSQL, MySQL, MongoDB"],
			["Cloud & DevOps", "AWS, Docker, Kubernetes, Git"],
		],
		tools: "React, Node.js, PostgreSQL",
		estimate: "if your app was used in class, mention how many students",
		stack: "tech stack",
		depth:
			"Add depth: frameworks (e.g. React, Spring), databases (PostgreSQL, MongoDB), cloud (AWS, GCP), and everyday tools (Docker, Git, CI/CD).",
		project: "A web app that helps students track internship applications.",
		impact: "Used by 200+ students; deployed on Vercel.",
		measures: "Users, uptime, accuracy, latency, GitHub stars, or class size",
		scale: "requests/sec, GB of data, number of endpoints",
		summary:
			"Final-year CS student with experience building full-stack apps using React and Node.js. Looking for backend or full-stack roles.",
		coach: {
			who: "Final-year Computer Science student specializing in full-stack development",
			built: "Built a React + Node.js internship tracker used by 200+ students",
			example:
				"Final-year B.Tech student with hands-on experience building full-stack web apps using React, Node.js, and PostgreSQL. Developed an internship management platform used by 200+ students at our college. Looking for backend/full-stack engineer roles where I can work on scalable systems.",
		},
		metrics: [
			'"Built a REST API" → "Built a REST API serving 500+ daily requests across 3 microservices"',
			'"Improved performance" → "Reduced page load time by 40% through lazy loading and caching"',
			'"Managed a database" → "Managed a PostgreSQL database with 10,000+ student records"',
			'"Trained a model" → "Trained a classification model achieving 92% accuracy on 5,000 samples"',
		],
		xyz: [
			'"Reduced API response time [X] by 35% [Y] by implementing Redis caching [Z]"',
			'"Built an internship tracker [X] used by 200 students [Y] using React and Supabase [Z]"',
			'"Increased test coverage [X] from 45% to 87% [Y] by writing 120 unit tests with Jest [Z]"',
		],
	},
	general: {
		...NON_SOFTWARE,
		label: "your field",
		study: /$^/,
		hint: "software, tools, and methods you use",
		examples: [
			["Software", "MS Excel, MATLAB, AutoCAD"],
			["Methods", "Project Management, Quality Control, Data Analysis"],
			["Your branch", "the design, analysis and lab tools of your own department"],
		],
		tools: "MS Excel, MATLAB, AutoCAD",
		depth:
			"Add depth: the software you use (e.g. MS Excel, MATLAB, AutoCAD), the methods you know, and the tools of your own branch.",
		project: "A low-cost water filter designed for a village school.",
		impact: "Used by 120 students; cost under ₹2,000 to build.",
		measures: "Users, cost, time saved, accuracy, or scale",
		scale: "people, cost, time, or size",
		summary:
			"Final-year B.Tech student with hands-on project and internship experience. Looking for graduate engineer roles.",
		coach: {
			who: "Final-year B.Tech student specializing in the core area of your branch",
			built: "Designed and tested a low-cost water filter used by 120 students",
			example:
				"Final-year B.Tech student with a 3-month internship and two hands-on design projects. Built and tested a low-cost water filter now used by 120 students at a local school. Looking for graduate engineer roles.",
		},
		metrics: [
			'"Led a project" → "Led a 4-member team that built a water filter used by 120 students"',
			'"Helped organise an event" → "Organised a technical fest for 600 participants on a ₹50,000 budget"',
		],
		xyz: [
			'"Cut the filter cost [X] by 40% [Y] by switching to locally available materials [Z]"',
			'"Raised event registrations [X] from 200 to 600 [Y] by running a campus-wide social media campaign [Z]"',
		],
		skills: {
			"MS Excel": ["Microsoft Excel", "Excel", "Advanced Excel"],
			"MS Office": ["Microsoft Office", "MS Word", "PowerPoint"],
			"Technical Drawing": ["Engineering Drawing", "Engineering Graphics"],
			"Quality Control": ["Quality Assurance", "QA/QC"],
			"Data Analysis": [],
		},
	},
} satisfies Record<string, Branch>;

export type BranchKey = keyof typeof BRANCHES;
const order: BranchKey[] = ["electrical", "electronics", "civil", "mechanical", "software"];

/** Home branch: eng-labs units first (nearest first, class → department), then the field of study on the resume. */
function homeBranch(units: string[], data: ResumeData): { key: BranchKey; from: "department" | "resume" } | undefined {
	// EEE before ECE ("Electrical and Electronics"); short codes only on eng-labs units.
	const find = (text: string, trustCodes: boolean) =>
		order.find((k) => {
			const b: Branch = BRANCHES[k];
			return b.study.test(text) || (trustCodes && !!b.codes?.test(text));
		});
	for (const u of units) {
		const key = find(u, true);
		if (key) return { key, from: "department" };
	}
	for (const i of data.sections.education.items.filter((i) => !i.hidden)) {
		const s = `${i.degree} ${i.area}`;
		// "IT" on a resume only in capitals: it is also an English word.
		const key = find(s, false) ?? (/\bIT\b/.test(s) ? "software" : undefined);
		if (key) return { key, from: "resume" };
	}
}

/** The branch the resume's own field of study points to, if any. */
export const resumeBranch = (data: ResumeData): BranchKey | undefined => homeBranch([], data)?.key;

/** "STAAD.Pro", "STAAD Pro" and "staad-pro" are one skill: lowercase letters, digits, + and # only. */
export const skillKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9+#]/g, "");

/** Keys of every run of 1–4 words in the text, so a skill is found however it is spaced or punctuated. */
export function keysIn(text: string): Set<string> {
	const words = text
		.split(/[\s,;|/•·()[\]{}:]+/)
		.map(skillKey)
		.filter(Boolean);
	const keys = new Set<string>();
	words.forEach((_, i) => {
		let key = "";
		for (const w of words.slice(i, i + 4)) {
			key += w;
			keys.add(key);
		}
	});
	return keys;
}

const softwareForms = new Set(
	Object.values(skillsTaxonomy.categories).flatMap((c) =>
		Object.entries(c).flatMap(([skill, aliases]) => [skill, ...aliases].map((f) => f.toLowerCase())),
	),
);
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Skills of the non-software branches, one whole-word regex each: "Excel" must not match "excellent", "AutoCAD." at
 * the end of a sentence still counts. Forms the software taxonomy already has are left to it (matched as before).
 */
const branchSkills = (() => {
	const skills = new Map<string, { skill: string; forms: string[]; branches: Set<BranchKey> }>();
	for (const [key, b] of Object.entries(BRANCHES) as [BranchKey, Branch][])
		for (const [skill, aliases] of Object.entries(b.skills ?? {})) {
			const s = skills.get(skill.toLowerCase()) ?? { skill, forms: [skill, ...aliases], branches: new Set() };
			s.branches.add(key);
			skills.set(skill.toLowerCase(), s);
		}
	return [...skills.values()]
		.map((s) => ({ ...s, forms: s.forms.filter((f) => !softwareForms.has(f.toLowerCase())) }))
		.filter((s) => s.forms.length > 0)
		.map(({ skill, forms, branches }) => ({
			skill,
			branches,
			re: new RegExp(
				`(?<![a-z0-9])(?:${forms.map((f) => escapeRe(f).replace(/\s+/g, "\\s+")).join("|")})(?![a-z0-9])`,
				"i",
			),
		}));
})();
export const branchTerms = branchSkills.map((s) => s.re);

const SOFTWARE_WORDS =
	"react|vue|angular|node|python|java|typescript|javascript|aws|docker|kubernetes|sql|api|mongodb|postgresql|git|flutter|kotlin|swift|django|flask|express|firebase|tailwind|next\\.?js|fastapi|spring|redis|graphql|pytorch|tensorflow|sklearn|pandas|numpy|supabase|prisma|vercel|netlify|machine learning|deep learning|ci\\/cd|agile|scrum";
const SOFTWARE_TERMS = new RegExp(`\\b(${SOFTWARE_WORDS})\\b`, "i");
/** Profile evidence only: the same words plus a few unambiguous ones the checks above never used. */
const SOFTWARE_EVIDENCE = new RegExp(
	`(?<![a-z0-9])(?:${SOFTWARE_WORDS}|c\\+\\+|c#|html|css|php|mysql|linux|unity|unreal|power bi|tableau)(?![a-z0-9])`,
	"gi",
);

/** Does the text name a skill or tool of any field? `extra`: skills the lists above miss (see `skill-lexicon.ts`). */
export const namesSkill = (text: string, extra: string[] = []) => {
	if (SOFTWARE_TERMS.test(text) || branchTerms.some((re) => re.test(text))) return true;
	const keys = extra.length > 0 ? keysIn(text) : undefined;
	return !!keys && extra.some((e) => keys.has(skillKey(e)));
};

/** A skill that students of the student's branch list, and how many do. */
export type Peer = { skill: string; students: number };

export type AtsProfile = {
	/** Department, else field of study; "general" when neither is known. */
	home: BranchKey;
	/** What the suggestions follow: the home branch, unless the resume's skills clearly point to another field. */
	focus: BranchKey;
	/** Skills found on the resume, any field (for the AI prompts). */
	skills: string[];
	/** On the resume and counted although the lists miss them: listed by peers, or confirmed by the AI check. */
	extra?: string[];
	/** Skills peers of the same branch list that are not on this resume yet, most common first. */
	peers?: Peer[];
};

/**
 * Step 1 of the ATS pipeline: understand the student before suggesting anything.
 * `text`: the resume's skills, bullets, summary and headline.
 * A Civil student whose resume is all Python and Java is aiming at IT roles: suggestions follow the resume.
 */
export function understandProfile(units: string[], data: ResumeData, text: string): AtsProfile {
	const home = homeBranch(units, data)?.key;
	const software = [...new Set((text.match(SOFTWARE_EVIDENCE) ?? []).map((s) => s.toLowerCase()))];
	const found = branchSkills.filter((s) => s.re.test(text));
	const evidence = (k: BranchKey) =>
		k === "software" ? software.length : found.filter((s) => s.branches.has(k)).length;
	const top = [...order].sort((a, b) => evidence(b) - evidence(a))[0];
	// ponytail: fixed thresholds (4 terms, twice the home branch); tune once real resumes are scored.
	const elsewhere = top !== home && evidence(top) >= 4 && evidence(top) >= 2 * (home ? evidence(home) : 0);
	const focus = home ? (elsewhere ? top : home) : evidence(top) >= 3 ? top : "general";
	return { home: home ?? "general", focus, skills: [...found.map((s) => s.skill), ...software].slice(0, 12) };
}

/** A line (with a leading newline) for the AI prompts so rewrites follow the profile. Empty for CSE students. */
export function branchPromptLine({ home, focus, skills }: AtsProfile): string {
	const noPush =
		"Don't add programming languages or software tools that aren't already on the resume unless the job description asks for them.";
	const found = skills.length > 0 ? ` Skills on the resume: ${skills.join(", ")}.` : "";
	if (focus === "software" && home === "software") return "";
	if (focus === "general") return `\nThe student's branch is not known.${found} ${noPush}`;
	const { label } = BRANCHES[focus];
	if (focus !== home) {
		const studies =
			home === "general" ? "The student's branch is not known" : `The student studies ${BRANCHES[home].label}`;
		return `\n${studies}, but the resume targets ${label} roles.${found} Keep suggestions to the skills and tools of that field.`;
	}
	return `\nThe student studies ${label}.${found} "Technical skills" and "tech stack" here mean the software, tools and methods of ${label}. ${noPush}`;
}
