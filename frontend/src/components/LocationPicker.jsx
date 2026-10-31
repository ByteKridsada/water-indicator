import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';

const DEFAULT_CENTER = [18.7904, 98.9847]; // เชียงใหม่ — จุดเริ่มต้นเมื่อยังไม่มีพิกัด

function ClickHandler({ onPick }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export function LocationPicker({ latitude, longitude, onChange }) {
  const hasPosition = Number.isFinite(latitude) && Number.isFinite(longitude);
  const center = hasPosition ? [latitude, longitude] : DEFAULT_CENTER;

  return (
    <div className="location-picker">
      <MapContainer center={center} zoom={hasPosition ? 14 : 8} style={{ height: 280, width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {hasPosition && <Marker position={center} />}
        <ClickHandler onPick={onChange} />
      </MapContainer>
      <p className="form-hint">คลิกบนแผนที่เพื่อกำหนดพิกัด</p>
    </div>
  );
}
