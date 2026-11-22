import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { changePassword, deleteAvatar, updateMe, uploadAvatar } from '../api/auth.js';
import { listTeams } from '../api/teams.js';
import { updateUser as updateUserAsAdmin } from '../api/users.js';
import { UserAvatar } from '../components/UserAvatar.jsx';
import { IconUpload } from '../components/icons.jsx';

const ROLE_LABELS = { admin: 'ผู้ดูแลระบบ', member: 'สมาชิก' };
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function PhotoCard({ user, onUpdated }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    // quick checks for a friendlier message; the server still verifies the file's real type
    if (!IMAGE_TYPES.includes(file.type)) {
      setError('รองรับเฉพาะไฟล์ JPG, PNG และ WebP');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError('ไฟล์ใหญ่เกิน 5 MB');
      return;
    }
    setBusy(true);
    try {
      onUpdated(await uploadAvatar(file));
    } catch (err) {
      setError(err.message || 'อัปโหลดรูปไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    setError('');
    setBusy(true);
    try {
      onUpdated(await deleteAvatar());
    } catch (err) {
      setError(err.message || 'ลบรูปไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card stack" style={{ gap: 16 }} aria-label="รูปโปรไฟล์">
      <h2 className="card-title">รูปโปรไฟล์</h2>
      <div className="profile-photo">
        <UserAvatar user={user} size={96} />
        <div className="profile-photo__actions">
          <input
            ref={inputRef}
            type="file"
            accept={IMAGE_TYPES.join(',')}
            onChange={handleFile}
            hidden
            aria-label="เลือกรูปโปรไฟล์"
          />
          <div className="btn-row">
            <button type="button" className="btn btn--outline" onClick={() => inputRef.current?.click()} disabled={busy}>
              <IconUpload size={16} />
              {busy ? 'กำลังบันทึก...' : user.avatar_url ? 'เปลี่ยนรูป' : 'อัปโหลดรูป'}
            </button>
            {user.avatar_url && (
              <button type="button" className="btn btn--quiet" onClick={handleRemove} disabled={busy}>
                ลบรูป
              </button>
            )}
          </div>
          <p className="hint">JPG, PNG หรือ WebP ขนาดไม่เกิน 5 MB</p>
          {error && <p className="form-error">{error}</p>}
        </div>
      </div>
    </section>
  );
}

function DetailsCard({ user, onUpdated }) {
  const [firstName, setFirstName] = useState(user.first_name || '');
  const [lastName, setLastName] = useState(user.last_name || '');
  const [email, setEmail] = useState(user.email);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  // send only what changed, so an unchanged email isn't re-validated or re-saved
  const changes = {};
  if (firstName.trim() !== (user.first_name || '')) changes.first_name = firstName;
  if (lastName.trim() !== (user.last_name || '')) changes.last_name = lastName;
  if (email.trim().toLowerCase() !== user.email) changes.email = email;
  const dirty = Object.keys(changes).length > 0;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaved('');
    setSaving(true);
    try {
      const updated = await updateMe(changes);
      onUpdated(updated);
      setFirstName(updated.first_name || '');
      setLastName(updated.last_name || '');
      setEmail(updated.email);
      setSaved(changes.email ? 'บันทึกแล้ว ครั้งหน้าให้เข้าสู่ระบบด้วยอีเมลใหม่' : 'บันทึกแล้ว');
    } catch (err) {
      setError(err.message || 'บันทึกข้อมูลไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      <fieldset disabled={saving} className="stack" style={{ gap: 16 }}>
        <h2 className="card-title">ข้อมูลส่วนตัว</h2>
        {!user.first_name && <p className="form-warning">บัญชีนี้ยังไม่มีชื่อและนามสกุล กรุณากรอกให้ครบ</p>}
        <div className="grid-2">
          <div className="field">
            <label htmlFor="profile-first">ชื่อ</label>
            <input
              id="profile-first"
              className="input"
              type="text"
              autoComplete="given-name"
              maxLength={100}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="profile-last">นามสกุล</label>
            <input
              id="profile-last"
              className="input"
              type="text"
              autoComplete="family-name"
              maxLength={100}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="profile-email">อีเมลที่ใช้เข้าสู่ระบบ</label>
          <input
            id="profile-email"
            className="input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        {error && <p className="form-error">{error}</p>}
        {saved && <p className="form-success">{saved}</p>}
        <div className="form-actions">
          <button type="submit" className="btn btn--primary" disabled={!dirty}>
            {saving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
          </button>
        </div>
      </fieldset>
    </form>
  );
}

// A member's team decides which locations they may edit, so only an admin changes it.
// Admins can set their own team here; members see it read-only.
function TeamCard({ user, onSaved }) {
  const isAdmin = user.role === 'admin';
  const [teams, setTeams] = useState([]);
  const [teamId, setTeamId] = useState(user.team?.id || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    listTeams()
      .then(setTeams)
      .catch((err) => setError(err.message || 'โหลดรายชื่อทีมไม่สำเร็จ'));
  }, [isAdmin]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaved(false);
    setSaving(true);
    try {
      await updateUserAsAdmin(user.id, { team_id: teamId || null });
      await onSaved();
      setSaved(true);
    } catch (err) {
      setError(err.message || 'เปลี่ยนทีมไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      <fieldset disabled={saving} className="stack" style={{ gap: 16 }}>
        <h2 className="card-title">ทีมและบทบาท</h2>
        <dl className="profile-summary">
          <dt>บทบาท</dt>
          <dd>{ROLE_LABELS[user.role] ?? user.role}</dd>
          {!isAdmin && (
            <>
              <dt>ทีม</dt>
              <dd>{user.team ? user.team.team_name : 'ยังไม่มีทีม'}</dd>
            </>
          )}
        </dl>
        {isAdmin ? (
          <>
            <div className="field">
              <label htmlFor="profile-team">ทีม</label>
              <select id="profile-team" className="select" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
                <option value="">ไม่มีทีม</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.team_name}
                  </option>
                ))}
              </select>
              <p className="hint">ผู้ดูแลระบบแก้ไขได้ทุกจุดตรวจวัดไม่ว่าจะอยู่ทีมใด ทีมของสมาชิกคนอื่นเปลี่ยนได้ที่หน้าจัดการทีม</p>
            </div>
            {error && <p className="form-error">{error}</p>}
            {saved && <p className="form-success">เปลี่ยนทีมแล้ว</p>}
            <div className="form-actions">
              <button type="submit" className="btn btn--primary" disabled={teamId === (user.team?.id || '')}>
                {saving ? 'กำลังบันทึก...' : 'บันทึกทีม'}
              </button>
            </div>
          </>
        ) : (
          <p className="hint">ทีมกำหนดว่าคุณแก้ไขจุดตรวจวัดใดได้บ้าง หากต้องการเปลี่ยนทีม กรุณาติดต่อผู้ดูแลระบบ</p>
        )}
      </fieldset>
    </form>
  );
}

function PasswordCard() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaved(false);
    if (newPassword !== confirmPassword) {
      setError('รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน');
      return;
    }
    setSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSaved(true);
    } catch (err) {
      setError(err.message || 'เปลี่ยนรหัสผ่านไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      <fieldset disabled={saving} className="stack" style={{ gap: 16 }}>
        <h2 className="card-title">เปลี่ยนรหัสผ่าน</h2>
        <div className="field">
          <label htmlFor="profile-current">รหัสผ่านปัจจุบัน</label>
          <input
            id="profile-current"
            className="input"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </div>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="profile-new">รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)</label>
            <input
              id="profile-new"
              className="input"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="profile-confirm">ยืนยันรหัสผ่านใหม่</label>
            <input
              id="profile-confirm"
              className="input"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
        </div>
        {error && <p className="form-error">{error}</p>}
        {saved && <p className="form-success">เปลี่ยนรหัสผ่านแล้ว</p>}
        <div className="form-actions">
          <button type="submit" className="btn btn--primary">
            {saving ? 'กำลังบันทึก...' : 'เปลี่ยนรหัสผ่าน'}
          </button>
        </div>
      </fieldset>
    </form>
  );
}

export function ProfilePage() {
  const { user, refresh, updateUser } = useAuth();

  return (
    <div className="page" style={{ maxWidth: 720 }}>
      <div>
        <h1 className="page-title">ข้อมูลบัญชี</h1>
        <p className="page-sub">แก้ไขรูปโปรไฟล์ ชื่อ อีเมล และรหัสผ่านของคุณ</p>
      </div>
      <PhotoCard user={user} onUpdated={updateUser} />
      <DetailsCard user={user} onUpdated={updateUser} />
      <TeamCard user={user} onSaved={refresh} />
      <PasswordCard />
    </div>
  );
}
