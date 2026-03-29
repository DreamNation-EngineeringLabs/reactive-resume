# Plan: Unified Placement Dashboard System

## Overall Flow

```
Monorepo Frontend                          Reactive Resume App
─────────────────                          ───────────────────
Faculty clicks
"Resume Builder" ──JWT token──────────────▶ /api/auth/sso?token=<jwt>
                                                │
                                                ├─ Verify JWT signature
                                                ├─ Create/sign-in local user (matched by email)
                                                ├─ Store cookies: role, organisationUnits, tenantId, organisationId
                                                ├─ Set source_url cookie
                                                │
                                                ▼
                                           /dashboard
                                                │
                                                ├─ Sidebar reads role cookie → shows only relevant tabs for the user role
                                                ├─ Sidebar footer shows: Name, Email, Org Unit Switcher
                                                ├─ Default org unit = first in organisationUnits array
                                                │
                                                ▼
                                           /dashboard/faculty (or /placement-officer, /admin, /feedback)
                                                │
                                                ├─ Reads active org unit from switcher
                                                ├─ Fetches students from eng-labs DB (by section + tenant)
                                                ├─ Matches students to resume app users (by email)
                                                ├─ Fetches resumes + evaluations + comments from resume db
                                                ├─ Renders dashboard with real data
                                                │
                                                ▼
                                           Faculty reviews, comments, evaluates
                                           PO adds suggestions, filters by section
                                           Admin sees org-wide metrics
                                           Student sees their own feedback
```

---

## JWT Token Payload (from monorepo)

```typescript
{
  // Already exists
  userId: string;              // Monorepo user ID (nanoid)
  email: string;               // Shared key between both apps
  name: string;                // Full name
  username: string;            // Username
  source_url: string;          // Redirect back URL

  // Needs to be added by monorepo
  role: string;                // "STUDENT" | "FACULTY" | "ADMIN" | "PLACEMENT_OFFICER"
  tenantId: string;            // organisation_entities ID
  organisationId: string;      // organisations ID
  organisationUnits: string[]; // Array of organisation_units IDs the user has access to
}
```

**Who sends what in `organisationUnits`:**

| Role | `organisationUnits` value |
|------|--------------------------|
| STUDENT | `unit they are related to` (their own section) |
| FACULTY | `[unit_id_1, unit_id_2, ...]` (assigned sections from monorepo) |
| PLACEMENT_OFFICER | `[]` empty — app fetches ALL sections from eng-labs DB |
| ADMIN | `[]` empty — app fetches ALL sections from eng-labs DB |

---

## User ID Mapping

- **Reactive Resume** creates its own users with UUIDs (`user.id`)
- **Eng-labs monorepo** uses nanoid IDs (`users.id`)
- **Shared key: `email`** — both systems enforce unique emails
- SSO creates local user with monorepo email → `local_user.email === monorepo_user.email`
- To find a student's resumes: eng-labs email → local user by email → resumes by local userId

---

## Eng-Labs Database Schema (Tables We Query)

### `users`
```sql
id                    -- nanoid PK
name                  -- Full name
email                 -- Unique, SHARED KEY with resume app
roll_number           -- Enrollment/roll number
type                  -- 'STUDENT' | 'FACULTY' | etc.
organisation_id       -- FK to organisations
tenant_id             -- FK to organisation_entities
enrollment_unit_id    -- FK to organisation_units (student's section)
uid                   -- Unique identifier
user_name             -- Username
```

### `organisation_units`
```sql
id                -- nanoid PK
organisation_id   -- FK to organisations
entity_id         -- FK to organisation_entities
tenant_id         -- FK to organisation_entities
parent_unit_id    -- FK to self (hierarchy)
type              -- e.g., "SECTION", "DEPARTMENT", "BATCH"
name              -- Display name (e.g., "CSE-A")
code              -- Short code
metadata          -- JSON
```

### `user_mappings`
```sql
id                      -- nanoid PK
user_id                 -- FK to users
organisation_id         -- FK to organisations
unit_id                 -- FK to organisation_units (nullable)
tenant_id               -- FK to organisation_entities
enrollment_unit_id      -- String (nullable)
unit_ids                -- String[] (array of unit IDs)
permissions             -- JSON
identification_unit_ids -- String[]
```

### Key SQL Queries

