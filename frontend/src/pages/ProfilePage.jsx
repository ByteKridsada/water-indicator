import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { changePassword, updateMe } from '../api/auth.js';
import { initials } from '../lib/format.js';

const ROLE_LABELS = { admin: 'ผู้ดูแลระบบ', member: 'สมาชิก' };

export function ProfilePage() {
  const { user, refresh } = useAuth();

  const [email, setEmail] = useState(user.email);
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [emailSaved, setEmailSaved] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSaved, setPasswordSaved] = useState(false);

  async function handleEmailSubmit(e) {
    e.preventDefault();
    setEmailError('');
    setEmailSaved(false);
    setEmailSaving(true);
    try {
      await updateMe({ email });
      await refresh();
      setEmailSaved(true);
    } catch (err) {
      setEmailError(err.message || 'เปลี่ยนอีเมลไม่สำเร็จ');
    } finally {
      setEmailSaving(false);
    }
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    setPasswordError('');
    setPasswordSaved(false);
    if (newPassword !== confirmPassword) {
      setPasswordError('รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน');
      return;
    }
    setPasswordSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSaved(true);
    } catch (err) {
      setPasswordError(err.message || 'เปลี่ยนรหัสผ่านไม่สำเร็จ');
    } finally {
      setPasswordSaving(false);
    }
  }

  return (
    <div className="page" style={{ maxWidth: 720 }}>
      <div>
        <h1 className="page-title">ข้อมูลบัญชี</h1>
        <p className="page-sub">เปลี่ยนอีเมลที่ใช้เข้าสู่ระบบ หรือเปลี่ยนรหัสผ่าน</p>
      </div>

      <section className="card" aria-label="สรุปบัญชี">
        <div className="cell-main">
          <span className="avatar" style={{ width: 56, height: 56, fontSize: 18 }}>
            {initials(user.email)}
          </span>
          <dl className="profile-summary">
            <dt>บทบาท</dt>
            <dd>{ROLE_LABELS[user.role] ?? user.role}</dd>
            <dt>ทีม</dt>
            <dd>{user.team ? user.team.team_name : 'ยังไม่มีทีม — ติดต่อผู้ดูแลระบบเพื่อกำหนดทีม'}</dd>
          </dl>
        </div>
      </section>

      <form className="card" onSubmit={handleEmailSubmit}>
        <fieldset disabled={emailSaving} className="stack" style={{ gap: 16 }}>
          <h2 className="card-title">อีเมล</h2>
          <div className="field">
            <label htmlFor="profile-email">อีเมลที่ใช้เข้าสู่ระบบ</label>
            <input
              id="profile-email"
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          {emailError && <p className="form-error">{emailError}</p>}
          {emailSaved && <p className="form-success">เปลี่ยนอีเมลแล้ว ครั้งหน้าให้เข้าสู่ระบบด้วยอีเมลใหม่</p>}
          <div className="form-actions">
            <button type="submit" className="btn btn--primary" disabled={email === user.email}>
              {emailSaving ? 'กำลังบันทึก...' : 'บันทึกอีเมล'}
            </button>
          </div>
        </fieldset>
      </form>

      <form className="card" onSubmit={handlePasswordSubmit}>
        <fieldset disabled={passwordSaving} className="stack" style={{ gap: 16 }}>
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
          {passwordError && <p className="form-error">{passwordError}</p>}
          {passwordSaved && <p className="form-success">เปลี่ยนรหัสผ่านแล้ว</p>}
          <div className="form-actions">
            <button type="submit" className="btn btn--primary">
              {passwordSaving ? 'กำลังบันทึก...' : 'เปลี่ยนรหัสผ่าน'}
            </button>
          </div>
        </fieldset>
      </form>
    </div>
  );
}
