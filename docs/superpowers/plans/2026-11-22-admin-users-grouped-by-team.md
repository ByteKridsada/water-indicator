# Admin Users Page: Grouped by Team, Click-to-Edit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On `/admin/users`, show users grouped by team, and let an admin click a row to edit that user's details in a dialog.

**Architecture:** Rework the existing `AdminUsersPage` in place. The flat list becomes one section per team (plus a "no team" section). The inline role/team/status controls move into a new `UserEditDialog` that opens when a row is clicked. The backend `PATCH /users/:id` gains `first_name` and `last_name`.

**Tech Stack:** Express + zod + PGlite/pg (backend, `node --test`), React + Vite (frontend, no tests).

**Spec:** None. The request was one paragraph: "When login as an admin, the web allow a user to access users page that shows a user list group by team. The admin can click each row to edit user details." The decisions below fill the gaps and need your confirmation (see "Assumptions to confirm").

## Assumptions to confirm (CLAUDE.md: don't pick defaults silently)

Your clarifying questions were dismissed, so these are proposals. Reject any of them before implementation starts.

1. **Rework in place** rather than keeping inline dropdowns next to click-to-edit. Team management (rename/delete/create chips) stays as is.
2. **Editable fields:** first name, last name, team, role, active status. **Email is not editable** because it is the login identifier. Adding it later needs uniqueness and session handling.
3. **Edit UI:** a modal `<dialog>` with Save/Cancel. No new route.
4. **Grouping:** "ไม่มีทีม" section first (only if non-empty), then every team alphabetically in Thai collation, including empty teams.
5. **Self-lockout:** the existing API lets an admin demote or deactivate themselves, including the last admin. This plan does not change that. Say if you want a guard.

## Global Constraints

- API error messages and all UI text in Thai; code comments, `console.*` and thrown `Error` messages in English.
- Authorization stays in `requireAdmin`; the server never accepts `role`/`team_id` where it assigns them (here they stay admin-only on this route).
- Parameterized SQL only, through `backend/src/db.js`; SQL must work on PGlite (PG 18) and Postgres 16.
- Add API calls in `frontend/src/api/users.js` only; pages never call axios directly. `apiClient` puts the server message in `err.message`.
- Styling: tokens at the top of `frontend/src/index.css`; teal is brand/data, indigo is interaction/selection. No green/amber/red status colors, except existing `--danger` for destructive affordances.
- Keep existing owner comments, including the React-vs-Swift/iOS ones, in `AdminUsersPage.jsx`.
- `docs/api-spec.md` §4 is updated in the same change as the API.

## Review Focus

1. **More than 100 users:** the API caps `limit` at 100, so a single `listUsers` call silently drops users from their groups. Expect every user to appear. (Task 2)
2. **Blank or whitespace-only names in PATCH:** `{"first_name": "   "}` must be rejected with a Thai 400, not stored as empty. (Task 1)
3. **Accounts with null names** (seeded admin, older accounts): the dialog must open and save without forcing the admin to invent a name; saving only a team change must not wipe or require names. (Tasks 1, 3)
4. **Failed save:** the dialog stays open with the server's Thai message and the row is unchanged. (Task 3)
5. **Team deleted/renamed while the dialog is open or after:** group headings and the dialog's team select reflect the current team list. (Task 3)

---

## File Structure

- Modify `backend/src/routes/users.js`: extend `patchBody` and the update loop.
- Modify `backend/tests/api.test.js`: tests for the new PATCH fields.
- Modify `docs/api-spec.md` §4: document the new fields.
- Modify `frontend/src/api/users.js`: add `listAllUsers`.
- Create `frontend/src/lib/groupUsers.js`: pure grouping function.
- Create `frontend/src/components/UserEditDialog.jsx`: the edit modal.
- Modify `frontend/src/pages/AdminUsersPage.jsx`: grouped list, row click, dialog wiring.
- Modify `frontend/src/index.css`: group heading, clickable row, dialog styles.

---

### Task 1: PATCH /users/:id accepts first_name and last_name

**Files:**
- Modify: `backend/src/routes/users.js` (`patchBody`, the `for (const field of ...)` loop)
- Modify: `backend/tests/api.test.js` (next to the existing PATCH test near line 185)
- Modify: `docs/api-spec.md` (§4, `PATCH /users/:id` row)

