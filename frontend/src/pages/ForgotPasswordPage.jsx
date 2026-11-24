import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchAdminContacts } from '../api/auth.js';
import { AuthLayout } from '../components/AuthLayout.jsx';

// Help page: there is no email on file we send to, so an admin issues a temporary
// password by hand (Users page -> edit user -> รีเซ็ตรหัสผ่าน). The only API call is the
// public list of admin emails to contact (1-3 active admins).
export function ForgotPasswordPage() {
  // null = still loading, [] = none to show (no admin, or the request failed)
  const [emails, setEmails] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchAdminContacts()
      .then((list) => !cancelled && setEmails(list))
      .catch(() => !cancelled && setEmails([]));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AuthLayout title="ลืมรหัสผ่าน?" subtitle="ระบบยังไม่ส่งลิงก์รีเซ็ตทางอีเมล ให้ผู้ดูแลระบบช่วยตั้งรหัสใหม่ให้">
      <ol className="auth-steps">
        <li>ติดต่อผู้ดูแลระบบ แจ้งอีเมลที่ใช้สมัคร เพื่อขอรหัสผ่านชั่วคราว</li>
        <li>เข้าสู่ระบบด้วยรหัสผ่านชั่วคราวที่ได้รับ</li>
        <li>ไปที่หน้าโปรไฟล์ แล้วเปลี่ยนเป็นรหัสผ่านใหม่ของคุณเอง</li>
      </ol>

      {emails !== null && (
        <section className="auth-contacts" aria-labelledby="admin-contacts-title">
          <h2 className="auth-contacts__title" id="admin-contacts-title">
            อีเมลผู้ดูแลระบบ
          </h2>
          {emails.length > 0 ? (
            <ul>
              {emails.map((address) => (
                <li key={address}>
                  <a href={`mailto:${address}`}>{address}</a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">ยังไม่มีอีเมลผู้ดูแลระบบให้แสดง กรุณาติดต่อผู้ดูแลระบบโดยตรง</p>
          )}
        </section>
      )}

      <p className="auth-note">
        ถ้าพิมพ์รหัสผ่านผิดหลายครั้ง ระบบจะล็อกการเข้าสู่ระบบของอีเมลนั้นชั่วคราว (สูงสุด 15 นาที) แม้ได้รหัสชั่วคราวแล้วก็อาจต้องรอก่อน
      </p>
      <p className="auth-switch">
        <Link to="/login">กลับไปเข้าสู่ระบบ</Link>
      </p>
    </AuthLayout>
  );
}
