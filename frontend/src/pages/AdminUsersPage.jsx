import { useEffect, useState } from 'react';
import { listUsers, updateUser } from '../api/users.js';
import { createTeam, deleteTeam, listTeams, renameTeam } from '../api/teams.js';
import { IconPlus, IconUserPlus } from '../components/icons.jsx';
import { displayName, formatDate } from '../lib/format.js';
import { UserAvatar } from '../components/UserAvatar.jsx';

export function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [editingTeamId, setEditingTeamId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [usersRes, teamsRes] = await Promise.all([
        listUsers({ unassigned: unassignedOnly ? true : undefined, limit: 100 }),
        listTeams(),
      ]);
      setUsers(usersRes.data);
      setTeams(teamsRes);
    } catch (err) {
      setError(err.message || 'โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unassignedOnly]);

  const unassignedCount = users.filter((u) => !u.team && u.role !== 'admin').length;

  // PATCH /users/:id doesn't return created_at, so merge onto the existing row to keep it
  async function patchUser(userId, payload) {
    try {
      const updated = await updateUser(userId, payload);
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, ...updated } : u)));
    } catch (err) {
      alert(err.message || 'อัปเดตไม่สำเร็จ');
    }
  }

  async function handleCreateTeam(e) {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    try {
      const team = await createTeam(newTeamName.trim());
      setTeams((prev) =>
        [...prev, { ...team, member_count: 0, location_count: 0 }].sort((a, b) => a.team_name.localeCompare(b.team_name, 'th'))
      );
      setNewTeamName('');
    } catch (err) {
      alert(err.message || 'สร้างทีมไม่สำเร็จ');
    }
  }

  async function handleRenameTeam(e) {
    e.preventDefault();
    const name = editingName.trim();
    if (!name) return;
    try {
      const updated = await renameTeam(editingTeamId, name);
      setTeams((prev) => prev.map((t) => (t.id === updated.id ? { ...t, team_name: updated.team_name } : t)));
      setUsers((prev) =>
        prev.map((u) => (u.team?.id === updated.id ? { ...u, team: { ...u.team, team_name: updated.team_name } } : u))
      );
      setEditingTeamId(null);
    } catch (err) {
      alert(err.message || 'เปลี่ยนชื่อทีมไม่สำเร็จ');
    }
  }

  async function handleDeleteTeam(team) {
    const message =
      `ลบทีม "${team.team_name}"?\n\n` +
      `สมาชิก ${team.member_count} คน และจุดตรวจวัด ${team.location_count} จุด จะกลายเป็น "ไม่มีทีม" ` +
      'สมาชิกเหล่านั้นจะแก้ไขจุดตรวจวัดไม่ได้จนกว่าจะกำหนดทีมใหม่ (จุดตรวจวัดไม่ถูกลบ)';
    if (!window.confirm(message)) return;
    try {
      await deleteTeam(team.id);
      await load();
    } catch (err) {
      alert(err.message || 'ลบทีมไม่สำเร็จ');
    }
  }

  return (
    <div className="page">
      <div>
        <h1 className="page-title">จัดการทีมผู้ใช้งาน</h1>
        <p className="page-sub">กำหนดทีมให้สมาชิกที่สมัครเข้ามา สมาชิกที่ยังไม่มีทีมจะแก้ไขจุดตรวจวัดใดไม่ได้</p>
      </div>

      {!unassignedOnly && unassignedCount > 0 && (
        <div className="banner" role="status">
          <span className="banner__icon">
            <IconUserPlus size={20} />
          </span>
          <div className="banner__text">
            <div className="banner__title">มีสมาชิก {unassignedCount} คนที่ยังไม่ถูกกำหนดทีม</div>
            <div>เลือกทีมให้แต่ละคนในรายการด้านล่าง ระบบจะบันทึกทันที</div>
          </div>
          <button type="button" className="btn btn--accent btn--small" onClick={() => setUnassignedOnly(true)}>
            ดูเฉพาะคนที่ยังไม่มีทีม
          </button>
        </div>
      )}

      <section className="card" aria-labelledby="teams-title">
        <h2 className="card-title" id="teams-title">
          ทีม
        </h2>
        {teams.length > 0 && (
          <ul className="team-chips">
            {teams.map((t) =>
              editingTeamId === t.id ? (
                <li key={t.id} className="team-chip">
                  <form className="inline-form" onSubmit={handleRenameTeam}>
                    <input
                      className="input"
                      type="text"
                      aria-label={`ชื่อใหม่ของ ${t.team_name}`}
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      autoFocus
                    />
                    <button type="submit" className="btn btn--accent btn--small">
                      บันทึก
                    </button>
                    <button type="button" className="link-button" onClick={() => setEditingTeamId(null)}>
                      ยกเลิก
                    </button>
                  </form>
                </li>
              ) : (
                <li key={t.id} className="team-chip">
                  <span>
                    <strong style={{ fontWeight: 600 }}>{t.team_name}</strong>{' '}
                    <span className="muted" style={{ fontSize: 13 }}>
                      {t.member_count} คน · {t.location_count} จุด
                    </span>
                  </span>
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => {
                      setEditingTeamId(t.id);
                      setEditingName(t.team_name);
                    }}
                  >
                    เปลี่ยนชื่อ
                  </button>
                  <button type="button" className="link-button link-button--danger" onClick={() => handleDeleteTeam(t)}>
                    ลบ
                  </button>
                </li>
              )
            )}
          </ul>
        )}
        <form className="inline-form" onSubmit={handleCreateTeam}>
          <input
            className="input"
            type="text"
            placeholder="ชื่อทีมใหม่"
            aria-label="ชื่อทีมใหม่"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
          />
          <button type="submit" className="btn btn--outline btn--small" disabled={!newTeamName.trim()}>
            <IconPlus size={16} />
            เพิ่มทีม
          </button>
        </form>
      </section>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h2 className="card-title">ผู้ใช้งาน</h2>
        <label className="checkbox">
          <input type="checkbox" checked={unassignedOnly} onChange={(e) => setUnassignedOnly(e.target.checked)} />
          แสดงเฉพาะคนที่ยังไม่มีทีม
        </label>
      </div>

      {error && <p className="form-error">{error}</p>}

      <section className="list-card" aria-label="รายชื่อผู้ใช้งาน">
        {loading ? (
          <p className="empty-state">กำลังโหลด...</p>
        ) : users.length === 0 ? (
          <p className="empty-state">ไม่มีผู้ใช้ตามเงื่อนไขนี้</p>
        ) : (
          <>
            <div className="list-row list-row--head users-row">
              <span>ผู้ใช้งาน</span>
              <span>บทบาท</span>
              <span>ทีม</span>
              <span>สมัครเมื่อ</span>
              <span>สถานะบัญชี</span>
            </div>
            {users.map((u) => (
              <div key={u.id} className="list-row users-row">
                <div className="cell-main">
                  <UserAvatar user={u} className="avatar--small" />
                  <div style={{ minWidth: 0 }}>
                    <div className="cell-title">{displayName(u)}</div>
                    {u.first_name && <div className="cell-sub">{u.email}</div>}
                    {!u.team && u.role !== 'admin' && (
                      <div className="cell-sub" style={{ color: 'var(--indigo-dark)', fontWeight: 600 }}>
                        ยังไม่มีทีม
                      </div>
                    )}
                  </div>
                </div>
                <select
                  className="select select--pill"
                  style={{ minWidth: 0, width: '100%' }}
                  aria-label={`บทบาทของ ${u.email}`}
                  value={u.role}
                  onChange={(e) => patchUser(u.id, { role: e.target.value })}
                >
                  <option value="member">สมาชิก</option>
                  <option value="admin">ผู้ดูแลระบบ</option>
                </select>
                <select
                  className="select select--pill"
                  style={{ minWidth: 0, width: '100%' }}
                  aria-label={`ทีมของ ${u.email}`}
                  value={u.team?.id || ''}
                  onChange={(e) => patchUser(u.id, { team_id: e.target.value || null })}
                >
                  <option value="">— ยังไม่กำหนดทีม —</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.team_name}
                    </option>
                  ))}
                </select>
                <span className="cell-sub">{u.created_at ? formatDate(u.created_at) : '—'}</span>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={u.is_active}
                    onChange={(e) => patchUser(u.id, { is_active: e.target.checked })}
                  />
                  {u.is_active ? 'ใช้งานได้' : 'ระงับ'}
                </label>
              </div>
            ))}
          </>
        )}
      </section>
    </div>
  );
}
