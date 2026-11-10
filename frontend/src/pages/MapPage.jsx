import { useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import { fetchLocationImageUrl, listLocations } from '../api/locations.js';
import { listTeams } from '../api/teams.js';
import { fetchReadings } from '../api/readings.js';
import { Sparkline } from '../components/Sparkline.jsx';

const DEFAULT_CENTER = [18.7904, 98.9847];
const PALETTE = ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2'];

function colorFor(code, index) {
  return PALETTE[index % PALETTE.length];
}

// Images sit behind an authenticated endpoint, so each one is fetched as a blob
// and shown through an object URL, which is revoked when the location list changes.
function useLocationImages(locations) {
  const [urls, setUrls] = useState({});

  useEffect(() => {
    let cancelled = false;
    const created = [];
    const withImage = locations.filter((loc) => loc.avatar_image_url);
    Promise.all(
      withImage.map((loc) =>
        fetchLocationImageUrl(loc.id)
          .then((url) => {
            created.push(url);
            return [loc.id, url];
          })
          .catch(() => null)
      )
    ).then((pairs) => {
      if (!cancelled) setUrls(Object.fromEntries(pairs.filter(Boolean)));
    });
    return () => {
      cancelled = true;
      created.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [locations]);

  return urls;
}

function imageIcon(url) {
  return L.divIcon({
    className: 'image-marker',
    html: `<img src="${url}" alt="" />`,
    iconSize: [48, 48],
    iconAnchor: [24, 24],
    popupAnchor: [0, -26],
  });
}

function LocationPopup({ location }) {
  const [series, setSeries] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReadings(location.id)
      .then(setSeries)
      .catch(() => setSeries([]))
      .finally(() => setLoading(false));
  }, [location.id]);

  return (
    <div className="map-popup">
      <h3>{location.location_name}</h3>
      <p className="muted">
        {location.member_name} · {location.team ? location.team.team_name : 'ไม่มีทีม'}
      </p>
      {location.meta_data_1 && <p className="muted">{location.meta_data_1}</p>}

      {loading ? (
        <p>กำลังโหลดกราฟ...</p>
      ) : series.length === 0 ? (
        <p className="muted">ยังไม่มีค่าตัวชี้วัด</p>
      ) : (
        <div className="popup-charts">
          {series.map((s, i) => (
            <div key={s.indicator_type.id} className="popup-chart">
              <div className="popup-chart__label">
                {s.indicator_type.name}
                {s.indicator_type.unit ? ` (${s.indicator_type.unit})` : ''}
              </div>
              <Sparkline series={s.series} color={colorFor(s.indicator_type.code, i)} />
              <div className="popup-chart__latest">
                ล่าสุด: {s.series[s.series.length - 1]?.value}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function MapPage() {
  const [locations, setLocations] = useState([]);
  const [teams, setTeams] = useState([]);
  const [teamId, setTeamId] = useState('');
  const [showTable, setShowTable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    listLocations({ teamId: teamId || undefined, include: 'latest_readings', limit: 100 })
      .then((res) => setLocations(res.data))
      .catch((err) => setError(err.message || 'โหลดข้อมูลไม่สำเร็จ'))
      .finally(() => setLoading(false));
  }, [teamId]);

  useEffect(() => {
    listTeams().then(setTeams).catch(() => setTeams([]));
  }, []);

  const imageUrls = useLocationImages(locations);
  const icons = useMemo(
    () => Object.fromEntries(Object.entries(imageUrls).map(([id, url]) => [id, imageIcon(url)])),
    [imageUrls]
  );

  const center = useMemo(() => {
    if (locations.length === 0) return DEFAULT_CENTER;
    return [locations[0].latitude, locations[0].longitude];
  }, [locations]);

  return (
    <div className="map-page">
      <div className="page-header">
        <h1>แผนที่จุดตรวจวัด</h1>
        <div className="map-controls">
          <select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
            <option value="">ทุกทีม</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.team_name}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn--small" onClick={() => setShowTable((v) => !v)}>
            {showTable ? 'แสดงเป็นแผนที่' : 'แสดงเป็นตาราง'}
          </button>
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}

      {showTable ? (
        <table className="data-table">
          <thead>
            <tr>
              <th>จุดตรวจวัด</th>
              <th>ทีม</th>
              <th>ตัวชี้วัดล่าสุด</th>
            </tr>
          </thead>
          <tbody>
            {locations.map((loc) => (
              <tr key={loc.id}>
                <td>{loc.location_name}</td>
                <td>{loc.team ? loc.team.team_name : 'ไม่มีทีม'}</td>
                <td>
                  {(loc.latest_readings || [])
                    .map((r) => `${r.indicator_type.name}: ${r.value}${r.indicator_type.unit || ''}`)
                    .join(' · ') || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : loading ? (
        <p>กำลังโหลด...</p>
      ) : (
        <MapContainer center={center} zoom={10} style={{ height: '70vh', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {locations.map((loc) => (
            <Marker
              key={loc.id}
              position={[loc.latitude, loc.longitude]}
              title={loc.location_name}
              {...(icons[loc.id] ? { icon: icons[loc.id] } : {})}
            >
              <Popup minWidth={260}>
                <LocationPopup location={loc} />
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      )}
    </div>
  );
}
