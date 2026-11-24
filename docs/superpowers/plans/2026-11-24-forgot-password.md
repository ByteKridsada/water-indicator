# Forgot Password (Admin-Issued Temporary Password) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user who forgot their password get back in: the login page gets a "ลืมรหัสผ่าน?" page that tells them what to do, and an admin can issue a temporary password from the users page.

**Architecture:** No email is sent. A new admin-only route `POST /users/:id/reset-password` generates a random temporary password, stores its bcrypt hash, and returns the plaintext once. The admin hands it to the user, who logs in and changes it on the profile page (existing `POST /auth/me/password`). A static public page explains this flow.

**Tech Stack:** Express + zod + bcryptjs + PGlite/pg (backend, `node --test`), React + Vite (frontend, no tests).

**Spec:** None. The request was "หน้าลืมรหัสผ่าน". The delivery choice (admin sets a temporary password, no email) and the session choice (existing tokens stay valid after a reset) were answered by you on 2026-11-24. Everything else below is a proposal (see "Assumptions to confirm").

## Assumptions to confirm (CLAUDE.md: don't pick defaults silently)

1. **The server generates the temporary password** (12 characters, no look-alike characters) and shows it to the admin once. The admin does not type one. This avoids weak passwords like `1234`.
2. **No forced password change on first login.** The user is told to change it on the profile page, but nothing makes them. Forcing it needs a `must_change_password` column, a migration and a login gate; say if you want it. The cost of leaving it out is that the admin knows a working password until the user changes it.
3. **The "ลืมรหัสผ่าน?" page is static.** It tells the user to contact an administrator and has no form and no API call, because there is no way to contact the admin from the app and no email on file we send to.
4. **An admin can reset any user, including themselves and deactivated users.** A reset does not reactivate a deactivated account.
5. **No audit log of resets** (none exists in the project today).

## Global Constraints

- API error messages and all UI text in Thai; code comments, `console.*` and thrown `Error` messages in English.
- Authorization is `requireAdmin` (already applied to the whole `routes/users.js` router); never accept `role`, `team_id` or a password from the client for this route.
- Parameterized SQL only, through `backend/src/db.js`; SQL must work on PGlite (PG 18) and Postgres 16.
- Never return or log `password_hash`; the temporary password is returned once in the response of the reset call and nowhere else, and is never written to `console.*`.
- Passwords are hashed with `bcryptjs` using `config.bcryptRounds`, the same as registration in `routes/auth.js`. The password rule everywhere else is 8–200 characters.
- Add API calls in `frontend/src/api/users.js` only; pages never call axios directly. `apiClient` puts the server message in `err.message`, so display that.
- Styling: tokens at the top of `frontend/src/index.css`; teal is brand/data, indigo is interaction. No green/amber/red status colours except the existing `--danger` for errors.
- Keep existing owner comments, including the React-vs-Swift/iOS ones. `docs/api-spec.md` §4 is updated in the same change as the API.

## Review Focus

1. **Unknown user id:** `POST /users/<random uuid>/reset-password` returns 404 with a Thai message and changes nothing. (Task 1)
2. **Old password stops working, new one works, and nothing else changes:** after a reset the old password gets 401 on login, the temporary one logs in, and the user's team, role and active status are unchanged. (Task 1)
3. **Non-admins cannot reset:** a member gets 403 and an anonymous caller gets 401, and in both cases the target's password is unchanged. (Task 1)
4. **The temporary password is shown once and then gone:** closing or reopening the dialog never shows it again, and it is not kept in any state outside the dialog. (Task 2)
5. **A deactivated user stays blocked:** reset succeeds, but login with the temporary password is still refused with the existing "บัญชีนี้ถูกระงับการใช้งาน" behaviour. (Task 1)

---

## File Structure

