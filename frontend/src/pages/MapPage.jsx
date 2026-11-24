import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import { useLeafletContext } from '@react-leaflet/core';
import MarkerClusterGroup from 'react-leaflet-cluster';
// transition rules for cluster zoom/spiderfy animations; the cluster look itself is ours (.loc-cluster)
import 'leaflet.markercluster/dist/MarkerCluster.css';
import { listLocations } from '../api/locations.js';
import { listTeams } from '../api/teams.js';
import { fetchReadings } from '../api/readings.js';
import { useLocationImages } from '../hooks/useLocationImages.js';
import { Sparkline } from '../components/Sparkline.jsx';
import { IconClose, IconImage } from '../components/icons.jsx';
import { formatDateTime } from '../lib/format.js';

const DEFAULT_CENTER = [18.7904, 98.9847];
const RANGES = [7, 30, 90];
const PLACEHOLDER_SVG =
  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5"></rect><path d="M3 15.5 8.5 11l4 3.5L16 11l5 4"></path><circle cx="8.5" cy="9" r="1.4"></circle></svg>';

// The image URL is a blob: object URL we created, never user-supplied text, so it is safe in the icon HTML.
function markerIcon(imageUrl, selected) {
  return L.divIcon({
    className: `loc-marker${selected ? ' loc-marker--selected' : ''}`,
    html: `<div class="loc-marker__body">${imageUrl ? `<img src="${imageUrl}" alt="" />` : PLACEHOLDER_SVG}</div>`,
    iconSize: [50, 50],
    iconAnchor: [25, 25],
  });
}

// One pin. The icon is memoised per pin so selecting a pin only swaps ITS icon: the Marker element
// stays alive, which keeps a spiderfied (fanned-out) group open instead of rebuilding the cluster.
function LocationMarker({ loc, imageUrl, selected, onSelect }) {
  const icon = useMemo(() => markerIcon(imageUrl, selected), [imageUrl, selected]);
  const markerRef = useRef(null);
  // The group is this marker's layer container. Redraw only the bubbles that contain THIS pin when
  // its selected state changes: a full refreshClusters() would also collapse an open fan.
  const { layerContainer } = useLeafletContext();
  useEffect(() => {
    if (markerRef.current) layerContainer?.refreshClusters?.(markerRef.current);
  }, [layerContainer, selected]);
  // A fresh [lat, lng] array on every render makes react-leaflet call setLatLng, which the cluster
  // group treats as "this pin moved" and answers by closing an open fan. Keep the array stable.
  const position = useMemo(() => [loc.latitude, loc.longitude], [loc.latitude, loc.longitude]);
  return (
    <Marker
      ref={markerRef}
      position={position}
      title={loc.location_name}
      icon={icon}
      zIndexOffset={selected ? 1000 : 0}
      eventHandlers={{ click: () => onSelect(loc.id) }}
    />
  );
}

// A group of nearby pins collapses into one numbered bubble; clicking it zooms in, and pins that
// share the exact same spot fan out ("spiderfy"). A bubble that hides the selected pin shows the
// same indigo ring; we read that from the pin's current icon class (setIcon keeps it up to date).
const isSelectedPin = (marker) => Boolean(marker.options.icon?.options?.className?.includes('loc-marker--selected'));

function clusterIcon(cluster) {
  const count = cluster.getChildCount();
  const hasSelected = cluster.getAllChildMarkers().some(isSelectedPin);
  const size = count < 10 ? 46 : count < 50 ? 54 : 62;
  return L.divIcon({
    className: `loc-cluster${hasSelected ? ' loc-cluster--selected' : ''}`,
    html: `<span title="${count} จุดตรวจวัด คลิกเพื่อขยาย">${count}</span>`,
    iconSize: [size, size],
  });
}

// the pins are 50px wide, so group anything closer than about one pin and a bit
const CLUSTER_RADIUS = 60;
const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function FitToLocations({ locations }) {
  const map = useMap();
  useEffect(() => {
    if (locations.length === 0) return;
    const bounds = L.latLngBounds(locations.map((loc) => [loc.latitude, loc.longitude]));
    // the detail panel is hidden until a pin is selected, so the whole map is free to fit
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 13 });
  }, [map, locations]);
  return null;
}

// On wide screens the detail panel floats over the map's right edge (410px wide + 18px inset).
// When a pin is selected and sits under where the panel will be, pan the map so the pin stays visible.
const PANEL_FOOTPRINT = 410 + 18 + 18;
const PANEL_GAP = 70;
const isStackedLayout = () => window.matchMedia('(max-width: 900px)').matches; // panel sits below the map

function KeepSelectedClearOfPanel({ location }) {
  const map = useMap();
  useEffect(() => {
    if (!location || isStackedLayout()) return;
    const point = map.latLngToContainerPoint([location.latitude, location.longitude]);
    const limit = map.getSize().x - PANEL_FOOTPRINT - PANEL_GAP;
    if (point.x > limit) map.panBy([point.x - limit, 0], { animate: !prefersReducedMotion() });
  }, [map, location]);
  return null;
}