```sql
-- Get students in a section
SELECT u.id, u.name, u.email, u.roll_number, u.enrollment_unit_id
FROM users u
WHERE u.enrollment_unit_id = $1 AND u.type = 'STUDENT' AND u.tenant_id = $2
ORDER BY u.roll_number, u.name;

-- Get students across multiple sections (with section names)
SELECT u.id, u.name, u.email, u.roll_number, u.enrollment_unit_id,
       ou.name AS section_name, ou.code AS section_code
FROM users u
JOIN organisation_units ou ON u.enrollment_unit_id = ou.id
WHERE u.enrollment_unit_id = ANY($1) AND u.type = 'STUDENT' AND u.tenant_id = $2
ORDER BY ou.name, u.roll_number;

-- Get all sections for a tenant (for PO/Admin)
SELECT id, name, code, type, parent_unit_id
FROM organisation_units WHERE tenant_id = $1 ORDER BY name;

-- Get section details by IDs (for faculty's assigned sections)
SELECT id, name, code, type, parent_unit_id
FROM organisation_units WHERE id = ANY($1) ORDER BY name;

-- Get all faculty for a tenant (for admin dashboard)
SELECT id, name, email FROM users WHERE type = 'FACULTY' AND tenant_id = $1;

-- Match eng-labs students to resume app users (by email, in local DB)
SELECT r.id, r.name, r."userId", u.email
FROM resume r JOIN "user" u ON r."userId" = u.id
WHERE u.email = ANY($1);
```

---

## Sidebar: Org Unit Switcher

The sidebar footer currently shows only name + email. We add an **organisation unit switcher** above or below the user info.

```
┌─────────────────────────────┐
│  ◉ CSE-A  (active)         │  ← Currently viewing this section
│  ○ CSE-B                    │  ← Click to switch
│  ○ CSE-C                    │
├─────────────────────────────┤
│  👤 Prof. Sharma            │
│  sharma@college.edu         │
└─────────────────────────────┘
```

**Behavior:**
- **Faculty:** Shows only their assigned sections (from JWT `organisationUnits`). First one is selected by default.
- **PO:** Shows ALL sections (fetched from eng-labs DB) + an "All Sections" option at the top.
- **Admin:** Shows ALL sections + "All Sections" option (for section-wise drill-down).
- **Student:** No switcher shown (they belong to one section).

Switching the active org unit re-fetches the dashboard data for that section.

---

## Goals Mapped to Implementation

### STUDENT SIDE

| Goal | Status | What We Build |
|------|--------|---------------|
| Improve overall UX | 🔄 | Apply `skills/frontend.md` design rules to all dashboard pages |
| Resume versions | ⏳ DEFER | Not in this plan — requires resume data model changes |
| Primary resume | ⏳ DEFER | Depends on versioning |
| Mandatory GitHub & LinkedIn | ⏳ | Add validation in resume schema for `basics.profiles` — require GitHub + LinkedIn URLs |
| Validate projects on GitHub | ❌ BLOCKED | Requires external API integration — not in this plan |

### FACULTY SIDE

| Goal | What We Build | Details |
|------|--------------|---------|
| View all resumes in assigned section | **Section Metrics View** | Fetch students from eng-labs by `enrollment_unit_id`, match to local resumes by email, render in student resume table. Org unit switcher lets faculty switch sections. |
| Create checklist of requirements | **Checklist Creator UI** | Dialog/page where faculty creates a checklist with weighted items. Backend already exists (`orpc.resume.checklists.create`). |
| AI-based resume evaluation vs checklist | **AI Evaluate Button** | Button on each resume that calls AI service to auto-evaluate against a checklist. Uses existing `isAutoGenerated` flag on evaluations. |
| Manually review & add comments | **Comment Dialog** | Dialog showing existing comments + form to add new one with scope (Individual/Section). Backend exists (`orpc.resume.comments.create`). |
| Notify students of feedback | **Email on Comment** | When faculty publishes a comment, send email to student via existing SMTP integration. |
| Show diff view (old vs new) | ⏳ DEFER | Depends on resume versioning — not in this plan |
| Forward resumes to PO | **Forward Action** | Button that changes resume status to "Forwarded" + adds to `resume_history` with action=FORWARDED. PO dashboard shows forwarded resumes prominently. |

