import { useEffect, useRef, useState } from 'react';
import { updateUser } from '../api/users.js';
import { displayName, formatDate } from '../lib/format.js';
import { ResetPasswordPanel } from './ResetPasswordPanel.jsx';
import { UserAvatar } from './UserAvatar.jsx';

// Admin edit form for one user, shown in a native modal <dialog>.
// The parent renders this only while a user is selected and unmounts it on onClose.
export function UserEditDialog({ user, teams, onClose, onSaved }) {
  const dialogRef = useRef(null);
  const [firstName, setFirstName] = useState(user.first_name || '');
  const [lastName, setLastName] = useState(user.last_name || '');
  const [teamId, setTeamId] = useState(user.team?.id || '');
  const [role, setRole] = useState(user.role);
  const [isActive, setIsActive] = useState(user.is_active);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Open as a modal on mount ≈ presenting a .sheet in SwiftUI: the platform traps focus,
  // closes it on Escape and puts a backdrop behind it.
  // No cleanup close(): it would fire "close" and unmount the dialog again under StrictMode.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  // send only what changed; a null name shows as "" so an untouched empty name isn't sent
  const changes = {};
  if (firstName.trim() !== (user.first_name || '')) changes.first_name = firstName.trim();
  if (lastName.trim() !== (user.last_name || '')) changes.last_name = lastName.trim();
  if (teamId !== (user.team?.id || '')) changes.team_id = teamId || null;
  if (role !== user.role) changes.role = role;
  if (isActive !== user.is_active) changes.is_active = isActive;
  const dirty = Object.keys(changes).length > 0;

  function handleCancel(e) {
    // Escape while a save is in flight: keep the dialog open until it finishes
    if (saving) e.preventDefault();
  }

  function handleBackdropClick(e) {
    // the dialog element has no padding, so a click whose target is the dialog itself hit the backdrop
    if (e.target === dialogRef.current && !saving) dialogRef.current.close();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!dirty) return;
    // the API only reports a generic validation error, so check the changed name fields here
    if ('first_name' in changes && !String(changes.first_name ?? '').trim()) {
      setError('กรุณากรอกชื่อ');
      return;
    }
    if ('last_name' in changes && !String(changes.last_name ?? '').trim()) {
      setError('กรุณากรอกนามสกุล');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const updated = await updateUser(user.id, changes);
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(err.message || 'บันทึกข้อมูลไม่สำเร็จ');
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="dialog"
      aria-labelledby="user-edit-title"
      onCancel={handleCancel}
      onClose={onClose}
      onClick={handleBackdropClick}
    >
      <form className="dialog__body" onSubmit={handleSubmit}>
        <fieldset disabled={saving} className="stack" style={{ gap: 18 }}>
          <header className="dialog__header">
            <UserAvatar user={user} size={56} />
            <div style={{ minWidth: 0 }}>
              <h2 className="dialog__title" id="user-edit-title">
                {displayName(user)}
              </h2>
              <p className="dialog__sub">แก้ไขข้อมูลผู้ใช้งาน</p>
            </div>
          </header>

          <dl className="profile-summary">
            <dt>อีเมล</dt>
            <dd style={{ overflowWrap: 'anywhere' }}>{user.email}</dd>
            <dt>สมัครเมื่อ</dt>
            <dd>{user.created_at ? formatDate(user.created_at) : '—'}</dd>
          </dl>

          <div className="grid-2">
            <div className="field">
              <label htmlFor="user-edit-first">ชื่อ</label>
              <input
                id="user-edit-first"
                className="input"
                type="text"
                maxLength={100}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="user-edit-last">นามสกุล</label>
              <input
                id="user-edit-last"
                className="input"
                type="text"
                maxLength={100}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>

          <div className="grid-2">
            <div className="field">
              <label htmlFor="user-edit-team">ทีม</label>
              <select id="user-edit-team" className="select" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
                <option value="">— ยังไม่กำหนดทีม —</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.team_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="user-edit-role">บทบาท</label>
              <select id="user-edit-role" className="select" value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="member">สมาชิก</option>
                <option value="admin">ผู้ดูแลระบบ</option>
              </select>
            </div>
          </div>

          <div className="field">
            <span className="field-label">สถานะบัญชี</span>
            <label className="checkbox">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              {isActive ? 'ใช้งานได้' : 'ระงับ'}
            </label>
          </div>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <div className="form-actions">
            <button type="button" className="btn btn--quiet" onClick={() => dialogRef.current?.close()}>
              ยกเลิก
            </button>
            <button type="submit" className="btn btn--primary" disabled={!dirty}>
              {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
          </div>
        </fieldset>
      </form>

      {/* outside the edit form: it acts on its own and doesn't depend on Save/dirty state */}
      <ResetPasswordPanel user={user} />
    </dialog>
  );
}
