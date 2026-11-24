import { Link } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout.jsx';

// Static help page: there is no email on file we send to, so an admin issues a temporary
// password by hand (Users page -> edit user -> รีเซ็ตรหัสผ่าน). No form and no API call here.
export function ForgotPasswordPage() {
  return (
    <AuthLayout title="ลืมรหัสผ่าน?" subtitle="ระบบยังไม่ส่งลิงก์รีเซ็ตทางอีเมล ให้ผู้ดูแลระบบช่วยตั้งรหัสใหม่ให้">
      <ol className="auth-steps">
        <li>ติดต่อผู้ดูแลระบบ แจ้งอีเมลที่ใช้สมัคร เพื่อขอรหัสผ่านชั่วคราว</li>
        <li>เข้าสู่ระบบด้วยรหัสผ่านชั่วคราวที่ได้รับ</li>
        <li>ไปที่หน้าโปรไฟล์ แล้วเปลี่ยนเป็นรหัสผ่านใหม่ของคุณเอง</li>
      </ol>
      <p className="auth-note">
        ถ้าพิมพ์รหัสผ่านผิดหลายครั้ง ระบบจะล็อกการเข้าสู่ระบบของอีเมลนั้นชั่วคราว (สูงสุด 15 นาที) แม้ได้รหัสชั่วคราวแล้วก็อาจต้องรอก่อน
      </p>
      <p className="auth-switch">
        <Link to="/login">กลับไปเข้าสู่ระบบ</Link>
      </p>
    </AuthLayout>
  );
}
