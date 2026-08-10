# QSL Project-Management Platform — Implementation Plan

**Status:** Draft for review · **Owner:** QSL management · **Prepared:** Aug 2026

This plan turns the current maintenance-reporting app into a **project-centred**
management system, aligned to QSL's ISO 9001 and ISO/IEC 17025 document control.
It is phased so we ship value continuously and keep the app stable in production.

---

## 1. Principles

1. **The Project is the single source of truth.** Every report, task, request,
   advance, cost and certificate hangs off a Project.
2. **Everything is signed and audited.** Every create / submit / approve records
   the user's electronic signature and an immutable audit entry (already the case
   for reports — we extend it to projects, MRFs and advances).
3. **Money is need-to-know.** Project value, budget and cost roll-ups are visible
   only to management and explicitly authorised users — enforced server-side, not
   just hidden in the UI.
4. **Sync boundaries are explicit.** Stores/Procurement/inventory (point 6) and
   accounting (point 7) are **external systems**. We build the internal workflow
   and audit now, and integrate over their APIs later — the app never becomes the
   accounting or inventory system of record.
5. **Numbering follows QSL's controlled scheme** (section 5), so every project,
   form, report and certificate number is traceable.
6. **Mobile-first field work, offline-tolerant**, matching the existing app.

---

## 2. Current state (what we reuse)

| Capability | Today | Reused for |
|---|---|---|
| Two-stage approval + e-signature + audit trail | Reports (`PENDING_SUPERVISOR → PENDING_MANAGER → APPROVED`) | TR TM→PM, MRF & advance approvals |
| `Project`, `Task`, `Contract` models | Exist (Project is thin) | The Project spine |
| Document numbering | `Counter` model + per-type serials | ISO numbering |
| Templated report generation | 8 PDF documents | Technical / progress / completion reports |
| Client / Site / Weighbridge registry | Full CRUD | Project client/site/asset |
| Mobile field capture | Reports, tasks, quotations | MRFs, advances, task updates |
| RBAC | Roles incl. `PROJECT_MANAGER`, `TECHNICAL_MANAGER` | Approval routing & money visibility |

**Gap:** there is no rich Project entity, no MRF, no advances/expenses, no
budget-vs-actual, and approvals are routed by chosen email rather than by role.

---

## 3. Target data model (additions)

New/expanded Prisma models (final field lists confirmed at build time):

- **Project** (expand) — `number` (ISO), `type` (enum), `scope`, `status`,
  `clientId`, `site`, `responsibleManagerId`, `team` (users), `startDate`,
  `endDate`, `sourceDocType` (LPO | BOQ | CONTRACT | SERVICE_REQUEST) +
  `sourceRef`/attachment, `value`, `budget` (money — gated), `createdBy`.
- **ProjectType** (enum) — `CALIBRATION`, `REPAIR_SERVICE`, `INSTALLATION`,
  `ENGINEERING`, `TRAINING`, `INTERNAL`.
- **ProjectDocument** — LPO/BOQ/contract/service-request attachments (image/PDF,
  size-validated like existing uploads).
- **Milestone** — project schedule items (name, due, status, %).
- **MaterialRequest (MRF)** — `number`, `projectId`, `taskId?`, line items,
  `status` (DRAFT → SUBMITTED → APPROVED/REJECTED → ISSUED), approver trail,
  `syncedToStores` flag.
- **Advance** — `number`, `projectId`, `type` (FUEL | PER_DIEM | CASUAL_LABOUR |
  EMERGENCY_MATERIALS | OTHER), amount, `status` (REQUESTED → APPROVED → PAID →
  RETIRED), retirement receipts, `syncedToAccounts` flag.
- **Report / Task** (link) — add `projectId` so field work and generated reports
  roll up to the project.

All money fields are returned by the API **only** to authorised roles.

---

## 4. Approvals & electronic signature

The existing engine (`canAct` → `applyDecision`) generalises to a small
**approval-chain per document type**:

- **Technical Report (TR01) — role-locked (confirmed):**
  1. **Technical Manager** review, then 2. **Project Manager** approval.
  Stage 1 can be actioned **only** by a user holding `TECHNICAL_MANAGER`; stage 2
  **only** by `PROJECT_MANAGER`. The filer picks a specific TM and PM from those
  role lists; the PDF and emails read "Technical Manager review" /
  "Project Manager approval".
- Other reports keep their current chains (single-stage for WB01–03; the generic
  two-stage elsewhere).
- MRF and Advance get their own chains (section 6/7).

Every stage writes a `TrailEvent` (who, role, decision, comment, timestamp) — the
electronic signature and audit record.

---

## 5. ISO document-numbering scheme

Unify on QSL's controlled pattern. Two families:

- **Controlled forms** (procedure-linked): `QSL/<DEPT>/<NNN>/<FORM>` — as already
  used (`QSL/QP/013/CRF-NAWI`, `QSL/QP/004/CSSF`, `QSL/HR/TFB`).