function sinceDays(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function DetailPanel({ location, imageUrl, rangeDays, showTable, onToggleTable, onClose }) {
  const [groups, setGroups] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setGroups(null);
    fetchReadings(location.id, { from: sinceDays(rangeDays) })
      .then((data) => !cancelled && setGroups(data))
      .catch(() => !cancelled && setGroups([]));
    return () => {
      cancelled = true;
    };
  }, [location.id, rangeDays]);

  const newest = useMemo(() => {
    const all = (groups || []).flatMap((g) => g.series.map((p) => p.measured_at));
    return all.length ? all.reduce((a, b) => (new Date(a) > new Date(b) ? a : b)) : null;
  }, [groups]);

  return (
    <>
      <div className="detail-panel__handle" aria-hidden="true" />
      <div className="detail-head">
        <div className="cell-main">
          <span className="thumb">{imageUrl ? <img src={imageUrl} alt="" /> : <IconImage size={24} />}</span>
          <div style={{ minWidth: 0 }}>
            <h2 className="detail-title">{location.location_name}</h2>
            <p className="cell-sub">
              {location.team ? location.team.team_name : 'ไม่มีทีม'}
              {location.meta_data_1 ? ` · ${location.meta_data_1}` : ''}
            </p>
            <p className="cell-sub num" style={{ fontSize: 12 }}>
              {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
            </p>
          </div>
        </div>
        <button type="button" className="round-btn" style={{ width: 36, height: 36 }} onClick={onClose} aria-label="ปิดรายละเอียด">
          <IconClose size={12} />
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <span className="pill pill--indigo">{location.team ? location.team.team_name : 'ไม่มีทีม'}</span>
        {location.line_linked && <span className="pill pill--teal">ผูก LINE แล้ว</span>}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <h3 style={{ fontSize: 16 }}>ค่าล่าสุด · {rangeDays} วัน</h3>
        {newest && <span className="hint num">{formatDateTime(newest)}</span>}
      </div>

      {groups === null ? (
        <p className="hint">กำลังโหลดค่าตัวชี้วัด...</p>
      ) : groups.length === 0 ? (
        <p className="hint">ยังไม่มีค่าตัวชี้วัดในช่วง {rangeDays} วันที่ผ่านมา</p>
      ) : (
        <div className="tiles">
          {groups.map((g) => {
            const latest = g.series[g.series.length - 1];
            return (
              <div className="tile" key={g.indicator_type.id}>
                <div className="tile__label">{g.indicator_type.name}</div>
                <div className="tile__value num">
                  {latest.value}
                  {g.indicator_type.unit && <span className="tile__unit">{g.indicator_type.unit}</span>}
                </div>
                <div className="tile__date">{formatDateTime(latest.measured_at)}</div>
                <Sparkline series={g.series} unit={g.indicator_type.unit || ''} width={150} />
              </div>
            );
          })}
        </div>
      )}

      <div className="detail-actions">
        <button type="button" className="btn btn--outline" onClick={onToggleTable} disabled={!groups || groups.length === 0}>
          {showTable ? 'ซ่อนตาราง' : 'ดูเป็นตาราง'}
        </button>
        <Link to={`/locations/${location.id}/edit`} className="btn btn--primary">
          แก้ไขจุดนี้
        </Link>
      </div>
    </>
  );
}

