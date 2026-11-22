import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { displayName } from '../lib/format.js';
import { IconDrop, IconList, IconLogout, IconMap, IconUsers } from './icons.jsx';
import { UserAvatar } from './UserAvatar.jsx';

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
        <div className="brand">
          <span className="brand-mark">
            <IconDrop size={24} />
          </span>
          ระบบคุณภาพน้ำ
        </div>

        <nav className="tabs" aria-label="เมนูหลัก">
          <NavLink to="/map" className="tab">
            <IconMap />
            แผนที่
          </NavLink>
          <NavLink to="/" end className="tab">
            <IconList />
            จุดตรวจวัด
          </NavLink>
          {user?.role === 'admin' && (
            <NavLink to="/admin/users" className="tab">
              <IconUsers />
              จัดการทีม
            </NavLink>
          )}
        </nav>

        <div className="user-block">
          <div className="user-block__text">
            <NavLink to="/profile" className="user-block__email" title={user?.email}>
              {displayName(user)}
            </NavLink>
            {user?.team ? (
              <span className="user-block__team">{user.team.team_name}</span>
            ) : user?.role === 'admin' ? (
              <span className="user-block__team">ผู้ดูแลระบบ</span>
            ) : (
              <span className="user-block__team user-block__team--none">ยังไม่มีทีม</span>
            )}
          </div>
          <UserAvatar as={NavLink} to="/profile" user={user} aria-label="ข้อมูลบัญชี" />
          <button type="button" className="round-btn" onClick={handleLogout} aria-label="ออกจากระบบ" title="ออกจากระบบ">
            <IconLogout />
          </button>
        </div>
      </header>

      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
