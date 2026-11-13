// Generated from the approved "Resume Review Comment Bank — 2028 Batch" document. Edit the
// document first, then this list, so the two never disagree; keep each `id` as the document has it.
import type { ReviewSuggestion } from "./review-suggestions";

export const REVIEW_SUGGESTION_BANK: readonly ReviewSuggestion[] = [
	// ── general ──
	{
		id: "GEN-01",
		section: "general",
		content:
			"Your resume should fill 2 full pages. Add the sections and details this review asks for rather than leaving half a page blank.",
		severity: "HIGH",
	},
	{
		id: "GEN-02",
		section: "general",
		content: "Your resume runs past 2 pages. Cut repeated points and weaker items so it fits on exactly 2 pages.",
		severity: "HIGH",
	},
	{
		id: "GEN-03",
		section: "general",
		content:
			"Use 12 pt for all body text, headings and contact details. Only your name at the top should be larger (14 pt).",
		severity: "MEDIUM",
	},
	{
		id: "GEN-04",
		section: "general",
		content:
			"Use one font throughout the resume. Mixing fonts looks careless and can confuse resume-scanning software.",
		severity: "MEDIUM",
	},
	{
		id: "GEN-05",
		section: "general",
		content: "Keep formatting consistent: the same date format, bullet style, bold and spacing in every section.",
		severity: "MEDIUM",
	},
	{
		id: "GEN-06",
		section: "general",
		content:
			"Remove tables, text boxes, columns, icons and graphics. Resume-scanning (ATS) software cannot read them, so your details may be lost.",
		severity: "HIGH",
	},
	{
		id: "GEN-07",
		section: "general",
		content:
			'Remove the "Relevant Coursework" section completely. Recruiters may assume you are interested only in those specific subjects, whereas entry-level engineers are expected to be open to working across different functions and technologies.',
		severity: "HIGH",
	},
	{
		id: "GEN-08",
		section: "general",
		content:
			"Use standard section headings: Career Objective, Educational Details, Technical Skills, Internships, Projects, Achievements, Strengths, Hobbies, Personal Details, Declaration.",
		severity: "MEDIUM",
	},
	{
		id: "GEN-09",
		section: "general",
		content:
			"Arrange the sections in this order: Career Objective, Educational Details, Technical Skills, Internships, Projects, Achievements, Strengths, Hobbies, Personal Details, Declaration.",
		severity: "MEDIUM",
	},
	{
		id: "GEN-10",
		section: "general",
		content: "Correct the spelling and grammar mistakes in this resume. A single typo can get a resume rejected.",
		severity: "HIGH",
	},
	{
		id: "GEN-11",
		section: "general",
		content: 'Write in a consistent tense: past tense for completed work, and no "I", "me" or "my" in descriptions.',
		severity: "LOW",
	},
	{
		id: "GEN-12",
		section: "general",
		content: "Remove your photograph. It is not needed and takes up space, unless a company specifically asks for it.",
		severity: "LOW",
	},
	{
		id: "GEN-13",
		section: "general",
		content:
			'Every section must add value. Remove empty headings and placeholder text such as "Lorem ipsum" or "Add details here".',
		severity: "HIGH",
	},
	{
		id: "GEN-14",
		section: "general",
		content:
			"Rewrite this resume in your own words. Text copied from templates, seniors or AI tools is easy to spot and you will be questioned on it.",
		severity: "HIGH",
	},
	{
		id: "GEN-15",
		section: "general",
		content: "Spell out abbreviations the first time you use them, except well-known ones such as B.Tech, CGPA or SQL.",
		severity: "LOW",
	},
	{
		id: "GEN-16",
		section: "general",
		content:
			"Remove the page borders, coloured backgrounds and coloured text. Use black text on white for a professional look that prints clearly.",
		severity: "MEDIUM",
	},
	{
		id: "GEN-17",
		section: "general",
		content: 'Remove the word "Resume" or "CV" from the top of the page. Your name is the title.',
		severity: "HIGH",
	},
	{
		id: "GEN-18",
		section: "general",
		content: "Save and share the resume as a PDF named FirstName_LastName_Resume.pdf.",
		severity: "LOW",
	},
	{
		id: "GEN-19",
		section: "general",
		content:
			"Use space efficiently: avoid empty gaps, wide margins and half-filled lines, and do not stretch content just to fill the page.",
		severity: "MEDIUM",
	},
	// ── basics ──
	{
		id: "HDR-01",
		section: "basics",
		content: 'Use your full name as the title of the resume, not "Resume" or "CV".',
		severity: "HIGH",
	},
	{
		id: "HDR-02",
		section: "basics",
		content: "Set your name in 14 pt. It is currently larger and takes space that your content needs.",
		severity: "MEDIUM",
	},
	{
		id: "HDR-03",
		section: "basics",
		content: "Write your name in full as it appears on your certificates, not a nickname or initials only.",
		severity: "MEDIUM",
	},
	{
		id: "HDR-04",
		section: "basics",
		content: "Add your LinkedIn profile URL in the header next to your contact details.",
		severity: "HIGH",
	},
	{
		id: "HDR-05",
		section: "basics",
		content: "Add your GitHub profile URL in the header with your LinkedIn and contact details.",
		severity: "HIGH",
	},
	{
		id: "HDR-06",
		section: "basics",
		content:
			'Give the full, clickable profile URL (e.g. linkedin.com/in/your-name), not just the word "LinkedIn" or an icon.',
		severity: "MEDIUM",
	},
	{
		id: "HDR-07",
		section: "basics",
		content: "Customise your LinkedIn URL so it reads linkedin.com/in/your-name, without the random numbers.",
		severity: "LOW",
	},
	{
		id: "HDR-08",
		section: "basics",
		content:
			"Your LinkedIn or GitHub link is broken or points to someone else's profile. Check that it opens your own profile.",
		severity: "HIGH",
	},
	{
		id: "HDR-09",
		section: "basics",
		content: "Your GitHub profile is empty. Upload the code of the projects on this resume before sharing the link.",
		severity: "MEDIUM",
	},
	{
		id: "HDR-10",
		section: "basics",
		content: "Use a professional email address based on your name, e.g. firstname.lastname@gmail.com.",
		severity: "MEDIUM",
	},
	{
		id: "HDR-11",
		section: "basics",
		content: "Add your mobile number with the country code (+91) in a readable format.",
		severity: "MEDIUM",
	},
	{
		id: "HDR-12",
		section: "basics",
		content: "Add your city and state in the header. A full home address is not needed.",
		severity: "LOW",
	},
	{
		id: "HDR-13",
		section: "basics",
		content: "Put all contact details on one or two lines below your name to save space.",
		severity: "LOW",
	},
	{
		id: "HDR-14",
		section: "basics",
		content: "Remove your roll number, Aadhaar number, date of birth and parents' names from the header.",
		severity: "MEDIUM",
	},
	{
		id: "HDR-15",
		section: "basics",
		content:
			'Remove the job title under your name (e.g. "Full Stack Developer"). As a fresher it can mislead; your Career Objective covers this.',
		severity: "LOW",
	},
	{
		id: "HDR-16",
		section: "basics",
		content: "Use space efficiently: keep the header compact, with your name and contact details in 3–4 lines.",
		severity: "LOW",
	},
	// ── summary ──
	{
		id: "OBJ-01",
		section: "summary",
		content:
			'Rename this section to "CAREER OBJECTIVE". Do not use Professional Summary, Profile, Summary, About Me or Objective Statement.',
		severity: "MEDIUM",
	},
	{
		id: "OBJ-02",
		section: "summary",
		content: "Add a Career Objective at the top of your resume, below your contact details.",
		severity: "HIGH",
	},
	{ id: "OBJ-03", section: "summary", content: "Shorten this to 2–3 lines at most.", severity: "MEDIUM" },
	{
		id: "OBJ-04",
		section: "summary",
		content:
			"Remove the technical skills, tools and programming languages from here. They belong in Technical Skills; this section is for your strengths.",
		severity: "HIGH",
	},
	{
		id: "OBJ-05",
		section: "summary",
		content:
			'Remove the domain knowledge from here (e.g. "machine learning", "VLSI", "structural design"). Keep it generic so it suits every company you apply to.',
		severity: "HIGH",
	},
	{
		id: "OBJ-06",
		section: "summary",
		content:
			"Mention 2 or 3 of your strengths, such as problem-solving, adaptability, teamwork, leadership, learning agility, attention to detail or communication.",
		severity: "HIGH",
	},
	{
		id: "OBJ-07",
		section: "summary",
		content: "Mention only 2 or 3 strengths. A long list of qualities reads as filler.",
		severity: "MEDIUM",
	},
	{
		id: "OBJ-08",
		section: "summary",
		content:
			"End by saying you aim to use these strengths to contribute to the organisation's goals while achieving your own professional growth.",
		severity: "MEDIUM",
	},
	{
		id: "OBJ-09",
		section: "summary",
		content:
			"Keep it generic. Do not name a specific company or job title, because you will send this resume to many companies.",
		severity: "MEDIUM",
	},
	{
		id: "OBJ-10",
		section: "summary",
		content:
			'Focus on what you can offer the organisation, not only on what you want from it (e.g. "to learn", "to gain exposure").',
		severity: "MEDIUM",
	},
	{
		id: "OBJ-11",
		section: "summary",
		content:
			'Replace the clichés ("hard-working, dedicated, passionate individual", "challenging environment") with strengths you can back up from your Achievements.',
		severity: "LOW",
	},
	{
		id: "OBJ-12",
		section: "summary",
		content:
			"Make sure the strengths here match the ones in your Strengths section and are supported by your Achievements.",
		severity: "LOW",
	},
	{
		id: "OBJ-13",
		section: "summary",
		content:
			'Write it as one or two flowing sentences, like "Would like to associate with a reputed organization to apply my…", not several short "I am… I want…" sentences.',
		severity: "LOW",
	},
	{
		id: "OBJ-14",
		section: "summary",
		content: 'Remove the years of experience or "expert" claims. As a fresher, describe your strengths instead.',
		severity: "MEDIUM",
	},
	{
		id: "OBJ-15",
		section: "summary",
		content:
			"Where a job description lists soft skills, pick 2–3 of those strengths for the version you send to that company.",
		severity: "LOW",
	},
	// ── education ──
	{ id: "EDU-01", section: "education", content: 'Rename this section to "Educational Details".', severity: "LOW" },
	{
		id: "EDU-02",
		section: "education",
		content: "List your education in this order: B.Tech first, then Intermediate or Diploma, then SSC or 10th.",
		severity: "HIGH",
	},
	{
		id: "EDU-03",
		section: "education",
		content:
			"Add your Intermediate details: college, board, year of passing and percentage. They are checked during recruitment and background verification.",
		severity: "HIGH",
	},
	{
		id: "EDU-04",
		section: "education",
		content:
			"Add your SSC/10th details: school, board (State Board, CBSE or ICSE), year of passing and percentage or CGPA.",
		severity: "HIGH",
	},
	{
		id: "EDU-05",
		section: "education",
		content:
			"You joined B.Tech through lateral entry, so list your Diploma (branch, institute, board, year, percentage) in place of Intermediate.",
		severity: "HIGH",
	},
	{
		id: "EDU-06",
		section: "education",
		content:
			"Remove the table and write each qualification on one line: degree and branch, institution and city, years, score.",
		severity: "HIGH",
	},
	{
		id: "EDU-07",
		section: "education",
		content:
			'Add your current B.Tech CGPA on its scale (e.g. 8.42/10) and say up to which semester (e.g. "till 5th semester").',
		severity: "HIGH",
	},
	{
		id: "EDU-08",
		section: "education",
		content: "Add the duration of each course (e.g. 2024–2028), with the expected year for B.Tech.",
		severity: "MEDIUM",
	},
	{
		id: "EDU-09",
		section: "education",
		content:
			"Write your branch name in full (e.g. Electronics and Communication Engineering), not only the short form.",
		severity: "MEDIUM",
	},
	{
		id: "EDU-10",
		section: "education",
		content: "Write the full name of your college and its city.",
		severity: "MEDIUM",
	},
	{
		id: "EDU-11",
		section: "education",
		content:
			"Mention the board for school and Intermediate: State Board (e.g. BIEAP / BIETS / BSEAP / BSE Telangana), CBSE or ICSE.",
		severity: "MEDIUM",
	},
	{
		id: "EDU-12",
		section: "education",
		content:
			"Write each score exactly as on your marks memo: percentage for percentage, CGPA/GPA for grade points, with the scale. Do not convert or round up.",
		severity: "HIGH",
	},
	{
		id: "EDU-13",
		section: "education",
		content: "Use the same layout for every qualification so the dates and scores line up.",
		severity: "LOW",
	},
	{
		id: "EDU-14",
		section: "education",
		content: "Remove the education details below 10th (e.g. 8th class, primary school).",
		severity: "LOW",
	},
	{
		id: "EDU-15",
		section: "education",
		content: "Remove the semester-wise marks list. Give only your overall CGPA.",
		severity: "MEDIUM",
	},
	{
		id: "EDU-16",
		section: "education",
		content: "If you have a gap year, be ready to explain it in the interview; do not hide it by changing years.",
		severity: "LOW",
	},
	{
		id: "EDU-17",
		section: "education",
		content: "Do not mention backlogs here unless the company form asks. If you have cleared them, the CGPA is enough.",
		severity: "LOW",
	},
	{
		id: "EDU-18",
		section: "education",
		content: "Move your Educational Details above Projects, right after the Career Objective.",
		severity: "MEDIUM",
	},
	{
		id: "EDU-19",
		section: "education",
		content:
			"Use space efficiently: write each qualification in one or two lines (course, institution, year and score).",
		severity: "LOW",
	},
	// ── projects ──
	{
		id: "PRJ-01",
		section: "projects",
		group: "Number of projects",
		content: "Add 1 more project. You need at least 4 (or 3 projects plus an internship).",
		severity: "HIGH",
	},
	{
		id: "PRJ-02",
		section: "projects",
		group: "Number of projects",
		content: "Add 2 more projects. You need at least 4 (or 3 projects plus 1–2 internships).",
		severity: "HIGH",
	},
	{
		id: "PRJ-03",
		section: "projects",
		group: "Number of projects",
		content:
			"Add more projects: you need at least 4. Your semester mini-projects, lab projects, hackathon builds and personal projects all count.",
		severity: "HIGH",
	},
	{
		id: "PRJ-04",
		section: "projects",
		group: "Number of projects",
		content:
			"Keep your best 4–5 projects and remove the rest; very small exercises (calculator, to-do list, tic-tac-toe) weaken the list.",
		severity: "MEDIUM",
	},
	{
		id: "PRJ-05",
		section: "projects",
		group: "Number of projects",
		content: "Put your strongest or most recent project first.",
		severity: "LOW",
	},
	{
		id: "PRJ-06",
		section: "projects",
		group: "Title line and tech stack",
		content:
			'Give the project a clear title that says what it does (e.g. "Smart Attendance System Using Face Recognition"), not just "Project 1" or "Mini Project".',
		severity: "MEDIUM",
	},
	{
		id: "PRJ-07",
		section: "projects",
		group: "Title line and tech stack",
		content: "Add a Tech Stack line after the title: Project Title | Tech Stack: tools, languages, hardware.",
		severity: "HIGH",
	},
	{
		id: "PRJ-08",
		section: "projects",
		group: "Title line and tech stack",
		content: "List only the tools you actually used in this project in its Tech Stack.",
		severity: "MEDIUM",
	},
	{
		id: "PRJ-09",
		section: "projects",
		group: "Title line and tech stack",
		content: "Add the project duration (month and year, e.g. Jan 2026 – Apr 2026).",
		severity: "LOW",
	},
	{
		id: "PRJ-10",
		section: "projects",
		group: "Description (RATS method)",
		content: "Write the description as one paragraph of 3–4 lines, not bullet points.",
		severity: "MEDIUM",
	},
	{
		id: "PRJ-11",
		section: "projects",
		group: "Description (RATS method)",
		content: "Shorten this to 3–4 lines. Keep the result, what you built, your role and the problem; drop the rest.",
		severity: "MEDIUM",
	},
	{
		id: "PRJ-12",
		section: "projects",
		group: "Description (RATS method)",
		content: "Expand this to 3–4 lines: the result, what you built, your role in the team and the problem it solves.",
		severity: "MEDIUM",
	},
	{
		id: "PRJ-13",
		section: "projects",
		group: "Description (RATS method)",
		content: 'Start the description with the result you achieved, e.g. "Achieved 92% prediction accuracy by…".',
		severity: "HIGH",
	},
	{
		id: "PRJ-14",
		section: "projects",
		group: "Description (RATS method)",
		content:
			"Add a measurable result: accuracy, speed-up, time saved, cost or power saved, users, or the number of test cases passed.",
		severity: "HIGH",
	},
	{
		id: "PRJ-15",
		section: "projects",
		group: "Description (RATS method)",
		content: "Make sure the result is real and you can explain how you measured it. Remove numbers you cannot back up.",
		severity: "HIGH",
	},
	{
		id: "PRJ-16",
		section: "projects",
		group: "Description (RATS method)",
		content:
			"Describe what you built using strong action verbs: Developed, Designed, Implemented, Optimized, Automated.",
		severity: "MEDIUM",
	},
	{
		id: "PRJ-17",
		section: "projects",
		group: "Description (RATS method)",
		content:
			'Say what you personally did and the size of the team, e.g. "Responsible for data preprocessing and model training in a team of 4."',
		severity: "HIGH",
	},
	{
		id: "PRJ-18",
		section: "projects",
		group: "Description (RATS method)",
		content:
			'Add the problem the project solves and why you took it up, e.g. "Undertaken to address manual attendance tracking wasting class time."',
		severity: "MEDIUM",
	},
	{
		id: "PRJ-19",
		section: "projects",
		group: "Description (RATS method)",
		content:
			"Remove the step-by-step explanation of how the code or model works. Keep it to the result, what you built, your role and the problem.",
		severity: "MEDIUM",
	},
	{
		id: "PRJ-20",
		section: "projects",
		group: "Description (RATS method)",
		content:
			'Mention the main feature or module you implemented, e.g. "real-time alerts", "role-based login", "PID control".',
		severity: "LOW",
	},
	{
		id: "PRJ-21",
		section: "projects",
		group: "Description (RATS method)",
		content: "Add the business or real-world impact, e.g. who would use it and what it saves them.",
		severity: "LOW",
	},
	{
		id: "PRJ-22",
		section: "projects",
		group: "Description (RATS method)",
		content: "Rewrite this description in your own words. You will be asked about every line of it in the interview.",
		severity: "HIGH",
	},
	{
		id: "PRJ-23",
		section: "projects",
		group: "Links",
		content: "Add the GitHub repository link at the end of this project's description.",
		severity: "HIGH",
	},
	{
		id: "PRJ-24",
		section: "projects",
		group: "Links",
		content:
			"The GitHub link does not open or the repository is empty. Upload the code with a short README before sharing.",
		severity: "HIGH",
	},
	{
		id: "PRJ-25",
		section: "projects",
		group: "Links",
		content: "Link to this specific project's repository, not your GitHub home page.",
		severity: "MEDIUM",
	},
	{
		id: "PRJ-26",
		section: "projects",
		group: "Links",
		content:
			"For this hardware/design project, upload the circuit diagrams, code, CAD files, simulation results or report to a GitHub repository and link it.",
		severity: "MEDIUM",
	},
	{
		id: "PRJ-27",
		section: "projects",
		group: "Links",
		content: "If the project is deployed, add the live demo link next to the GitHub link.",
		severity: "LOW",
	},
	{
		id: "PRJ-28",
		section: "projects",
		group: "Branch-specific",
		content:
			"For your electronics project, list the hardware (e.g. ESP32, Arduino), sensors, software (Embedded C, MATLAB, Proteus) and any cloud or app platform (Blynk, ThingSpeak, MQTT) in the Tech Stack.",
		severity: "MEDIUM",
	},
	{
		id: "PRJ-29",
		section: "projects",
		group: "Branch-specific",
		content: "Give a hardware result, e.g. measurement accuracy, power saved, response time or range achieved.",
		severity: "HIGH",
	},
	{
		id: "PRJ-30",
		section: "projects",
		group: "Branch-specific",
		content:
			"Mention your part in the build: circuit design, sensor calibration, firmware programming, PCB layout or testing.",
		severity: "MEDIUM",
	},
	{
		id: "PRJ-31",
		section: "projects",
		group: "Branch-specific",
		content:
			"For your design project, list the software (SolidWorks, ANSYS, CATIA, MATLAB/Simulink) and the material or standard used in the Tech Stack.",
		severity: "MEDIUM",
	},
	{
		id: "PRJ-32",
		section: "projects",
		group: "Branch-specific",
		content: "Give an engineering result, e.g. weight reduced, safety factor, efficiency gained or energy recovered.",
		severity: "HIGH",
	},
	{
		id: "PRJ-33",
		section: "projects",
		group: "Branch-specific",
		content:
			"For your civil project, list the software (STAAD.Pro, AutoCAD, Revit, ETABS) and the IS codes followed (e.g. IS 456, IS 875).",
		severity: "MEDIUM",
	},
	{
		id: "PRJ-34",
		section: "projects",
		group: "Branch-specific",
		content: "Give the design result, e.g. which code checks it passed and how much material or cost was saved.",
		severity: "HIGH",
	},
	{
		id: "PRJ-35",
		section: "projects",
		content:
			"Use space efficiently: keep each project to 3–4 lines, with only what shows your contribution and the result.",
		severity: "MEDIUM",
	},
	// ── experience ──
	{
		id: "INT-01",
		section: "experience",
		content: 'Rename this section to "Internships". As a student, your work experience is internships.',
		severity: "LOW",
	},
	{
		id: "INT-02",
		section: "experience",
		content: "Write the organisation's name, followed by the project title and the duration.",
		severity: "HIGH",
	},
	{
		id: "INT-03",
		section: "experience",
		content:
			"Describe the work in a single paragraph of 3–4 lines, starting with the outcome achieved. List the software, technologies, tools or instruments you used hands-on as a separate line, and add the soft skills you developed alongside the technical skills.",
		severity: "HIGH",
	},
	{
		id: "INT-04",
		section: "experience",
		content: 'Describe what you did and achieved, not what the training covered ("Learned Python, HTML…").',
		severity: "HIGH",
	},
	{
		id: "INT-05",
		section: "experience",
		content: "This was a course or training programme, not an internship. Move it to Certifications.",
		severity: "MEDIUM",
	},
	{
		id: "INT-06",
		section: "experience",
		content: "Add a measurable outcome from the internship, e.g. features delivered, time saved, accuracy reached.",
		severity: "MEDIUM",
	},
	{
		id: "INT-07",
		section: "experience",
		content: "Mention the project you worked on during the internship and link it if the code is public.",
		severity: "LOW",
	},
	{ id: "INT-08", section: "experience", content: "List internships with the most recent first.", severity: "LOW" },
	{
		id: "INT-09",
		section: "experience",
		content:
			"Make sure you hold the offer or completion letter for every internship listed; it is checked during verification.",
		severity: "MEDIUM",
	},
	{
		id: "INT-10",
		section: "experience",
		content:
			"Put this industrial training or in-plant visit under Achievements (co-curricular), not Internships, unless you did project work there.",
		severity: "LOW",
	},
	{
		id: "INT-11",
		section: "experience",
		content:
			"Use the internship as one of your 4 project slots only if you describe the work done in the same RATS format.",
		severity: "LOW",
	},
	{
		id: "INT-12",
		section: "experience",
		content: 'Remove this section if you have no internships. Do not keep an empty heading or write "Fresher".',
		severity: "MEDIUM",
	},
	{
		id: "INT-13",
		section: "experience",
		content:
			'Remove "Research Experience" / "Research Work" as a heading; use INTERNSHIP for job interviews. Recruiters may not consider your candidature, as they think you are interested in research only. Keep "Research Experience" only if you are applying for research positions or higher studies.',
		severity: "HIGH",
	},
	{
		id: "INT-14",
		section: "experience",
		content:
			'Place this section above Projects and use the heading INTERNSHIP, not "Research Experience", for job applications.',
		severity: "MEDIUM",
	},
	{
		id: "INT-15",
		section: "experience",
		content:
			"Do not write Founder, Co-founder, Freelancer, Part-time Job, Tuitions or Faculty anywhere in the resume; recruiters may assume you will continue those activities after joining. Present it as an internship or project work done with that organisation, under INTERNSHIP, above Projects.",
		severity: "HIGH",
	},
	{
		id: "INT-16",
		section: "experience",
		content:
			"Describe this start-up or freelance work exactly like a project, in 3–4 lines: start with the result, then the activity, the problem addressed, the tools used on a separate line, and the soft skills gained.",
		severity: "MEDIUM",
	},
	{
		id: "INT-17",
		section: "experience",
		content: "Use space efficiently: keep each internship to 3–4 lines, with no routine duties or repeated points.",
		severity: "MEDIUM",
	},
	// ── awards ──
	{
		id: "ACH-01",
		section: "awards",
		group: "Structure and count",
		content: "Add an Achievements section below Projects. It shows your teamwork and skills beyond academics.",
		severity: "HIGH",
	},
	{
		id: "ACH-02",
		section: "awards",
		group: "Structure and count",
		content: "Split your achievements into three sub-headings: Academic, Co-curricular and Extracurricular.",
		severity: "MEDIUM",
	},
	{
		id: "ACH-03",
		section: "awards",
		group: "Structure and count",
		content: "Add at least 4–5 achievements. Include school-level ones too; they count.",
		severity: "HIGH",
	},
	{
		id: "ACH-04",
		section: "awards",
		group: "Structure and count",
		content: "On a 2-page resume, list 7–8 co-curricular and 7–8 extracurricular activities.",
		severity: "MEDIUM",
	},
	{
		id: "ACH-05",
		section: "awards",
		group: "Structure and count",
		content: "On a 1-page resume, combine the three groups and keep only the 4–5 most important.",
		severity: "MEDIUM",
	},
	{
		id: "ACH-06",
		section: "awards",
		group: "Structure and count",
		content: "Put the achievements most relevant to the job description or role first.",
		severity: "LOW",
	},
	{
		id: "ACH-07",
		section: "awards",
		group: "Academic (3–4)",
		content:
			"Add 3–4 academic achievements: Olympiads, Spell Bee, NTSE, topper or rank holder, merit scholarships, project exhibitions or big contests won, including at school level.",
		severity: "HIGH",
	},
	{
		id: "ACH-08",
		section: "awards",
		group: "Academic (3–4)",
		content:
			'Say what you achieved and at what level, e.g. "Secured State Rank 112 in the International Maths Olympiad (2019)".',
		severity: "MEDIUM",
	},
	{
		id: "ACH-09",
		section: "awards",
		group: "Academic (3–4)",
		content: "Include your entrance exam rank (EAMCET / JEE) only if it is a strong rank; otherwise leave it out.",
		severity: "LOW",
	},
	{
		id: "ACH-10",
		section: "awards",
		group: "Academic (3–4)",
		content:
			"Being a class or college topper, or receiving a merit scholarship, is an academic achievement; add it with the year.",
		severity: "LOW",
	},
	{
		id: "ACH-11",
		section: "awards",
		group: "Co-curricular (7–8 on 2 pages)",
		content:
			"Add co-curricular activities: paper or poster presentations, publications, patents, hackathons, project expos, open house, workshops, trainings, guest lectures and technical association activities.",
		severity: "HIGH",
	},
	{
		id: "ACH-12",
		section: "awards",
		group: "Co-curricular (7–8 on 2 pages)",
		content:
			"For each hackathon or contest, give the event name, organiser, year and your result (winner, finalist, top 10, participant).",
		severity: "MEDIUM",
	},
	{
		id: "ACH-13",
		section: "awards",
		group: "Co-curricular (7–8 on 2 pages)",
		content: "For a paper or publication, give the title, the conference or journal, and the year.",
		severity: "MEDIUM",
	},
	{
		id: "ACH-14",
		section: "awards",
		group: "Co-curricular (7–8 on 2 pages)",
		content:
			"Mention your role in the technical club or association (member, coordinator, organiser) and what you did.",
		severity: "LOW",
	},
	{
		id: "ACH-15",
		section: "awards",
		group: "Co-curricular (7–8 on 2 pages)",
		content:
			'Group similar workshops or guest lectures into one line rather than one line each, e.g. "Attended 5 workshops on IoT, Cloud and Robotics (2024–25)".',
		severity: "LOW",
	},
	{
		id: "ACH-16",
		section: "awards",
		group: "Co-curricular (7–8 on 2 pages)",
		content: "Move NPTEL, Coursera or other online course certificates to Certifications.",
		severity: "LOW",
	},
	{
		id: "ACH-17",
		section: "awards",
		group: "Extracurricular (7–8 on 2 pages)",
		content:
			"Add extracurricular activities: sports and games, NCC, NSS, singing, dance, clubs, events you organised, coordinator or volunteer roles.",
		severity: "HIGH",
	},
	{
		id: "ACH-18",
		section: "awards",
		group: "Extracurricular (7–8 on 2 pages)",
		content:
			'Say what you did and at what level, e.g. "Captain, college cricket team; runners-up at inter-college tournament (2025)".',
		severity: "MEDIUM",
	},
	{
		id: "ACH-19",
		section: "awards",
		group: "Extracurricular (7–8 on 2 pages)",
		content:
			"Highlight positions of responsibility (class representative, captain, house captain, chair, secretary, event coordinator): they show leadership.",
		severity: "MEDIUM",
	},
	{
		id: "ACH-20",
		section: "awards",
		group: "Extracurricular (7–8 on 2 pages)",
		content: "Add your NCC/NSS details: wing or unit, certificate (A/B/C) and camps attended.",
		severity: "LOW",
	},
	{
		id: "ACH-21",
		section: "awards",
		group: "Extracurricular (7–8 on 2 pages)",
		content:
			'Add the events you organised or volunteered at, with your role and the scale (e.g. "Coordinated a 500-participant technical fest").',
		severity: "LOW",
	},
	{
		id: "ACH-22",
		section: "awards",
		group: "Wording and accuracy",
		content: "Add the year to each achievement.",
		severity: "LOW",
	},
	{
		id: "ACH-23",
		section: "awards",
		group: "Wording and accuracy",
		content:
			'Start each achievement with what you did or won (Won, Secured, Led, Presented, Organised), not "Participated in" every time.',
		severity: "LOW",
	},
	{
		id: "ACH-24",
		section: "awards",
		group: "Wording and accuracy",
		content: "Keep each achievement to one line.",
		severity: "LOW",
	},
	{
		id: "ACH-25",
		section: "awards",
		group: "Wording and accuracy",
		content: "List only achievements you have certificates or proof for; they can be checked.",
		severity: "HIGH",
	},
	{
		id: "ACH-26",
		section: "awards",
		group: "Wording and accuracy",
		content: "Move this item: it is a project, internship or skill, not an achievement.",
		severity: "LOW",
	},
	{
		id: "ACH-27",
		section: "awards",
		content:
			'Write your paper as "Publication", not "Research Paper": "Publication completed" if published, or "Publication (in pipeline)" if it is in process.',
		severity: "MEDIUM",
	},
	{
		id: "ACH-28",
		section: "awards",
		content: "Use space efficiently: write each achievement on a single line and combine similar items into one.",
		severity: "LOW",
	},
	// ── strengths ──
	{
		id: "STR-01",
		section: "strengths",
		content: "Add a Strengths section with 4–5 strengths, below Achievements.",
		severity: "HIGH",
	},
	{
		id: "STR-02",
		section: "strengths",
		content: "Keep 4–5 strengths. Fewer looks thin; more looks like a list of adjectives.",
		severity: "MEDIUM",
	},
	{
		id: "STR-03",
		section: "strengths",
		content: "Move this section below Achievements, so your strengths follow the activities that prove them.",
		severity: "LOW",
	},
	{
		id: "STR-04",
		section: "strengths",
		content:
			"List soft skills here, not technical skills. Python, AutoCAD and similar tools belong in Technical Skills.",
		severity: "HIGH",
	},
	{
		id: "STR-05",
		section: "strengths",
		content:
			"Pick only strengths that your Achievements or Projects prove. Remove ones nothing on the resume supports.",
		severity: "MEDIUM",
	},
	{
		id: "STR-06",
		section: "strengths",
		content: 'Your scores are strong, so add "Hard working" as a strength.',
		severity: "LOW",
	},
	{
		id: "STR-07",
		section: "strengths",
		content: 'Your roles and team activities show "Leadership skills" and "Team player"; add them.',
		severity: "LOW",
	},
	{
		id: "STR-08",
		section: "strengths",
		content: 'Your hackathons and project contests show "Problem-solving skills"; add it.',
		severity: "LOW",
	},
	{
		id: "STR-09",
		section: "strengths",
		content: 'Your presentations and debates show "Communication skills" or "Presentation skills"; add one.',
		severity: "LOW",
	},
	{
		id: "STR-10",
		section: "strengths",
		content: 'Your anchoring or compering shows "Public speaking skills"; add it.',
		severity: "LOW",
	},
	{
		id: "STR-11",
		section: "strengths",
		content: 'Remove personal traits that are not workplace strengths (e.g. "kind", "honest", "friendly", "punctual").',
		severity: "LOW",
	},
	{
		id: "STR-12",
		section: "strengths",
		content: "Write each strength as a short phrase (2–4 words), one per line or bullet, not a sentence or paragraph.",
		severity: "LOW",
	},
	{
		id: "STR-13",
		section: "strengths",
		content: 'Remove weaknesses or phrases like "quick learner but…". This section is only for strengths.',
		severity: "MEDIUM",
	},
	// ── skills ──
	{
		id: "SKL-01",
		section: "skills",
		content: "Add a Technical Skills section. This is where all your tools, languages and software go.",
		severity: "HIGH",
	},
	{ id: "SKL-02", section: "skills", content: 'Rename this section to "Technical Skills".', severity: "LOW" },
	{
		id: "SKL-03",
		section: "skills",
		content:
			"Group your skills under labels, e.g. Programming Languages, Web Technologies, Databases, Tools & Platforms. For core branches: Design Software, Simulation Tools, Hardware, Standards.",
		severity: "HIGH",
	},
	{
		id: "SKL-04",
		section: "skills",
		content:
			"List only skills you have used hands-on and can answer interview questions on. Remove anything you have only heard of.",
		severity: "HIGH",
	},
	{
		id: "SKL-05",
		section: "skills",
		content:
			'Remove the star ratings, progress bars and percentages. Software cannot read them, and "60% Java" invites doubt.',
		severity: "HIGH",
	},
	{
		id: "SKL-06",
		section: "skills",
		content: "Make sure the main tools in your Projects also appear here, and vice versa.",
		severity: "MEDIUM",
	},
	{
		id: "SKL-07",
		section: "skills",
		content:
			"Move soft skills (communication, teamwork, leadership) to Strengths. This section is only for technical skills.",
		severity: "MEDIUM",
	},
	{
		id: "SKL-08",
		section: "skills",
		content:
			"Remove basic computer skills such as MS Word, Excel basics, typing and internet browsing, unless the role asks for them.",
		severity: "LOW",
	},
	{
		id: "SKL-09",
		section: "skills",
		content:
			"Write the correct spelling and capitalisation of each technology: JavaScript, GitHub, MySQL, Node.js, AutoCAD, MATLAB.",
		severity: "MEDIUM",
	},
	{
		id: "SKL-10",
		section: "skills",
		content: "Remove operating systems and IDEs (Windows, VS Code, Eclipse) unless they matter for the role.",
		severity: "LOW",
	},
	{
		id: "SKL-11",
		section: "skills",
		content: "Separate languages from frameworks and libraries; e.g. Python is a language, Django and Pandas are not.",
		severity: "LOW",
	},
	{
		id: "SKL-12",
		section: "skills",
		content: 'Remove "C/C++/Java/Python" written as one item; list each language separately and only those you know.',
		severity: "LOW",
	},
	{
		id: "SKL-13",
		section: "skills",
		content:
			"Add the core software and hardware of your branch (e.g. MATLAB, Proteus, KiCad, PLC for EEE/ECE; SolidWorks, ANSYS for ME; STAAD.Pro, AutoCAD for CE) if you have used them.",
		severity: "MEDIUM",
	},
	{
		id: "SKL-14",
		section: "skills",
		content: "Move this section up, right after Educational Details, so recruiters see your skills early.",
		severity: "LOW",
	},
	{
		id: "SKL-15",
		section: "skills",
		content: "Remove spoken languages from here. If you want to include them, put them in Personal Details.",
		severity: "LOW",
	},
	{
		id: "SKL-16",
		section: "skills",
		content:
			"Use space efficiently: write one line per category with the skills separated by commas, instead of a long vertical list.",
		severity: "MEDIUM",
	},
	// ── certifications ──
	{
		id: "CER-01",
		section: "certifications",
		content:
			"Mention all the relevant certifications you have completed in college (NPTEL, Coursera, Cisco, AWS, Infosys Springboard, etc.).",
		severity: "MEDIUM",
	},
	{
		id: "CER-02",
		section: "certifications",
		content:
			'Give each certification\'s name, the awarding body and the year, e.g. "Programming in Java — NPTEL (IIT Kharagpur), 2025".',
		severity: "MEDIUM",
	},
	{
		id: "CER-03",
		section: "certifications",
		content: 'Add your score or grade where there is one, e.g. "Elite + Silver, 82%" for NPTEL.',
		severity: "LOW",
	},
	{
		id: "CER-04",
		section: "certifications",
		content:
			"Put the most valuable certifications first: industry certifications (AWS, Cisco, Microsoft, Oracle) and NPTEL Elite before short online courses.",
		severity: "LOW",
	},
	{
		id: "CER-05",
		section: "certifications",
		content:
			"Remove participation-only certificates (webinars, one-hour talks); put workshops and trainings under Co-curricular achievements.",
		severity: "LOW",
	},
	{
		id: "CER-06",
		section: "certifications",
		content: "Keep it to your best 4–6 certifications. A long list of small courses hides the important ones.",
		severity: "LOW",
	},
	{
		id: "CER-07",
		section: "certifications",
		content: "Add the credential ID or verification link for industry certifications so recruiters can check them.",
		severity: "LOW",
	},
	{
		id: "CER-08",
		section: "certifications",
		content:
			'Remove certifications you have only enrolled in. If one is in progress, mark it "(in progress, expected Mon YYYY)".',
		severity: "MEDIUM",
	},
	{
		id: "CER-09",
		section: "certifications",
		content: "Make sure each certification is relevant to the jobs you are applying for; remove unrelated ones.",
		severity: "LOW",
	},
	{
		id: "CER-10",
		section: "certifications",
		content: "Use space efficiently: write each certification on one line (name, issuing body and year).",
		severity: "LOW",
	},
	// ── interests ──
	{ id: "HOB-01", section: "interests", content: "Keep only 3 or 4 hobbies.", severity: "MEDIUM" },
	{
		id: "HOB-02",
		section: "interests",
		content:
			"Remove passive hobbies such as watching TV, movies, web series or cricket matches. Write active hobbies you do yourself.",
		severity: "HIGH",
	},
	{
		id: "HOB-03",
		section: "interests",
		content:
			"Remove bike riding, web browsing, chatting with friends, social media and spending time with family. They do not count as hobbies on a resume.",
		severity: "HIGH",
	},
	{
		id: "HOB-04",
		section: "interests",
		content:
			'Remove work-related activities such as "updating technical skills", "following tech trends" or "exploring new gadgets". Hobbies are what you do in your spare time.',
		severity: "HIGH",
	},
	{
		id: "HOB-05",
		section: "interests",
		content:
			'Pick your hobbies from your achievements: if you won or played badminton, write "Playing badminton"; if you sing, dance, debate or write essays, use that.',
		severity: "MEDIUM",
	},
	{
		id: "HOB-06",
		section: "interests",
		content:
			"You can also add creative hobbies you genuinely pursue, such as sketching, painting, photography, travelling or event management.",
		severity: "LOW",
	},
	{
		id: "HOB-07",
		section: "interests",
		content: 'Be specific: "Playing chess" or "Landscape photography", not just "Sports" or "Music".',
		severity: "LOW",
	},
	{
		id: "HOB-08",
		section: "interests",
		content: "List only hobbies you actually pursue. Interviewers often ask about them in depth.",
		severity: "MEDIUM",
	},
	{
		id: "HOB-09",
		section: "interests",
		content:
			'Remove reading as a hobby unless you can name what you read and talk about it; if you keep it, be specific (e.g. "Reading biographies").',
		severity: "LOW",
	},
	{
		id: "HOB-10",
		section: "interests",
		content: "Write hobbies as short phrases on one line or as 3–4 bullets, not as sentences.",
		severity: "LOW",
	},
	// ── personal ──
	{
		id: "PER-01",
		section: "personal",
		content: "Remove the Personal Details section; that space is better used for your projects and achievements.",
		severity: "MEDIUM",
	},
	{
		id: "PER-02",
		section: "personal",
		content: 'Remove the fields you have left blank or marked "NA" (e.g. passport). Keep only details you have.',
		severity: "MEDIUM",
	},
	{ id: "PER-03", section: "personal", content: "Remove details you cannot provide proof for.", severity: "MEDIUM" },
	{
		id: "PER-04",
		section: "personal",
		content:
			"Remove religion, caste, marital status, height, weight and blood group. They are not relevant to the job.",
		severity: "MEDIUM",
	},
	{
		id: "PER-05",
		section: "personal",
		content: "Remove your Aadhaar, PAN and bank details. Never share ID numbers on a resume.",
		severity: "HIGH",
	},
	{
		id: "PER-06",
		section: "personal",
		content: "Keep only the useful details: date of birth, languages known and, if you have one, passport (valid).",
		severity: "LOW",
	},
	{
		id: "PER-07",
		section: "personal",
		content: "Remove your full home address; your city in the header is enough.",
		severity: "LOW",
	},
	{
		id: "PER-08",
		section: "personal",
		content: "Remove details already given in the header (email, phone, LinkedIn). Do not repeat them here.",
		severity: "LOW",
	},
	{
		id: "PER-09",
		section: "personal",
		content: 'Write languages known with the ability, e.g. "English, Telugu, Hindi (read, write, speak)", on one line.',
		severity: "LOW",
	},
	{
		id: "PER-10",
		section: "personal",
		content: "Use space efficiently: keep only the details that are needed, in 2–3 lines.",
		severity: "LOW",
	},
	// ── declaration ──
	{
		id: "DEC-01",
		section: "declaration",
		content: "Add the Declaration at the end of your 2-page resume, since you have space on page 2.",
		severity: "LOW",
	},
	{
		id: "DEC-02",
		section: "declaration",
		content:
			'Use the standard wording: "I hereby declare that the information furnished above is true and correct to the best of my knowledge and belief."',
		severity: "MEDIUM",
	},
	{
		id: "DEC-03",
		section: "declaration",
		content: "Add Place, Date (DD-MM-YYYY) and Signature (your name) below the declaration.",
		severity: "MEDIUM",
	},
	{
		id: "DEC-04",
		section: "declaration",
		content: "Write the date as DD-MM-YYYY and update it each time you send the resume.",
		severity: "LOW",
	},
	{
		id: "DEC-05",
		section: "declaration",
		content:
			"Remove the Declaration: it is pushing your resume onto an extra page. It is optional for on-campus drives.",
		severity: "MEDIUM",
	},
	{
		id: "DEC-06",
		section: "declaration",
		content: "Keep the Declaration as the last section of the resume.",
		severity: "LOW",
	},
	{
		id: "DEC-07",
		section: "declaration",
		content:
			"Keep the Declaration for government, PSU, bank and walk-in applications, or when the company's format asks for it.",
		severity: "LOW",
	},
];