**Interfaces:**
- Consumes: existing `requireAdmin`, `adminView`, `ADMIN_SELECT`.
- Produces: `PATCH /api/v1/users/:id` body may include `first_name: string (1–100, trimmed)` and `last_name: string (1–100, trimmed)` alongside `team_id`, `role`, `is_active`. Response unchanged: `{ data: adminView }`, which already contains `first_name`/`last_name`.

- [ ] **Step 1: Write the failing tests** in `api.test.js`, using the file's existing `call`, `adminToken` and member fixtures:
  - `admin can edit a user's first and last name`: PATCH `{first_name: "  สมชาย ", last_name: "ใจดี"}` → 200, `data.first_name === "สมชาย"`, `data.last_name === "ใจดี"`.
  - `name-only patch leaves team, role and status untouched`: compare those three fields before and after.
  - `blank name is rejected in Thai`: PATCH `{first_name: "   "}` → 400, and `error.message` is Thai (match `/[ก-๙]/`); a 101-character name → 400.
  - `member cannot patch names`: member token → 403 (mirror the existing member-forbidden test at line ~499).
- [ ] **Step 2: Run** `cd backend && npm test`. Expected: the new tests FAIL (names ignored or 400 from strict schema), the rest pass.
- [ ] **Step 3: Implement.** In `patchBody` add `first_name`/`last_name` as `z.string().trim().min(1, 'กรุณากรอกชื่อ').max(100).optional()` (use a Thai message for last name too, `'กรุณากรอกนามสกุล'`), and add both to the `for (const field of [...])` list. Check how `auth.js` registration validates names and reuse its schema fragment if one exists instead of duplicating it.
- [ ] **Step 4: Run** `npm test`. Expected: all PASS.
- [ ] **Step 5: Update `docs/api-spec.md` §4** `PATCH /users/:id` row to list `first_name`/`last_name`.
- [ ] **Step 6: Commit** `feat(api): let admins edit user names via PATCH /users/:id`

---

### Task 2: Group helper and complete user loading

**Files:**
- Modify: `frontend/src/api/users.js`
- Create: `frontend/src/lib/groupUsers.js`

**Interfaces:**
- Produces: `listAllUsers(params?: { unassigned?: boolean, q?: string }): Promise<User[]>` pages through `listUsers` with `limit: 100` until `meta.total` is reached.
- Produces: `groupUsersByTeam(users: User[], teams: Team[]): Array<{ key: string, team: Team | null, users: User[] }>`. First group (if any user has no team) has `key: 'none'`, `team: null`; then one group per team in `teams` sorted by `team_name.localeCompare(..., 'th')`, empty teams included. Within a group, sort by `displayName(user)` Thai collation. Users whose `team.id` is not in `teams` fall into the "none" group (defensive; stale list).
- `User` and `Team` are the shapes returned by `GET /users` and `GET /teams`.

- [ ] **Step 1: Implement `listAllUsers`** in `api/users.js` as a thin wrapper over `listUsers` (loop on `page`, stop when collected count ≥ `meta.total` or a page comes back empty).
- [ ] **Step 2: Implement `groupUsersByTeam`** per the interface above. Pure function, no React imports.
- [ ] **Step 3: Sanity-check** with a throwaway `node -e` against three users (one with no team, one in a team, one with a team id missing from `teams`) and one empty team. Expected: groups `none`, then the teams, the stale-team user in `none`, the empty team present with `users: []`. Do not commit the script (frontend has no test runner).
- [ ] **Step 4: Run** `cd frontend && npm run lint`. Expected: no errors.
- [ ] **Step 5: Commit** `feat(frontend): add listAllUsers and groupUsersByTeam`

---

### Task 3: UserEditDialog component

**Files:**
- Create: `frontend/src/components/UserEditDialog.jsx`
- Modify: `frontend/src/index.css`

**Interfaces:**
- Consumes: `updateUser(id, payload)` from `api/users.js`; `displayName`, `formatDate` from `lib/format.js`; `UserAvatar`.
- Produces: `UserEditDialog({ user: User, teams: Team[], onClose: () => void, onSaved: (updated: User) => void })`. Rendered only while a user is selected; uses a native `<dialog>` opened with `showModal()` on mount (Escape and backdrop-click close it, focus is trapped by the platform).

