# Polymath Resume Platform — Goals & Progress

**Last Updated:** 2026-03-27

---

## STUDENT SIDE

| Goal | Status | Notes | Commit |
|------|--------|-------|--------|
| Improve overall UX (audit + redesign) | 🔄 In Progress | Resume builder UI refined with new toolbar (38f2d51) | 38f2d517 |
| Add option to create new resume versions | ⏳ Planned | Core resume management exists, need versioning feature | — |
| Allow declaring one version as "primary resume" | ⏳ Planned | Depends on versioning feature | — |
| Make GitHub & LinkedIn profile fields mandatory | ⏳ Planned | Requires schema update & validation | — |
| (Future) Validate projects exist on GitHub/LinkedIn | ❌ Blocked | Requires GitHub/LinkedIn API integration | — |

---

## FACULTY SIDE

| Goal | Status | Notes | Commit |
|------|--------|-------|--------|
| View all resumes in assigned section | ✅ Done | Faculty dashboard implemented | 38f2d517 |
| Create checklist of requirements | ⏳ Planned | Requires new checklist/rubric feature | — |
| AI-based resume evaluation vs checklist | ⏳ Planned | Depends on checklist feature | — |
| Manually review & add comments | ⏳ Planned | Requires comments/feedback system | — |
| Notify students of feedback/comments | ⏳ Planned | Depends on comments system + email integration | — |
| Show diff view (old vs new resumes) | ⏳ Planned | Requires version tracking | — |
| Forward resumes to Placement Officer | ⏳ Planned | Requires PO handoff workflow | — |

---

## PLACEMENT OFFICER SIDE

| Goal | Status | Notes | Commit |
|------|--------|-------|--------|
| View all resumes across all sections | ✅ Done | PO dashboard implemented | 38f2d517 |
| View faculty suggestions & diffs | ⏳ Planned | Depends on faculty comment/diff features | — |
| Add suggestions at individual resume level | ⏳ Planned | Requires feedback system | — |
| Add suggestions at class/section level | ⏳ Planned | Batch feedback feature | — |
| Ensure visibility to faculty & students | ⏳ Planned | Depends on feedback system | — |

---

## ADMIN SIDE

| Goal | Status | Notes | Commit |
|------|--------|-------|--------|
| Build admin dashboard | ✅ Done | Admin dashboard implemented | 38f2d517 |
| Section-wise view (faculty assigned, pending count) | 🔄 In Progress | Dashboard foundation exists, needs metrics | 38f2d517 |
| Individual student timeline & progress history | 🔄 In Progress | Requires activity tracking | 38f2d517 |
| Faculty performance metrics | 🔄 In Progress | Requires analytics infrastructure | 38f2d517 |

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
- Dashboard views for all roles (38f2d517)
- Resume builder with toolbar (38f2d517)
- Session/auth improvements across all flows

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
