import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">ระบบรายงานคุณภาพน้ำ</div>
        <nav className="main-nav">
          <NavLink to="/" end>
            รายการจุดตรวจวัด
          </NavLink>
          <NavLink to="/map">แผนที่</NavLink>
          {user?.role === 'admin' && <NavLink to="/admin/users">จัดการผู้ใช้</NavLink>}
        </nav>
        <div className="user-menu">
          <span className="user-email">{user?.email}</span>
          {user?.team ? (
            <span className="team-badge">{user.team.team_name}</span>
          ) : (
            <span className="team-badge team-badge--none">ยังไม่มีทีม</span>
          )}
          <button type="button" className="btn btn--ghost" onClick={handleLogout}>
            ออกจากระบบ
          </button>
        </div>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