### PLACEMENT OFFICER SIDE

| Goal | What We Build | Details |
|------|--------------|---------|
| View all resumes across sections | **Same Section Metrics View** (scope=all) | Same component as faculty but with all sections. Section filter in sidebar to take one section at a time. |
| View faculty suggestions & diffs | **Comments Tab** | Show all faculty comments on each resume. Diff deferred (needs versioning). |
| Add suggestions at individual level | **Comment Dialog** (same as faculty) | PO uses same comment dialog to add feedback on individual resumes. |
| Add suggestions at section level | **Batch Comment** | "Add comment to section" button that creates a SECTION-scoped comment visible to all students in that org unit. |
| Ensure visibility to faculty & students | **Comment visibility** | Comments have `scope` field (INDIVIDUAL/SECTION). SECTION comments show to everyone in that section. All comments visible to faculty in their dashboard. |

### ADMIN SIDE

| Goal | What We Build | Details |
|------|--------------|---------|
| Build admin dashboard | **Enhanced Admin Page** | Already has stat cards. Add real data from eng-labs + local DB. |
| Section-wise view | **Section Health Table** | Table: Section Name, Faculty Assigned, Total Students, Resumes Created, Evaluated, Pending Count. Data from eng-labs sections + local resume counts. |
| Individual student timeline | **Student History View** | Expandable row or dialog showing `resume_history` entries for a student — when they created/updated resumes, when evaluated, when commented. Uses existing `getStudentHistory()`. |
| Faculty performance metrics | **Faculty Table** | Table: Faculty Name, Sections, Evaluations Done, Comments Made, Avg Review Time. Data from eng-labs faculty list + local evaluation/comment counts. |

### FUTURE PROSPECT (Not in this plan, documented for reference)

| Goal | Dependency |
|------|-----------|
| JD input | New feature — Admin/PO adds job descriptions |
| Evaluate resumes vs JD | AI + JD input |
| Auto-surface top 10 | JD evaluation + ranking |

---

## UI Design Rules (from `skills/frontend.md`)

All components must follow:
- **Squaricle Universe:** Cards `rounded-2xl`/`rounded-3xl`, buttons `rounded-xl`, icons in colored squaricle containers
- **No lines/borders:** Use spacing + background shifts for hierarchy
- **Spacious:** Dialogs `sm:max-w-[90vw]`, scrollable containers `flex-1 min-h-0`
- **Depth:** `bg-slate-50` background, `bg-white` cards, decorative watermark icons on stat cards
- **Tactile:** `active:scale-[0.97]` on buttons, `hover:-translate-y-1` on cards
- **Colors:** slate-900 headings, slate-500 body; Indigo=admin, Emerald=success, Rose=danger, Amber=warning
- **Forgiving validation:** Errors only on submit/blur, never on initial render

---

## Phase 1: SSO Token Extension & Cookie Storage

### 1.1 Extend SSO handler

**Modify:** `src/routes/api/auth/sso.ts`

Extend decoded JWT type to include new fields. Store as cookies:
```
user_role          = decoded.role
organisation_units = JSON.stringify(decoded.organisationUnits)
tenant_id          = decoded.tenantId
organisation_id    = decoded.organisationId
```
All cookies: `Path=/; SameSite=Lax; Max-Age=86400`

### 1.2 Create cookie reader utilities

**Create:** `src/utils/sso-context.ts`
```typescript
getUserRole(): string | null
getOrganisationUnits(): string[]
getTenantId(): string | null
getOrganisationId(): string | null
```

---

## Phase 2: Eng-Labs Database Integration

### 2.1 Add env variable

**Modify:** `src/utils/env.ts` — add `ENG_LABS_DATABASE_URL` (optional)
**Modify:** `.env.example` — add with comment

### 2.2 Create eng-labs client