function HistoryTable({ location, rangeDays, onLoaded }) {
  const [rows, setRows] = useState(null);

  // tell the parent once the rows are on screen, so it can scroll to the full-height table
  useEffect(() => {
    if (rows !== null) onLoaded?.();
  }, [rows, onLoaded]);

  useEffect(() => {
    fetchReadings(location.id, { from: sinceDays(rangeDays) })
      .then((groups) =>
        setRows(
          groups
            .flatMap((g) => g.series.map((p) => ({ ...p, type: g.indicator_type })))
            .sort((a, b) => new Date(b.measured_at) - new Date(a.measured_at))
        )
      )
      .catch(() => setRows([]));
  }, [location.id, rangeDays]);

  return (
    <section className="card" aria-label="ข้อมูลย้อนหลัง">
      <h2 className="card-title">
        ข้อมูลย้อนหลัง — {location.location_name} ({rangeDays} วัน)
      </h2>
      {rows === null ? (
        <p className="hint">กำลังโหลด...</p>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>วันเวลาที่วัด</th>
                <th>ตัวชี้วัด</th>
                <th>ค่า</th>
                <th>ที่มา</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.type.id}-${r.measured_at}-${i}`}>
                  <td>{formatDateTime(r.measured_at)}</td>
                  <td>{r.type.name}</td>
                  <td className="num">
                    {r.value}
                    {r.type.unit ? ` ${r.type.unit}` : ''}
                  </td>
                  <td>{r.source === 'ai' ? 'แปลผลจากรูป' : 'บันทึกด้วยมือ'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function MapPage() {
  const [locations, setLocations] = useState([]);
  const [teams, setTeams] = useState([]);
  const [teamId, setTeamId] = useState('');
  const [metaFilter, setMetaFilter] = useState('');
  const [rangeDays, setRangeDays] = useState(7);
  const [selectedId, setSelectedId] = useState(null);
  const [showTable, setShowTable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    listLocations({ teamId: teamId || undefined, limit: 100 })
      .then((res) => setLocations(res.data))
      .catch((err) => setError(err.message || 'โหลดข้อมูลไม่สำเร็จ'))
      .finally(() => setLoading(false));
  }, [teamId]);

  useEffect(() => {
    listTeams().then(setTeams).catch(() => setTeams([]));
  }, []);

  const metaOptions = useMemo(
    () => [...new Set(locations.map((l) => l.meta_data_1).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'th')),
    [locations]
  );
  const visible = useMemo(
    () => (metaFilter ? locations.filter((l) => l.meta_data_1 === metaFilter) : locations),
    [locations, metaFilter]
  );
  const selected = visible.find((l) => l.id === selectedId) || null;
  const imageUrls = useLocationImages(locations);

  // Scroll the page to what the user just asked for. Deferred to an effect because the element
  // only exists after the render that shows it.
  const panelRef = useRef(null);
  const tableRef = useRef(null);
  const scrollBehavior = () => (prefersReducedMotion() ? 'auto' : 'smooth');
  useEffect(() => {
    // narrow screens stack the panel under the map, where it would appear off-screen
    if (selectedId && isStackedLayout()) panelRef.current?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
  }, [selectedId]);
  // "view as table": scroll once now, and once more when the rows have loaded. While it still says
  // "loading" the table is short, so the page can't scroll far enough to put its top in view.
  // The second scroll only happens for the first load after opening, so switching the date range
  // with the table open doesn't yank the page back down.
  const scrollTableAfterLoad = useRef(false);
  const scrollToTable = () => tableRef.current?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
  useEffect(() => {
    scrollTableAfterLoad.current = showTable;
    if (showTable) scrollToTable();
  }, [showTable]);
  const handleTableLoaded = useCallback(() => {
    if (!scrollTableAfterLoad.current) return;
    scrollTableAfterLoad.current = false;
    tableRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  }, []);

  function select(id) {
    setSelectedId(id);
    setShowTable(false);
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">แผนที่จุดตรวจวัด</h1>
          <p className="page-sub">คลิกหมุดเพื่อดูรายละเอียดและค่าตัวชี้วัดของจุดนั้น · {visible.length} จุด</p>
        </div>
        <div className="filter-bar">
          <div className="field">
            <span className="field-label" id="range-label">ช่วงเวลา</span>
            <div className="seg" role="group" aria-labelledby="range-label">
              {RANGES.map((days) => (
                <button key={days} type="button" aria-pressed={rangeDays === days} onClick={() => setRangeDays(days)}>
                  {days} วัน
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label htmlFor="map-team">ทีม</label>
            <select id="map-team" className="select select--pill" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
              <option value="">ทุกทีม</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.team_name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="map-meta">ประเภทแหล่งน้ำ</label>
            <select id="map-meta" className="select select--pill" value={metaFilter} onChange={(e) => setMetaFilter(e.target.value)}>
              <option value="">ทุกประเภท</option>
              {metaOptions.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}

      <section className="map-card" aria-label="แผนที่">
        <MapContainer center={DEFAULT_CENTER} zoom={10}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitToLocations locations={visible} />
          <KeepSelectedClearOfPanel location={selected} />
          <MarkerClusterGroup
            iconCreateFunction={clusterIcon}
            maxClusterRadius={CLUSTER_RADIUS}
            showCoverageOnHover={false}
            chunkedLoading
            animate={!prefersReducedMotion()}
          >
            {visible.map((loc) => (
              <LocationMarker
                key={loc.id}
                loc={loc}
                imageUrl={imageUrls[loc.id]}
                selected={loc.id === selectedId}
                onSelect={select}
              />
            ))}
          </MarkerClusterGroup>
        </MapContainer>
        {!loading && visible.length === 0 && <div className="map-empty">ไม่มีจุดตรวจวัดตามตัวกรองนี้</div>}

        {/* no pin selected -> no panel at all, so the map gets the whole card */}
        {selected && (
          <aside ref={panelRef} className="detail-panel" aria-label="รายละเอียดจุดตรวจวัด">
            <DetailPanel
              location={selected}
              imageUrl={imageUrls[selected.id]}
              rangeDays={rangeDays}
              showTable={showTable}
              onToggleTable={() => setShowTable((v) => !v)}
              onClose={() => select(null)}
            />
          </aside>
        )}
      </section>

      {selected && showTable && (
        <div ref={tableRef} className="history-anchor">
          <HistoryTable location={selected} rangeDays={rangeDays} onLoaded={handleTableLoaded} />
        </div>
      )}
    </div>
  );
}
