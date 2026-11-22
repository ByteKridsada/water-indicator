import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { AuthLayout } from '../components/AuthLayout.jsx';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await register({ email, password, first_name: firstName, last_name: lastName });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'สมัครสมาชิกไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout title="สมัครสมาชิก" subtitle="สร้างบัญชีเพื่อเข้าร่วมทีมตรวจวัด">
      <form className="auth-fields" onSubmit={handleSubmit}>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="register-first">ชื่อ</label>
            <input
              id="register-first"
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
            <label htmlFor="register-last">นามสกุล</label>
            <input
              id="register-last"
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
          <label htmlFor="register-email">อีเมล</label>
          <input
            id="register-email"
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
          <label htmlFor="register-password">รหัสผ่าน (อย่างน้อย 8 ตัวอักษร)</label>
          <input
            id="register-password"
            className="input"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
        </div>
        {error && <p className="form-error">{error}</p>}
        <button type="submit" className="btn btn--primary" disabled={submitting} style={{ height: 52 }}>
          {submitting ? 'กำลังสมัคร...' : 'สมัครสมาชิก'}
        </button>
      </form>
      <p className="auth-switch">
        มีบัญชีอยู่แล้ว? <Link to="/login">เข้าสู่ระบบ</Link>
      </p>
      <p className="auth-note">
        บัญชีใหม่จะยังไม่มีทีม ต้องรอแอดมินกำหนดทีมก่อน จึงจะสร้างหรือแก้ไขจุดตรวจวัดได้
      </p>
    </AuthLayout>
  );
}