- **Records** (instances): `QSL-<TYPE>-<YYYY>-<NNNNN>`, e.g.
  - Project `QSL-PRJ-2026-014`
  - Technical Report `QSL-TR01-2026-00001` (already)
  - Calibration certificate `QSL-CAL-2026-00087`
  - MRF `QSL-MRF-2026-00042` (or `…-PRJ014-03` scoped to the project)
  - Advance `QSL-ADV-2026-00031`

Sequences are allocated atomically by the existing `Counter` so numbers are gap-
free and unique. A short **document register** view lists every controlled number
for auditors.

---

## 6. RBAC & visibility matrix (key rows)

| Data | ADMIN | PROJECT_MANAGER | TECHNICAL_MANAGER | SUPERVISOR | TECHNICIAN/ENGINEER | CLIENT |
|---|---|---|---|---|---|---|
| Project (non-financial) | R/W | R/W | R | R | R (assigned) | R (own) |
| Project value / budget / cost roll-up | R | R | – | – | – | – |
| TR approval stage 1 | – | – | ✅ act | – | – | – |
| TR approval stage 2 | – | ✅ act | – | – | – | – |
| MRF approve | R/W | ✅ | ✅ | – | raise | – |
| Advance approve | ✅ | ✅ | – | – | raise | – |
| Field updates / task status | ✅ | ✅ | ✅ | ✅ | ✅ (assigned) | – |

(Finalised against QSL's org chart before build.)

---

## 7. Phased roadmap

### Phase 1 — Project spine + TR approval  *(now, ~days)*
- **TR01 approval → Technical Manager then Project Manager, role-locked** (web
  form, mobile form, decision emails, PDF status labels, `canAct`).
- Expand **Project**: number, type, scope, status, responsible manager, team,
  dates, source doc (LPO/BOQ/contract/service request) + attachment, **value &
  budget (management-only)**.
- **Projects module**: management creates/edits projects; list + detail; ISO
  project numbering.
- **Link reports & tasks to a project** (optional field now, required later).
- Migration + **admin-triggered backfill** (seed doesn't run on deploy).
- **Acceptance:** a manager creates a project with an LPO, assigns a team, and a
  filed Technical Report routes TM→PM and appears under the project; value/budget
  invisible to non-managers (verified via API, not just UI).

### Phase 2 — Requests, advances & budget  *(~1–2 weeks)*
- **MRF module** — raise from mobile against a project/task; role-based approval;
  status to ISSUED; PDF; audit. (Internal only; `syncedToStores` flag reserved.)
- **Advances/expenses** — request → approve → pay → **retire** with receipts;
  linked to project; audit. (`syncedToAccounts` flag reserved.)
- **Budget vs actual** — roll up MRF + advances + other costs against budget on
  the project dashboard (management-only). Point 11.
- **Schedule/milestones** — milestones + task rollup per project; optional
  import from an MS-Project/BOQ CSV. Point 5 (internal version).
- **Acceptance:** on a live project, approved MRFs and advances accumulate and the
  budget-vs-actual bar reflects them in real time.

### Phase 3 — External synchronisation  *(later, scoped separately)*
- **Stores / Procurement / inventory** sync for approved MRFs (point 6).
- **Accounting** sync for advance approval/payment/retirement (point 7).
- MS-Project schedule import/export (point 5, full).
- Each integration is its own mini-project gated on the third-party system's API,
  credentials and data-mapping sign-off. The internal workflow from Phase 2 keeps
  working with or without the integration (flag flips from "internal" to "synced").

---

## 8. Cross-cutting

- **Audit & e-signature** on every project/MRF/advance action (extends
  `recordAudit` + `TrailEvent`).
- **Notifications & emails** reuse the existing notify/email libs.
- **Mobile parity** for field actions (task updates, MRF, advances, photos/GPS).
- **Migrations**: additive columns/models; backfills are **admin-triggered**
  endpoints (the deploy runs `prisma migrate deploy` but not the seed).
- **Security**: money endpoints role-checked server-side; uploads size/type
  validated (existing `lib/upload.js`); rate limits unchanged.

---

## 9. Decisions needed from QSL before Phase 1 build

1. **Team model** — is a project "team" a list of users, or roles per project
   (e.g. one responsible TM + PM + technicians)?
2. **Money visibility** — exactly which roles see value/budget/cost? (Default:
   ADMIN + PROJECT_MANAGER only.)
3. **Numbering** — confirm the record patterns in §5 (esp. whether MRF/Advance
   numbers are global or project-scoped).
4. **TR approvers** — must every TR pick a *specific* named TM and PM, or route to
   *any* holder of that role (first to act decides)?
5. **Source documents** — which of LPO / BOQ / Contract / Service Request are
   mandatory to open a project?
6. **Client visibility** — should clients see project status/progress, or only
   their reports/quotations as today?

---

## 10. Risks & sequencing notes

- Keep production stable: all changes are additive; Projects are optional until
  Phase 1 lands, then progressively required.
- External integrations (Phase 3) are the largest unknowns and depend on QSL's
  accounting/inventory vendors — do not block Phases 1–2 on them.
- Backfilling existing reports/tasks to projects is a one-time admin action;
  historical records without a project stay valid.
