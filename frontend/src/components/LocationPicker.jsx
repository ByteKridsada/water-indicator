import { useEffect, useState } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { parseCoordinates, searchPlaces } from '../api/geocode.js';

const DEFAULT_CENTER = [18.7904, 98.9847]; // Chiang Mai, used until a position is picked
const SEARCH_ZOOM = 15;

const PIN_ICON = L.divIcon({
  className: 'pick-marker',
  html: '<svg width="40" height="48" viewBox="0 0 24 29" aria-hidden="true"><path d="M12 28s9-8.1 9-15a9 9 0 1 0-18 0c0 6.9 9 15 9 15Z" fill="#5a56b8" stroke="#ffffff" stroke-width="1.6"></path><circle cx="12" cy="12.5" r="3.4" fill="#ffffff"></circle></svg>',
  iconSize: [40, 48],
  iconAnchor: [20, 47],
});

function ClickHandler({ onPick }) {
  useMapEvents({
    click(e) {
      onPick(Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6)));
    },
  });
  return null;
}

function FocusOnSearch({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.setView(target, SEARCH_ZOOM);
  }, [map, target]);
  return null;
}

function KeepPinInView({ position }) {
  const map = useMap();
  const [latitude, longitude] = position || [];
  useEffect(() => {
    if (latitude === undefined) return;
    const inRange = Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
    if (inRange && !map.getBounds().contains([latitude, longitude])) {
      map.panTo([latitude, longitude]);
    }
  }, [map, latitude, longitude]);
  return null;
}

function toNumberOrNull(text) {
  return text === '' ? null : Number(text);
}

export function LocationPicker({ latitude, longitude, onChange, disabled = false }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [focusTarget, setFocusTarget] = useState(null);

  const hasPosition = Number.isFinite(latitude) && Number.isFinite(longitude);
  const position = hasPosition ? [latitude, longitude] : null;

  function goTo(lat, lng) {
    onChange(lat, lng);
    setFocusTarget([lat, lng]);
  }

  async function handleSearch() {
    const text = query.trim();
    if (!text) return;
    setSearchError('');

    const coordinates = parseCoordinates(text);
    if (coordinates) {
      setResults(null);
      goTo(coordinates.latitude, coordinates.longitude);
      return;
    }

    setSearching(true);
    try {
      setResults(await searchPlaces(text));
    } catch {
      setResults(null);
      setSearchError('ค้นหาไม่สำเร็จ ลองใหม่อีกครั้ง หรือคลิกบนแผนที่เพื่อปักหมุดแทน');
    } finally {
      setSearching(false);
    }
  }

  function handleSelect(place) {
    goTo(place.latitude, place.longitude);
    setResults(null);
  }

  return (
    <>
      <div className="field">
        <label htmlFor="place-search-input">ค้นหาสถานที่หรือพิกัด</label>
        <div className="search-row">
          <input
            id="place-search-input"
            className="input"
            type="text"
            placeholder="เช่น ท่าแพ เชียงใหม่ หรือ 18.7904, 98.9847"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              // Enter would otherwise submit the surrounding location form
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSearch();
              }
            }}
          />
          <button type="button" className="btn btn--accent" onClick={handleSearch} disabled={searching || !query.trim()}>
            {searching ? 'กำลังค้นหา...' : 'ค้นหา'}
          </button>
        </div>
      </div>

      {searchError && <p className="form-error">{searchError}</p>}
      {results && results.length === 0 && (
        <p className="hint">ไม่พบสถานที่นี้ในประเทศไทย ลองเพิ่มชื่อตำบลหรืออำเภอ</p>
      )}
      {results && results.length > 0 && (
        <ul className="place-results">
          {results.map((place) => (
            <li key={place.id}>
              <button type="button" onClick={() => handleSelect(place)}>
                {place.name}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="picker-map">
        <MapContainer center={position || DEFAULT_CENTER} zoom={hasPosition ? 14 : 8}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {position && <Marker position={position} icon={PIN_ICON} />}
          {!disabled && <ClickHandler onPick={onChange} />}
          <FocusOnSearch target={focusTarget} />
          <KeepPinInView position={position} />
        </MapContainer>
      </div>
      <p className="hint">ค้นหาสถานที่ คลิกบนแผนที่เพื่อปักหมุด หรือกรอกพิกัดด้านล่าง</p>

      <div className="grid-2">
        <div className="field">
          <label htmlFor="coord-lat">Latitude</label>
          <input
            id="coord-lat"
            className="input num"
            type="number"
            step="any"
            min="-90"
            max="90"
            value={latitude ?? ''}
            onChange={(e) => onChange(toNumberOrNull(e.target.value), longitude)}
          />
        </div>
        <div className="field">
          <label htmlFor="coord-lng">Longitude</label>
          <input
            id="coord-lng"
            className="input num"
            type="number"
            step="any"
            min="-180"
            max="180"
            value={longitude ?? ''}
            onChange={(e) => onChange(latitude, toNumberOrNull(e.target.value))}
          />
        </div>
      </div>
    </>
  );
}