- [ ] **Step 1: Implement the form** with fields: ชื่อ (first_name), นามสกุล (last_name), ทีม (select with "— ยังไม่กำหนดทีม —" + teams), บทบาท (สมาชิก / ผู้ดูแลระบบ), สถานะบัญชี (checkbox, ใช้งานได้ / ระงับ). Show email and join date as read-only text, with an avatar header.
- [ ] **Step 2: Send only changed fields** in the PATCH payload. If nothing changed, disable "บันทึก". Null names show as empty inputs; an untouched empty name is not sent (Review Focus 3).
- [ ] **Step 3: Error handling:** on failure keep the dialog open and show `err.message` in a `.form-error` inside it; disable buttons while saving. On success call `onSaved(updated)` then `onClose()`.
- [ ] **Step 4: Styles** in `index.css`: `.dialog` using existing tokens (`--surface`, `--shadow-float`, 28px radius to match `.list-card`), `::backdrop` tinted from `--ink`; indigo focus/selection per conventions. Respect `prefers-reduced-motion` (no open animation needed).
- [ ] **Step 5: Run** `npm run lint`. Expected: no errors.
- [ ] **Step 6: Commit** `feat(frontend): add UserEditDialog`

---

### Task 4: Grouped list and row click in AdminUsersPage

**Files:**
- Modify: `frontend/src/pages/AdminUsersPage.jsx`
- Modify: `frontend/src/index.css`

**Interfaces:**
- Consumes: `listAllUsers`, `groupUsersByTeam`, `UserEditDialog`, and the existing team chip handlers (unchanged).
- Produces: page state `editingUserId: string | null`; the dialog gets the user looked up from `users` by id so it always reflects current data.

- [ ] **Step 1: Load** with `listAllUsers({ unassigned })` instead of `listUsers({ limit: 100 })`. Keep the existing `unassignedOnly` filter and banner; the banner's button still works.
- [ ] **Step 2: Render groups.** For each group from `groupUsersByTeam(users, teams)`: a heading ("ไม่มีทีม" or the team name) with the member count, then the rows. Empty teams show a one-line empty state ("ยังไม่มีสมาชิกในทีมนี้"). Keep the column header row once at the top.
- [ ] **Step 3: Slim the row** to read-only cells: avatar + name + email, role label, join date, status label. Remove the inline selects and checkbox. Drop the now-redundant "team" column. Update `.users-row` grid columns to match.
- [ ] **Step 4: Make rows clickable and accessible.** Each row is a `<button type="button">`-style element or has `role="button"` + `tabIndex={0}` handling Enter/Space; visible `:focus-visible` ring in indigo; hover uses `--indigo-soft`. Clicking sets `editingUserId`.
- [ ] **Step 5: Wire the dialog.** `onSaved` merges the returned user into `users` (same merge pattern as the existing `patchUser`, so `created_at` is kept). If the saved user's team changed, the row moves group on the next render.
- [ ] **Step 6: Remove dead code:** `patchUser` and its `alert` usage if no longer referenced. Leave the team-management handlers and all existing comments untouched.
- [ ] **Step 7: Run** `npm run lint` and `npm run build`. Expected: both succeed.
- [ ] **Step 8: Verify in the browser** (`npm run dev:pglite` in `backend/`, `npm run dev` in `frontend/`, log in as the admin from your `backend/.env` (`ADMIN_EMAIL` / `ADMIN_PASSWORD`); register 2–3 members first so groups are visible). Check: groups render with the unassigned section first; clicking a row opens the dialog; changing team moves the row to the new group; a blank name shows the Thai error; Escape closes without saving; keyboard Tab/Enter works on rows; layout at ~375px width.
- [ ] **Step 9: Commit** `feat(frontend): group admin users by team with click-to-edit dialog`

---

## Self-Review

- **Spec coverage:** grouped by team → Tasks 2, 4; admin only → existing `AdminRoute` and `requireAdmin` (unchanged); click row to edit details → Tasks 3, 4; details beyond team/role/status → Task 1.
- **Type consistency:** `listAllUsers`, `groupUsersByTeam`, `UserEditDialog` props and the `first_name`/`last_name` PATCH fields use the same names in every task.
- **Review Focus mapping:** 1 → Task 2 (loop on `meta.total`); 2 and the 101-character case → Task 1 tests; 3 → Task 1 test and Task 3 Step 2; 4 → Task 3 Step 3; 5 → Task 4 Step 5 (dialog user looked up from live state, teams passed from current state).
- **Gap noted:** the frontend has no test runner, so Tasks 2–4 are verified by lint, build and the manual pass in Task 4 Step 8.
