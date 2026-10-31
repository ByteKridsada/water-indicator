import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await register(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'สมัครสมาชิกไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>สมัครสมาชิก</h1>
        <label>
          อีเมล
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          รหัสผ่าน (อย่างน้อย 8 ตัวอักษร)
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button type="submit" className="btn btn--primary" disabled={submitting}>
          {submitting ? 'กำลังสมัคร...' : 'สมัครสมาชิก'}
        </button>
        <p className="form-hint">
          บัญชีใหม่จะยังไม่ถูกกำหนดทีม — รอแอดมินกำหนดทีมก่อนจึงจะสร้าง/แก้ไขจุดตรวจวัดได้
        </p>
        <p className="auth-switch">
          มีบัญชีอยู่แล้ว? <Link to="/login">เข้าสู่ระบบ</Link>
        </p>
      </form>
    </div>
  );
}
