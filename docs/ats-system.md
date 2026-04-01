# ATS Scoring System — Technical Reference

## Overview

The ATS (Applicant Tracking System) scorer evaluates a student's resume across five deterministic categories and one optional AI-powered category. Each category has a defined maximum score. Scores are combined into an **overall 0–100 rating**.

| Category | Max Score (no JD) | Max Score (with JD) | Method |
|---|---|---|---|
| Keyword Match | 25 | 25 | Rule-based |
| Impact & Metrics | 20 | 20 | Rule-based |
| Structure | 20 | 20 | Rule-based |
| Formatting | 15 | 15 | Rule-based |
| Brevity | 10 | 10 | Rule-based |
| Tailoring | — | 10 | LLM-based (GPT-4o) |
| **Total** | **90** | **100** | |

Overall score = `(rawScore / maxPossible) * 100`, where `maxPossible` is 90 without a job description or 100 with one.

---

## Category Breakdown

### 1. Keyword Match (25 pts) — `keyword-match.ts`

Measures how well the resume covers industry-relevant skills and technologies.

**Without a job description (General ATS mode):**
- The scorer matches resume content against a built-in skills taxonomy (languages, frameworks, tools, platforms).
- Target: **20 unique industry skills** for a full score.
- Scoring tiers: `score = round(min(count/20, 1) × 25)`

| Skills found | Approximate score | Feedback |
|---|---|---|
| < 5 | < 7 | Very poor — add a Skills section with specific tools |
| 5–9 | 7–11 | Developing — missing technical depth |
| 10–14 | 12–18 | Good — keep adding frameworks/platforms |
| 15–20 | 19–25 | Strong keyword density |

**With a job description:**
- KW-1 (15 pts): Coverage ratio — what % of JD's required keywords appear in the resume.
- KW-2 (10 pts): Contextual usage — keywords that appear inside bullet descriptions (not just the skills list).

**Common student mistakes caught:**
- Listing skills like "Python" in the skills section but never demonstrating them in experience bullets.
- Relying solely on soft skills (e.g., "communication", "teamwork") with no technical vocabulary.

---

### 2. Impact & Metrics (20 pts) — `impact-metrics.ts`

Measures the quality and specificity of experience/project descriptions.

**Minimum content gate:** A resume must have at least **4 bullets** across experience and projects before this category can be scored. Fewer than 4 bullets returns 0/20.

**Content penalty:** Resumes with 4–5 bullets receive a proportional penalty (score × `bullets/6`) to reflect insufficient depth.

| Rule | Points | What it checks |
|---|---|---|
| IM-1: Action verb usage | 5 | What % of bullets start with a strong action verb (e.g., "Developed", "Engineered", "Optimised") |
| IM-2: Quantified metrics | 5 | What % of bullets include a number, percentage, scale, or dollar value |
| IM-3: XYZ formula | 5 | What % of bullets follow "Accomplished X, as measured by Y, by doing Z" (verb + metric + method) |
| IM-4: No weak phrases | 3 | Penalises "responsible for", "worked on", "assisted with", "various", etc. |
| IM-5: No vague/placeholder content | 2 | Detects bullets that are too short (< 6 words) or clearly placeholder text |

**IM-5 vague content patterns flagged:**
- "a simple project" / "a basic app" / "a sample website"
- "developed and maintained a sample website"
- Bullets shorter than 6 words

**Best practice (XYZ formula example):**
> "Reduced API response time by 40% by implementing Redis caching on 3 high-traffic endpoints."

---

### 3. Structure (20 pts) — `structure.ts`

Checks the presence *and quality* of required resume sections.

| Rule | Points | What it checks |
|---|---|---|
| SC-1: Required sections + content depth | 8 | Presence of Experience, Education, Skills, Projects — AND meaningful content within each |
| SC-2: Recommended sections | 4 | Summary and Profiles/Links present |
| SC-3: Reverse chronological order | 4 | Experience, Education, Projects listed newest-first |
| SC-4: Contact information complete | 4 | Name, email, phone, location all filled |

**SC-1 two-tier check (key improvement):**

The section must both *exist* and *have real content*:
- **Experience**: at least one item with ≥ 1 bullet of at least 5 words — a blank description line counts as missing.
- **Projects**: at least one item with a description of ≥ 8 words — "a simple project" will fail this check.
- **Education**: at least one item with an institution name AND a degree/area field — "Carmel High School" alone (no degree) fails.
- **Skills**: at least one skill with a name or keywords.

A section present but without substantive content incurs a -1 pt penalty per thin section (up to 4 pts total in Tier 2).

---

### 4. Formatting (15 pts) — `formatting.ts`

Checks ATS compatibility of the resume's visual formatting choices.

| Rule | Points | What it checks |
|---|---|---|
| FM-1: ATS-safe font | 4 | Body/heading font is in the approved list (Arial, Calibri, Inter, Roboto, etc.) |
| FM-2: No profile picture | 2 | Profile picture hidden (ATS parsers cannot read images) |
| FM-3: ATS-safe template | 4 | Template verified to produce clean, parseable HTML |
| FM-4: Standard date formats | 4 | Dates use "Jan 2023", "2023", or "Present" — not "3 months" or freeform text |
| FM-5: No emojis | 1 | No emoji characters in any visible text field |

