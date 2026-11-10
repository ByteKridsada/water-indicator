import { useEffect, useState } from 'react';
import { listUsers, updateUser } from '../api/users.js';
import { createTeam, deleteTeam, listTeams, renameTeam } from '../api/teams.js';

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

  const unassignedCount = users.filter((u) => !u.team).length;

  async function handleTeamAssign(userId, teamId) {
    try {
      const updated = await updateUser(userId, { team_id: teamId || null });
      setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
    } catch (err) {
      alert(err.message || 'อัปเดตไม่สำเร็จ');
    }
  }

  async function handleRoleChange(userId, role) {
    try {
      const updated = await updateUser(userId, { role });
      setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
    } catch (err) {
      alert(err.message || 'อัปเดตไม่สำเร็จ');
    }
  }

  async function handleToggleActive(userId, isActive) {
    try {
      const updated = await updateUser(userId, { is_active: isActive });
      setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
    } catch (err) {
      alert(err.message || 'อัปเดตไม่สำเร็จ');
    }
  }

  async function handleCreateTeam(e) {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    try {
      const team = await createTeam(newTeamName.trim());
      setTeams((prev) => [...prev, team].sort((a, b) => a.team_name.localeCompare(b.team_name)));
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
    <div className="admin-users-page">
      <h1>จัดการผู้ใช้และทีม</h1>

      {!unassignedOnly && unassignedCount > 0 && (
        <div className="banner banner--warning">
          มีสมาชิก {unassignedCount} คนที่ยังไม่ถูกกำหนดทีม
          <button type="button" className="btn btn--small" onClick={() => setUnassignedOnly(true)}>
            ดูรายการ
          </button>
        </div>
      )}

      <section className="team-manager">
        <h2>ทีม</h2>
        <ul className="team-list">
          {teams.map((t) =>
            editingTeamId === t.id ? (
              <li key={t.id}>
                <form className="inline-form" onSubmit={handleRenameTeam}>
                  <input
                    type="text"
                    aria-label={`ชื่อใหม่ของ ${t.team_name}`}
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    autoFocus
                  />
                  <button type="submit" className="btn btn--small">
                    บันทึก
                  </button>
                  <button type="button" className="btn btn--small btn--ghost" onClick={() => setEditingTeamId(null)}>
                    ยกเลิก
                  </button>
                </form>
              </li>
            ) : (
              <li key={t.id}>
                {t.team_name} <span className="muted">({t.member_count} คน, {t.location_count} จุด)</span>
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
        <form className="inline-form" onSubmit={handleCreateTeam}>
          <input
            type="text"
            placeholder="ชื่อทีมใหม่"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
          />
          <button type="submit" className="btn btn--small">
            เพิ่มทีม
          </button>
        </form>
      </section>

      <section>
        <div className="filter-bar">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={unassignedOnly}
              onChange={(e) => setUnassignedOnly(e.target.checked)}
            />
            แสดงเฉพาะที่ยังไม่มีทีม
          </label>
        </div>

        {error && <p className="form-error">{error}</p>}
        {loading ? (
          <p>กำลังโหลด...</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>อีเมล</th>
                <th>ทีม</th>
                <th>บทบาท</th>
                <th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.email}</td>
                  <td>
                    <select value={u.team?.id || ''} onChange={(e) => handleTeamAssign(u.id, e.target.value)}>
                      <option value="">ไม่มีทีม</option>
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.team_name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select value={u.role} onChange={(e) => handleRoleChange(u.id, e.target.value)}>
                      <option value="member">member</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={u.is_active}
                        onChange={(e) => handleToggleActive(u.id, e.target.checked)}
                      />
                      ใช้งานได้
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
