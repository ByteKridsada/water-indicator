import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { AuthLayout } from '../components/AuthLayout.jsx';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      navigate(location.state?.from?.pathname || '/', { replace: true });
    } catch (err) {
      setError(err.message || 'เข้าสู่ระบบไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout title="ระบบรายงานคุณภาพน้ำ" subtitle="เข้าสู่ระบบเพื่อจัดการจุดตรวจวัด">
      <form className="auth-fields" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="login-email">อีเมล</label>
          <input
            id="login-email"
            className="input"
            type="email"
            placeholder="name@example.com"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="login-password">รหัสผ่าน</label>
          <input
            id="login-password"
            className="input"
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
        </div>
        {error && <p className="form-error">{error}</p>}
        <button type="submit" className="btn btn--primary" disabled={submitting} style={{ height: 52 }}>
          {submitting ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
        </button>
      </form>
      <p className="auth-switch">
        ยังไม่มีบัญชี? <Link to="/register">สมัครสมาชิกใหม่</Link>
      </p>
      <p className="auth-note">
        สมาชิกที่ยังไม่ถูกกำหนดทีม จะยังแก้ไขข้อมูลจุดตรวจวัดไม่ได้ จนกว่าแอดมินจะกำหนดทีมให้
      </p>
    </AuthLayout>
  );
}