- Modify `backend/src/routes/users.js`: add `POST /:id/reset-password` and a `generateTemporaryPassword` helper.
- Modify `backend/tests/api.test.js`: tests for the new route.
- Modify `docs/api-spec.md` §4: document the route.
- Modify `frontend/src/api/users.js`: add `resetUserPassword`.
- Create `frontend/src/components/ResetPasswordPanel.jsx`: confirm step, result display, copy button.
- Modify `frontend/src/components/UserEditDialog.jsx`: mount the panel inside the dialog.
- Modify `frontend/src/index.css`: styles for the panel.
- Create `frontend/src/pages/ForgotPasswordPage.jsx`: static explanation page.
- Modify `frontend/src/App.jsx`: public route `/forgot-password`.
- Modify `frontend/src/pages/LoginPage.jsx`: link to it.

---

### Task 1: POST /users/:id/reset-password

**Files:**
- Modify: `backend/src/routes/users.js`
- Test: `backend/tests/api.test.js` (next to the existing `PATCH /users/:id` tests; reuse its `call`, `adminToken`, `memberA` fixtures)
- Modify: `docs/api-spec.md` (§4)

**Interfaces:**
- Consumes: `requireAdmin` (already applied to the router), `one` from `db.js`, `notFound` from `lib/errors.js`, `bcrypt` (`bcryptjs`), `config.bcryptRounds`.
- Produces: `POST /api/v1/users/:id/reset-password` with no body. Response `200 { data: { temporary_password: string } }` with header `Cache-Control: no-store`. The password is 12 characters drawn from an alphabet without `0 O o 1 l I`, generated with `crypto.randomInt`. Errors: 404 `ไม่พบผู้ใช้นี้` for an unknown id.
- Produces: internal `generateTemporaryPassword(): string` in `routes/users.js` (not exported).

- [ ] **Step 1: Write the failing tests** in `api.test.js`:
  - `admin resets a password: response has a 12-character temporary_password, old password no longer logs in (401), temporary password logs in (200)`.
  - `reset changes nothing but the password`: compare `team`, `role`, `is_active` before and after via `GET /users`.
  - `two resets give different passwords`.
  - `response is not cacheable`: assert the `cache-control` header contains `no-store` (this needs a raw `fetch`, since `call` drops headers).
  - `unknown user id -> 404 with a Thai message` (use a random v4 uuid).
  - `member gets 403 and anonymous gets 401, and the target's password is unchanged` (log in with the old password afterwards).
  - `deactivated user: reset returns 200 but login with the temporary password is still refused` (deactivate via `PATCH is_active:false`, reset, then login → the same non-200 status the existing deactivated-login test asserts).
  - `password_hash never appears in the response body`.
- [ ] **Step 2: Run** `cd backend && npm test`. Expected: the new tests FAIL (404 from a missing route), the existing ones pass.
- [ ] **Step 3: Implement** `generateTemporaryPassword(): string` and the route in `users.js`. Update with `UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id`; return 404 via `notFound('ไม่พบผู้ใช้นี้')` when no row is updated; set `res.set('Cache-Control', 'no-store')`. Do not log the password.
- [ ] **Step 4: Run** `npm test`. Expected: all PASS.
- [ ] **Step 5: Update `docs/api-spec.md` §4** with the route, its response, the one-time display, and that it does not invalidate existing tokens or reactivate accounts.
- [ ] **Step 6: Commit** `feat(api): let admins issue a temporary password`

---

### Task 2: Reset button in the admin edit dialog

**Files:**
- Modify: `frontend/src/api/users.js`
- Create: `frontend/src/components/ResetPasswordPanel.jsx`
- Modify: `frontend/src/components/UserEditDialog.jsx`
- Modify: `frontend/src/index.css`

**Interfaces:**
- Consumes: `POST /users/:id/reset-password` from Task 1.
- Produces: `resetUserPassword(id: string): Promise<string>` in `api/users.js`, returning `data.data.temporary_password`.
- Produces: `ResetPasswordPanel({ user: User })`, a self-contained section. States: idle → confirming ("รีเซ็ตรหัสผ่านของ <displayName>? ผู้ใช้จะเข้าด้วยรหัสเดิมไม่ได้อีก" with ยืนยัน / ยกเลิก) → working → done (shows the temporary password in a read-only monospace field, a "คัดลอก" button that confirms with "คัดลอกแล้ว", and a note to tell the user to change it on the profile page). On failure it shows `err.message` and returns to idle. The password lives only in this component's state, so it disappears when the dialog closes or the user changes.