**Create:** `src/integrations/eng-labs/client.ts`
- Raw `pg.Pool` (not Drizzle — we don't own the schema)
- `globalThis.__engLabsPool` for hot-reload safety
- Returns null if env not configured

### 2.3 Create eng-labs service

**Create:** `src/integrations/eng-labs/service.ts`

Functions with exact SQL (from queries listed above):
```typescript
getStudentsBySection(sectionId, tenantId): Promise<StudentInfo[]>
getStudentsBySections(sectionIds, tenantId): Promise<StudentInfo[]>
getAllSections(tenantId): Promise<Section[]>
getSectionsByIds(sectionIds): Promise<Section[]>
enrichByEmails(emails): Promise<Map<string, StudentInfo>>
getFacultyList(tenantId): Promise<FacultyInfo[]>
```

All return empty results if eng-labs DB not configured.

**Create:** `src/integrations/eng-labs/types.ts`
```typescript
export interface Section {
  id: string; name: string; code: string | null; type: string; parentUnitId: string | null;
}
export interface StudentInfo {
  id: string; name: string; email: string; rollNumber: string | null;
  sectionId: string; sectionName?: string;
}
export interface FacultyInfo {
  id: string; name: string; email: string;
}
```

**Create:** `src/integrations/eng-labs/index.ts` — barrel export

---

## Phase 3: Enhanced Backend Endpoints

### 3.1 Unified section-scoped dashboard endpoint (Faculty + PO)

**Modify:** `src/integrations/orpc/router/dashboard.ts`

```
GET /resumes/dashboard/sections
Input: {
  sectionIds: string[],          // From JWT cookie (faculty) or all (PO/admin)
  tenantId: string,              // From JWT cookie
  activeSectionId?: string,      // Currently selected section in switcher
}
```

**Logic:**
1. Get section details from eng-labs (`getSectionsByIds` or `getAllSections`)
2. Get students from eng-labs (`getStudentsBySections`)
3. Collect student emails → find matching local users → find their resumes
4. For each resume: count comments + get latest evaluation score
5. Compute per-section stats + aggregate stats
6. Get recent evaluations/comments enriched with student names

**Response:**
```typescript
{
  sections: [{ id, name, code, stats: { totalStudents, totalResumes, evaluatedResumes, completionRate, averageScore } }],
  students: [{ engLabsId, name, email, rollNumber, sectionId, sectionName, resumeAppUserId,
    resumes: [{ id, name, updatedAt, evaluationScore, commentCount, status }] }],
  aggregateStats: { totalStudents, totalResumes, totalEvaluations, totalComments, completionRate, averageScore },
  recentActivity: {
    recentEvaluations: [{ id, overallScore, evaluatedAt, studentName, resumeName }],
    recentComments: [{ id, content, createdAt, studentName, resumeName, authorName }]
  }
}
```

### 3.2 Enhanced admin dashboard endpoint

Add to existing `adminDashboard`:
- Faculty performance list (eng-labs `getFacultyList` + local eval/comment counts per faculty)
- Per-section health metrics (resume counts, eval rates per section)
- Student timeline data (from `resume_history`)

### 3.3 Forward-to-PO endpoint

**Add:** `POST /resumes/{resumeId}/forward`
- Creates a `resume_history` entry with action=FORWARDED
- Marks resume as forwarded (could add a `forwardedAt` column or use history)

### 3.4 Batch section comment endpoint

**Add:** `POST /resumes/comments/section`
- Input: `{ sectionId, tenantId, content }`
- Creates a SECTION-scoped comment visible to all students in that org unit

---

## Phase 4: Shared Frontend Components

### 4.1 Shared stat card

**Create:** `src/routes/dashboard/-components/stat-card.tsx`
- `StatCard` (extracted from admin, currently duplicated 3x)
- `CompletionRateCard` variant (with progress bar)
- `ScoreCard` variant (with color coding)

**Create:** `src/routes/dashboard/-components/score-helpers.ts`
- `getScoreColor()`, `getEvaluationBadgeClass()`

### 4.2 Section metrics view (shared by Faculty & PO)

**Create:** `src/routes/dashboard/-components/section-metrics-view.tsx`

Props: `{ sectionIds: string[], tenantId: string, activeSectionId: string }`

Renders: stat cards → student resume table (filtered by active section) → recent activity

### 4.3 Student resume table

**Create:** `src/routes/dashboard/-components/student-resume-table.tsx`

Columns: Student Name | Roll No. | Section | Resume | Last Updated | Score | Comments | Status | Actions
Actions: Review / Comment / Evaluate / Forward (faculty only)
Features: Search, sort, filter by status

### 4.4 Comment dialog

**Create:** `src/routes/dashboard/-components/comment-dialog.tsx`

- Shows existing comments on a resume
- Textarea + scope selector (Individual/Section)
- Calls `orpc.resume.comments.create`
- On publish: triggers student email notification

### 4.5 Evaluation form

**Create:** `src/routes/dashboard/-components/evaluation-form.tsx`

- Checklist selector (loads via `orpc.resume.checklists.list`)
- Checklist items with pass/fail toggles + score inputs
- Auto-computed overall score preview
- "AI Evaluate" button for auto-evaluation

### 4.6 Checklist creator

**Create:** `src/routes/dashboard/-components/checklist-creator.tsx`

- Faculty creates a new checklist with title, description
- Add/remove/reorder items with title, description, weight
- Calls `orpc.resume.checklists.create`

### 4.7 Recent activity panel

**Create:** `src/routes/dashboard/-components/recent-activity.tsx`

- 2-column: recent evaluations + recent comments with names/dates/scores

### 4.8 Student history timeline

**Create:** `src/routes/dashboard/-components/student-timeline.tsx`

- Expandable timeline view of `resume_history` entries
- Shows: Created, Updated, Commented, Evaluated, Forwarded events with timestamps and actors

---

## Phase 5: Sidebar Changes

### 5.1 Role-based tab filtering

**Modify:** `src/routes/dashboard/-components/sidebar.tsx`

Read `user_role` cookie and filter:

| Role | "My Space" | "Dashboards" |
|------|-----------|-------------|
| STUDENT | Resumes, My Info, ATS Score | Feedback Summary |
| FACULTY | Resumes, My Info, ATS Score | Faculty Dashboard |
| PLACEMENT_OFFICER | Resumes, My Info, ATS Score | PO Dashboard |
| ADMIN | Resumes, My Info, ATS Score | Admin Metrics, Faculty Dashboard, PO Dashboard |
| No cookie (fallback) | All | All |

### 5.2 Org unit switcher in sidebar footer

**Modify:** `src/routes/dashboard/-components/sidebar.tsx`

Add above the user info section in `SidebarFooter`:

```
┌─────────────────────────┐
│  Sections               │
│  ◉ CSE-A  (viewing)     │
│  ○ CSE-B                │
│  ○ CSE-C                │
├─────────────────────────┤
│  👤 Prof. Sharma        │
│  sharma@college.edu     │
└─────────────────────────┘
```

- **Faculty:** Shows sections from `organisation_units` cookie. First = default.
- **PO:** Fetches all sections from eng-labs DB via an ORPC endpoint. Shows "All Sections" + individual sections.
- **Admin:** Same as PO.
- **Student:** No switcher.

The active section ID is stored in a Zustand store or URL state so dashboard components can read it reactively.

---

## Phase 6: Dashboard Pages

### 6.1 Faculty Dashboard (`/dashboard/faculty/`)

**Modify:** `src/routes/dashboard/faculty/index.tsx`
- Read `organisationUnits` and `tenantId` from cookies
- Read active section from org unit switcher state
- Render: Header → StatCards → StudentResumeTable → RecentActivity
- Show "Create Checklist" button → opens ChecklistCreator dialog

### 6.2 Placement Officer Dashboard (`/dashboard/placement-officer/`)

**Modify:** `src/routes/dashboard/placement-officer/index.tsx`
- Read `tenantId` from cookie, fetch all sections
- Read active section from org unit switcher state
- Render: same as Faculty but with all sections and "Add Section Comment" button

### 6.3 Admin Dashboard (`/dashboard/admin/`)

**Modify:** `src/routes/dashboard/admin/index.tsx`
- Stat cards (Total Resumes, Total Evaluations, Completion Rate, Avg Score)
- Section health table (section name, faculty, students, resumes, eval rate, pending)
- Faculty performance table (name, sections, evaluations, comments, avg time)
- Student timeline (expandable rows with history)
- Recent activity panel

### 6.4 Student Feedback Dashboard (`/dashboard/feedback/`)

**Modify or create:** `src/routes/dashboard/feedback/index.tsx`
- Stat cards (My Resumes, Feedback Received, Average Score)
- Resume cards with expandable feedback (comments + evaluation breakdown)
- Status badges per resume (Not Reviewed / Evaluated / Has Comments)

---

## Phase 7: Student-Side Enhancements

### 7.1 Mandatory GitHub & LinkedIn

**Modify:** Resume schema validation (`src/schema/resume/`)
- Add validation requiring at least one GitHub and one LinkedIn profile in `basics.profiles`
- Show forgiving validation (only on submit, per `skills/frontend.md`)

---

## Phase 8: Email Notifications

### 8.1 Notify students on feedback

**Modify:** Comment creation handler in `src/integrations/orpc/router/resume.ts`
- After comment is created with status=PUBLISHED, send email to student
- Use existing SMTP integration (`src/integrations/email/`)
- Email contains: "You have new feedback on your resume [name] from [faculty name]"
- Link back to `/dashboard/feedback` to view

---

## Phase 9: Polish & Cleanup

- Update `GOALS.md` statuses for completed items
- Remove duplicated `StatCard` / helpers from individual dashboard files
- Run `pnpm typecheck` and `pnpm lint`
- Graceful fallback when `ENG_LABS_DATABASE_URL` not set (empty tables, no crash)
- Graceful fallback when role cookie missing (show all tabs)

---

## Files Summary

### New Files (14)
| File | Purpose |
|------|---------|
| `src/utils/sso-context.ts` | Cookie readers for role, sections, tenant |
| `src/integrations/eng-labs/client.ts` | Eng-labs DB connection (raw pg Pool) |
| `src/integrations/eng-labs/service.ts` | Student/section queries with exact SQL |
| `src/integrations/eng-labs/types.ts` | TypeScript interfaces |
| `src/integrations/eng-labs/index.ts` | Barrel export |
| `src/routes/dashboard/-components/stat-card.tsx` | Shared stat card (3 variants) |
| `src/routes/dashboard/-components/score-helpers.ts` | Score color helpers |
| `src/routes/dashboard/-components/section-metrics-view.tsx` | Shared Faculty/PO dashboard view |
| `src/routes/dashboard/-components/student-resume-table.tsx` | Student resume table with actions |
| `src/routes/dashboard/-components/comment-dialog.tsx` | Comment dialog (view + create) |
| `src/routes/dashboard/-components/evaluation-form.tsx` | Evaluation form with checklist |
| `src/routes/dashboard/-components/checklist-creator.tsx` | Checklist creation dialog |
| `src/routes/dashboard/-components/recent-activity.tsx` | Recent activity panel |
| `src/routes/dashboard/-components/student-timeline.tsx` | Student history timeline |

### Modified Files (10)
| File | Changes |
|------|---------|
| `src/routes/api/auth/sso.ts` | Store role, sections, tenant, org as cookies from JWT |
| `src/utils/env.ts` | Add `ENG_LABS_DATABASE_URL` |
| `.env.example` | Add `ENG_LABS_DATABASE_URL` |
| `src/integrations/orpc/router/dashboard.ts` | Add sections endpoint, enhance admin, add forward/batch-comment |
| `src/routes/dashboard/faculty/index.tsx` | Full rewrite with SectionMetricsView |
| `src/routes/dashboard/placement-officer/index.tsx` | Full rewrite with SectionMetricsView |
| `src/routes/dashboard/admin/index.tsx` | Add faculty table, section health, student timeline |
| `src/routes/dashboard/feedback/index.tsx` | Student feedback view with expandable resume cards |
| `src/routes/dashboard/-components/sidebar.tsx` | Role-based tabs + org unit switcher in footer |
| `GOALS.md` | Update statuses |

---

## Verification

1. `pnpm typecheck` — no type errors
2. `pnpm lint` — Biome passes
3. Manual testing with `pnpm dev`:
   - SSO redirect with extended JWT → verify all cookies set
   - Sidebar shows only relevant tabs per role
   - Sidebar footer shows org unit switcher with section names
   - Switching org unit refreshes dashboard data
   - `/dashboard/faculty/` — stat cards, student table, comment, evaluate, forward, create checklist
   - `/dashboard/placement-officer/` — same as faculty but all sections, batch section comments
   - `/dashboard/admin/` — org metrics, section health table, faculty performance, student timelines
   - `/dashboard/feedback/` — student's resumes with feedback, evaluation breakdown
   - Email sent when faculty publishes a comment
   - Graceful fallback when `ENG_LABS_DATABASE_URL` not set
   - Graceful fallback when role cookie missing
