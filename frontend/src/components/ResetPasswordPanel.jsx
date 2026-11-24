import { useRef, useState } from 'react';
import { resetUserPassword } from '../api/users.js';
import { displayName } from '../lib/format.js';

// "Forgot password" for the admin side: issue a temporary password and show it once.
// The password lives only in this component's state, so it disappears when the dialog unmounts.
// `phase` ≈ a Swift enum with four cases (idle / confirming / working / done), switched on below.
export function ResetPasswordPanel({ user, disabled = false, onBusyChange }) {
  const [phase, setPhase] = useState('idle');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [copyNote, setCopyNote] = useState('');
  const [error, setError] = useState('');
  const fieldRef = useRef(null);

  async function handleConfirm() {
    setError('');
    setPhase('working');
    // tell the dialog a request is in flight so it won't close and drop the password
    onBusyChange?.(true);
    try {
      setTemporaryPassword(await resetUserPassword(user.id));
      setPhase('done');
    } catch (err) {
      setError(err.message || 'รีเซ็ตรหัสผ่านไม่สำเร็จ');
      setPhase('idle');
    } finally {
      onBusyChange?.(false);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(temporaryPassword);
      setCopyNote('คัดลอกแล้ว');
    } catch {
      // clipboard blocked (e.g. plain http): select the text so the admin can copy it by hand
      fieldRef.current?.select();
      setCopyNote('คัดลอกอัตโนมัติไม่ได้ เลือกข้อความให้แล้ว กดคัดลอกเอง');
    }
  }

  return (
    <section className="dialog__section" aria-labelledby="reset-password-title">
      <div className="dialog__section-body">
        <h3 className="dialog__section-title" id="reset-password-title">
          รหัสผ่าน
        </h3>

        {phase === 'done' ? (
          <div className="stack" style={{ gap: 12 }}>
            <div className="reset-result">
              <input
                ref={fieldRef}
                className="input reset-result__field"
                type="text"
                readOnly
                value={temporaryPassword}
                aria-label={`รหัสผ่านชั่วคราวของ ${displayName(user)}`}
                onFocus={(e) => e.target.select()}
              />
              <button type="button" className="btn btn--outline btn--small" onClick={handleCopy}>
                คัดลอก
              </button>
            </div>
            {copyNote && (
              <p className="dialog__sub" role="status">
                {copyNote}
              </p>
            )}
            <p className="dialog__sub">
              รหัสนี้แสดงครั้งเดียว ปิดหน้าต่างนี้แล้วจะดูอีกไม่ได้ ส่งให้ผู้ใช้ แล้วบอกให้เปลี่ยนรหัสผ่านใหม่ที่หน้าโปรไฟล์หลังเข้าสู่ระบบ
            </p>
          </div>
        ) : phase === 'idle' ? (
          <div className="stack" style={{ gap: 12 }}>
            <p className="dialog__sub">ผู้ใช้ลืมรหัสผ่าน? ออกรหัสผ่านชั่วคราวให้ แล้วส่งให้เจ้าของบัญชีเอง</p>
            <div>
              <button
                type="button"
                className="btn btn--outline btn--small"
                disabled={disabled}
                onClick={() => setPhase('confirming')}
              >
                รีเซ็ตรหัสผ่าน
              </button>
            </div>
          </div>
        ) : (
          <div className="stack" style={{ gap: 12 }}>
            <p>รีเซ็ตรหัสผ่านของ {displayName(user)}? รหัสเดิมจะใช้เข้าสู่ระบบไม่ได้อีก</p>
            <div className="form-actions">
              <button
                type="button"
                className="btn btn--quiet btn--small"
                disabled={phase === 'working'}
                onClick={() => setPhase('idle')}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                className="btn btn--primary btn--small"
                disabled={phase === 'working' || disabled}
                onClick={handleConfirm}
              >
                {phase === 'working' ? 'กำลังรีเซ็ต...' : 'ยืนยันรีเซ็ต'}
              </button>
            </div>
          </div>
        )}

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
