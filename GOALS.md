# Polymath Resume Platform — Goals & Progress

**Last Updated:** 2026-03-29

---

## STUDENT SIDE

| Goal | Status | Notes | Commit |
|------|--------|-------|--------|
| Improve overall UX (audit + redesign) | 🔄 In Progress | Resume builder UI refined with new toolbar (38f2d51) | 38f2d517 |
| Add option to create new resume versions | ⏳ Planned | Core resume management exists, need versioning feature | — |
| Allow declaring one version as "primary resume" | ⏳ Planned | Depends on versioning feature | — |
| Make GitHub & LinkedIn profile fields mandatory | ✅ Done | Requires schema update & validation | — |
| (Future) Validate projects exist on GitHub/LinkedIn | ❌ Blocked | Requires GitHub/LinkedIn API integration | — |

---

## FACULTY SIDE

| Goal | Status | Notes | Commit |
|------|--------|-------|--------|
| View all resumes in assigned section | ✅ Done | Faculty dashboard with eng-labs integration, section tabs, student resume table | — |
| Create checklist of requirements | ✅ Done | Checklist creator dialog with weighted items | — |
| AI-based resume evaluation vs checklist | ⏳ Planned | Depends on AI integration | — |
| Manually review & add comments | ✅ Done | Comment dialog with Individual/Section scope | — |
| Notify students of feedback/comments | ✅ Done | Email sent to student's eng-labs email on comment creation | — |
| Show diff view (old vs new resumes) | ⏳ Planned | Requires version tracking | — |
| Forward resumes to Placement Officer | ✅ Done | Forward button adds FORWARDED entry to resume history | — |

---

## PLACEMENT OFFICER SIDE

| Goal | Status | Notes | Commit |
|------|--------|-------|--------|
| View all resumes across all sections | ✅ Done | PO dashboard with all sections, filter tabs, student resume table | — |
| View faculty suggestions & diffs | 🔄 In Progress | Faculty comments visible; diff requires versioning | — |
| Add suggestions at individual resume level | ✅ Done | Comment dialog (same as faculty) | — |
| Add suggestions at class/section level | ✅ Done | Section-scoped comments via scope selector | — |
| Ensure visibility to faculty & students | ✅ Done | Comments with INDIVIDUAL/SECTION scope visible to all relevant users | — |

---

## ADMIN SIDE

| Goal | Status | Notes | Commit |
|------|--------|-------|--------|
| Build admin dashboard | ✅ Done | Admin dashboard with shared StatCard components | — |
| Section-wise view (faculty assigned, pending count) | ✅ Done | Section health table with student/resume/evaluation counts per section | — |
| Individual student timeline & progress history | ✅ Done | StudentTimeline component using resume_history | — |
| Faculty performance metrics | ✅ Done | Faculty performance table with evaluations/comments counts | — |

---

## FUTURE PROSPECT

| Goal | Status | Notes | Dependency |
|--------|--------|-------|-----------|
| Add JD (Job Description) input | ⏳ Planned | Admin/PO feature | None |
| Evaluate all resumes vs JD | ⏳ Planned | AI evaluation against JD | AI integration + JD input |
| Auto-surface top 10 resumes | ⏳ Planned | Ranking & filtering | JD evaluation |

---

## LEGEND

- ✅ **Done** — Feature fully implemented and deployed
- 🔄 **In Progress** — Currently being worked on
- ⏳ **Planned** — Approved for development, not yet started
- ❌ **Blocked** — External dependency or requires decision
- 🔴 **On Hold** — Paused or deprioritized

---

## NOTES

### Implemented Infrastructure
- User roles: Student, Faculty, Placement Officer, Admin
- Dashboard views for all roles with real eng-labs data integration
- Resume builder with toolbar (38f2d517)
- Session/auth improvements across all flows
- SSO token extended with role, organisationUnits, tenantId, organisationId
- Sidebar role-based filtering + org unit switcher
- Shared dashboard components (StatCard, SectionMetricsView, StudentResumeTable, etc.)
- Eng-labs DB integration for student/section data
- Faculty/PO unified dashboard with section tabs, student resume table, comment/evaluate actions
- Admin dashboard with section health table and faculty performance metrics
- Checklist creator, comment dialog, evaluation form

### Key Dependencies
- **Version tracking** → needed for: resume versions, primary resume selection, diff views
- **Comments/feedback system** → needed for: faculty reviews, PO suggestions, student notifications
- **Activity logging** → needed for: student timelines, faculty metrics, audit trails
- **GitHub/LinkedIn APIs** → needed for: profile validation, project verification
- **Advanced analytics** → needed for: faculty performance, admin metrics

---

## HOW TO UPDATE

1. When starting work on a goal: change status to `🔄 In Progress`
2. When completing: change to `✅ Done` and add commit hash
3. When blocked: change to `❌ Blocked` with reason
4. Update timestamp in "Last Updated" at top
