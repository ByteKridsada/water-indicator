import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { listLocations, deleteLocation } from '../api/locations.js';
import { listTeams } from '../api/teams.js';
import { useLocationImages } from '../hooks/useLocationImages.js';
import { IconCheck, IconChevronRight, IconImage, IconLink, IconPin, IconPlus } from '../components/icons.jsx';
import { timeAgo } from '../lib/format.js';

export function DashboardPage() {
  const { user } = useAuth();
  const [locations, setLocations] = useState([]);
  const [total, setTotal] = useState(0);
  const [teams, setTeams] = useState([]);
  const [q, setQ] = useState('');
  const [teamId, setTeamId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const imageUrls = useLocationImages(locations);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [locationsRes, teamsRes] = await Promise.all([
        listLocations({ q: q || undefined, teamId: teamId || undefined }),
        listTeams(),
      ]);
      setLocations(locationsRes.data);
      setTotal(locationsRes.meta.total);
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

  function handleSearch(e) {
    e.preventDefault();
    load();
  }

  async function handleDelete(loc) {
    if (!window.confirm(`ลบ "${loc.location_name}"? ค่าตัวชี้วัดและรูปภาพทั้งหมดของจุดนี้จะถูกลบไปด้วย`)) return;
    try {
      await deleteLocation(loc.id);
      setLocations((prev) => prev.filter((l) => l.id !== loc.id));
      setTotal((n) => n - 1);
    } catch (err) {
      alert(err.message || 'ลบไม่สำเร็จ');
    }
  }

  const linked = locations.filter((l) => l.line_linked).length;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">จุดตรวจวัด</h1>
          <p className="page-sub">สมาชิกในทีมเดียวกันแก้ไขจุดของทีมร่วมกันได้</p>
        </div>
        <Link to="/locations/new" className="btn btn--primary">
          <IconPlus />
          เพิ่มจุดตรวจวัดใหม่
        </Link>
      </div>

      <section className="stats" aria-label="สรุป">
        <div className="stat">
          <span className="stat__icon pill--teal">
            <IconPin size={22} />
          </span>
          <div>
            <div className="stat__value num">{total}</div>
            <div className="stat__label">จุดตรวจวัดทั้งหมด</div>
          </div>
        </div>
        <div className="stat">
          <span className="stat__icon pill--indigo">
            <IconLink size={22} />
          </span>
          <div>
            <div className="stat__value num">
              {linked} <span style={{ fontSize: 17, color: 'var(--muted)' }}>/ {locations.length}</span>
            </div>
            <div className="stat__label">ผูกบัญชี LINE แล้ว</div>
          </div>
        </div>
      </section>

      <form className="filter-bar" onSubmit={handleSearch} role="search">
        <div className="field">
          <label htmlFor="search-q">ค้นหา</label>
          <input
            id="search-q"
            className="input"
            type="search"
            placeholder="ชื่อจุดตรวจวัด"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="search-team">ทีม</label>
          <select id="search-team" className="select select--pill" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
            <option value="">ทุกทีม</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.team_name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn btn--accent btn--small" style={{ height: 44 }}>
          ค้นหา
        </button>
      </form>

      {error && <p className="form-error">{error}</p>}

      <section className="list-card" aria-label="รายการจุดตรวจวัด">
        {loading ? (
          <p className="empty-state">กำลังโหลด...</p>
        ) : locations.length === 0 ? (
          <p className="empty-state">ยังไม่มีจุดตรวจวัด กด "เพิ่มจุดตรวจวัดใหม่" เพื่อเริ่มต้น</p>
        ) : (
          <>
            <div className="list-row list-row--head locations-row">
              <span>สถานที่</span>
              <span>ทีม</span>
              <span>พิกัด</span>
              <span>ประเภทแหล่งน้ำ</span>
              <span>LINE</span>
              <span>อัปเดตล่าสุด</span>
              <span />
            </div>
            {locations.map((loc) => (
              <div key={loc.id} className="list-row locations-row">
                <div className="cell-main">
                  <span className="thumb">
                    {imageUrls[loc.id] ? <img src={imageUrls[loc.id]} alt="" /> : <IconImage size={20} />}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div className="cell-title">{loc.location_name}</div>
                  </div>
                </div>
                <span>
                  {loc.team ? (
                    <span className="pill pill--indigo">{loc.team.team_name}</span>
                  ) : (
                    <span className="pill pill--neutral">ไม่มีทีม</span>
                  )}
                </span>
                <span className="num cell-sub">
                  {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
                </span>
                <span>{loc.meta_data_1 ? <span className="pill pill--neutral">{loc.meta_data_1}</span> : '—'}</span>
                <span>
                  {loc.line_linked ? (
                    <span className="pill pill--teal">
                      <IconCheck size={12} />
                      ผูกแล้ว
                    </span>
                  ) : (
                    <span className="pill pill--neutral">ยังไม่ผูก</span>
                  )}
                </span>
                <span className="cell-sub">{timeAgo(loc.updated_at)}</span>
                <div className="cell-actions">
                  {user?.role === 'admin' && (
                    <button type="button" className="link-button link-button--danger" onClick={() => handleDelete(loc)}>
                      ลบ
                    </button>
                  )}
                  <Link to={`/locations/${loc.id}/edit`} className="link-button" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44 }}>
                    แก้ไข
                    <IconChevronRight size={14} />
                  </Link>
                </div>
              </div>
            ))}
          </>
        )}
      </section>
    </div>
  );
}
