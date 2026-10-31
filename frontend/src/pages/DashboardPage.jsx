import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { listLocations, deleteLocation } from '../api/locations.js';
import { listTeams } from '../api/teams.js';

export function DashboardPage() {
  const { user } = useAuth();
  const [locations, setLocations] = useState([]);
  const [teams, setTeams] = useState([]);
  const [q, setQ] = useState('');
  const [teamId, setTeamId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [locationsRes, teamsRes] = await Promise.all([
        listLocations({ q: q || undefined, teamId: teamId || undefined }),
        listTeams(),
      ]);
      setLocations(locationsRes.data);
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
  }, []);

  async function handleSearch(e) {
    e.preventDefault();
    load();
  }

  async function handleDelete(id) {
    if (!window.confirm('ลบจุดตรวจวัดนี้? ค่าตัวชี้วัดและรูปภาพทั้งหมดของจุดนี้จะถูกลบไปด้วย')) return;
    try {
      await deleteLocation(id);
      setLocations((prev) => prev.filter((l) => l.id !== id));
    } catch (err) {
      alert(err.message || 'ลบไม่สำเร็จ');
    }
  }

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <h1>รายการจุดตรวจวัด</h1>
        <Link to="/locations/new" className="btn btn--primary">
          + เพิ่มจุดตรวจวัด
        </Link>
      </div>

      <form className="filter-bar" onSubmit={handleSearch}>
        <input
          type="text"
          placeholder="ค้นหาชื่อจุด / ชื่อสมาชิก"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
          <option value="">ทุกทีม</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.team_name}
            </option>
          ))}
        </select>
        <button type="submit" className="btn">
          ค้นหา
        </button>
      </form>

      {error && <p className="form-error">{error}</p>}
      {loading ? (
        <p>กำลังโหลด...</p>
      ) : locations.length === 0 ? (
        <p className="empty-state">ยังไม่มีจุดตรวจวัด</p>
      ) : (
        <div className="location-grid">
          {locations.map((loc) => (
            <div key={loc.id} className="location-card">
              <div className="location-card__header">
                <h3>{loc.location_name}</h3>
                {loc.line_linked && <span className="chip chip--line">เชื่อม LINE</span>}
              </div>
              <p className="location-card__meta">ผู้รายงาน: {loc.member_name}</p>
              <p className="location-card__meta">
                ทีม: {loc.team ? loc.team.team_name : <em>ไม่มีทีม</em>}
              </p>
              {loc.meta_data_1 && <p className="location-card__meta">{loc.meta_data_1}</p>}
              <div className="location-card__actions">
                <Link to={`/locations/${loc.id}/edit`} className="btn btn--small">
                  แก้ไข
                </Link>
                {user?.role === 'admin' && (
                  <button
                    type="button"
                    className="btn btn--small btn--danger"
                    onClick={() => handleDelete(loc.id)}
                  >
                    ลบ
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