**Common failures:**
- Choosing a two-column or heavily styled template (loses FM-3 points).
- Writing dates like "3 months" instead of "Jan 2025 – Present".
- Using a decorative font not in the ATS-safe list.

---

### 5. Brevity (10 pts) — `brevity.ts`

Checks that the resume is concise, focused, and well-structured at the bullet level.

**Minimum content gate:** Resume must have ≥ 1 bullet and ≥ 100 total words; otherwise 0/10.

| Rule | Points | What it checks |
|---|---|---|
| BR-1: Bullet word count | 2 | Bullets should not exceed 30 words each |
| BR-2: Bullets per role | 2 | Each experience entry should have 3–6 bullets (min raised from 2 to 3) |
| BR-3: Page count | 2 | Resume should fit in 1 page (2 pages gets 1 pt, 3+ gets 0) |
| BR-4: No filler words | 1 | Avoids "very", "really", "truly", "clearly", etc. |
| BR-5: Word count | 2 | Total resume word count in range 400–675 words |
| BR-6: Bullet density | 1 | Total bullet count in range 12–20 bullets |

**BR-2 change:** Minimum bullets per role raised from 2 to 3. Having only 1 bullet per job entry is penalised in BR-2 (0/2).

---

### 6. Tailoring (10 pts, JD-mode only) — `tailoring.ts`

Only runs when a job description is provided. Uses GPT-4o (with heuristic fallback) to evaluate:

| Rule | Points | What it checks |
|---|---|---|
| TR-1: Title alignment | 3 | Resume headline vs JD job title |
| TR-2: Summary relevance | 3 | Summary mentions the target role and JD skills |
| TR-3: Experience relevance | 2 | Experience bullets demonstrate JD-required skills |
| TR-4: Education match | 2 | Education meets JD requirements |

---

## How Suggestions Are Generated

After scoring, the suggestion engine (`suggestion-generator.ts`) converts low-scoring rules into actionable recommendations:

- **Critical** (red): Rules with score = 0 on high-weight categories (e.g., no metrics, missing sections).
- **Warning** (amber): Rules with partial scores or single violations.
- **Info** (blue): Rules that passed but have room for improvement.

Each suggestion may include auto-applicable patches (JSON-patch operations) to directly edit the resume.

---

## Score Interpretation

| Score | Rating | Meaning |
|---|---|---|
| 80–100 | Excellent | Ready for most ATS systems; minor polish only |
| 65–79 | Good | Some improvements needed but competitive |
| 50–64 | Fair | Notable gaps — add metrics and section depth |
| 35–49 | Poor | Significant work required; likely filtered by ATS |
| 0–34 | Very Poor | Resume will not pass ATS screening |

---

## Improvements Made (April 2026)

### Problem
The previous ATS scorer awarded high structure scores to resumes that had sections present but with placeholder or empty content. Example: a resume with one experience bullet ("Developed and maintained a sample website for the organization"), a project called "Easyfind — a simple project", and education showing just "Carmel High School" (no degree) could score 17/20 on Structure — masking critical quality issues from students.

### Changes

#### Structure (`structure.ts`)
- **SC-1 now two-tier**: Previously only checked section *presence*. Now also checks *content depth*:
  - Experience items must have bullets with ≥ 5 words.
  - Project items must have descriptions with ≥ 8 words.
  - Education items must include institution + degree or area.
  - Each thin-content section costs -1 pt (up to 4 pts total deduction in Tier 2).

#### Impact & Metrics (`impact-metrics.ts`)
- **Minimum bullet threshold raised**: From 3 to 4 bullets before the category can be evaluated.
- **IM-4 redistributed**: Reduced from 5 pts to 3 pts to make room for the new IM-5 rule.
- **IM-5 (new): Vague/placeholder content detection**: Flags bullets that are:
  - Shorter than 6 words.
  - Match patterns like "a simple project", "a sample website", "a basic app", "developed and maintained a sample X".
- **Weak phrase list expanded**: Added "various", "multiple", "different", "several" — common padding words.

#### Brevity (`brevity.ts`)
- **BR-2: Minimum bullets per role raised from 2 to 3**: A single-bullet experience entry is now penalised.

#### Keyword Match (`keyword-match.ts`)
- **No-JD target raised from 15 to 20 skills**: Makes it harder to score well without a genuine technical skills section. Tiered feedback messages guide students toward the right level.

### Impact on Example Resume
The resume that previously scored 44/100 would now score approximately 28–32/100 under the new rules, accurately reflecting that it needs significant work before it is ready for placement.

---

## Adding New Rules

1. Add the rule function in the appropriate `rules/*.ts` file.
2. Export helpers needed by `suggestion-generator.ts`.
3. Add a corresponding `Suggestion` in `suggestion-generator.ts` for actionable feedback.
4. Update this document.

The total max per category must remain stable (25, 20, 20, 15, 10) to keep the overall scale consistent.