- [ ] **Step 1: Implement `resetUserPassword`** in `api/users.js` as a thin wrapper around `apiClient.post`.
- [ ] **Step 2: Implement `ResetPasswordPanel`** per the states above. The copy button uses `navigator.clipboard.writeText`, and falls back to selecting the field text if it is unavailable or rejects. All text Thai.
- [ ] **Step 3: Mount the panel** in `UserEditDialog` as its own section below the edit form, outside the Save/Cancel form so it works independently of the form's dirty/saving state. `UserEditDialog` is already mounted with `key={user.id}`, so the panel resets on selection change.
- [ ] **Step 4: Styles** in `index.css` for the section, using existing tokens; indigo for the action, no status colours.
- [ ] **Step 5: Run** `cd frontend && npm run lint && npm run build`. Expected: no new errors.
- [ ] **Step 6: Verify in a real browser** (Chrome via playwright-core, as was done for the users page): reset a member, copy the password, log in as that member with it, confirm the old password fails; confirm the password is no longer visible after closing and reopening the dialog (Review Focus 4); check the dialog at 375px width.
- [ ] **Step 7: Commit** `feat(frontend): reset a user's password from the edit dialog`

---

### Task 3: Public "ลืมรหัสผ่าน?" page

**Files:**
- Create: `frontend/src/pages/ForgotPasswordPage.jsx`
- Modify: `frontend/src/App.jsx` (public route next to `/login`)
- Modify: `frontend/src/pages/LoginPage.jsx` (link)

**Interfaces:**
- Consumes: `AuthLayout` (as used by `LoginPage`).
- Produces: route `/forgot-password`, reachable without logging in.

- [ ] **Step 1: Implement `ForgotPasswordPage`** with `AuthLayout`: title "ลืมรหัสผ่าน?", short steps (ติดต่อผู้ดูแลระบบเพื่อขอรหัสผ่านชั่วคราว → เข้าสู่ระบบด้วยรหัสชั่วคราว → เปลี่ยนรหัสผ่านใหม่ที่หน้าโปรไฟล์) and a "กลับไปเข้าสู่ระบบ" link. The steps are a real sequence, so numbering is appropriate. No form, no API call.
- [ ] **Step 2: Add the route** in `App.jsx` outside `ProtectedRoute`, and add a "ลืมรหัสผ่าน?" link under the password field in `LoginPage.jsx`. A logged-in user visiting `/forgot-password` is not redirected (the page is harmless).
- [ ] **Step 3: Run** `npm run lint && npm run build`. Expected: no new errors.
- [ ] **Step 4: Verify in a real browser:** the link appears on the login page, the page renders without a session, the back link works, and it fits at 375px.
- [ ] **Step 5: Commit** `feat(frontend): add forgot-password page`

---

## Self-Review

- **Spec coverage:** "forgot password page" → Task 3; the chosen delivery (admin sets a temporary password) → Tasks 1–2; "existing sessions stay valid" → nothing added, and the api-spec note in Task 1 Step 5 says so.
- **Step scan:** each step names the file, signature or exact behaviour, and the tests list their assertions. No step says "handle errors" without saying how.
- **Type consistency:** `resetUserPassword` (Task 2 Step 1) returns the `temporary_password` string that Task 1 defines; `ResetPasswordPanel`'s `user` prop is the same `User` shape used by `UserEditDialog`.
- **Review Focus mapping:** 1, 2, 3 and 5 → Task 1 tests; 4 → Task 2 Step 6, manual because the frontend has no test runner.
- **Proportion:** 3 small tasks. Task 1 carries the only logic worth automated tests.
- **Gap noted:** the frontend has no test runner, so Tasks 2–3 are verified by lint, build and the browser pass.
