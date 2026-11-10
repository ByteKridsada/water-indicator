import { useEffect, useState } from 'react';
import { listIndicatorTypes } from '../api/indicatorTypes.js';
import { createReading, fetchReadings } from '../api/readings.js';
import { formatDateTime } from '../lib/format.js';

const RECENT_COUNT = 10;

function flattenRecent(groups) {
  return groups
    .flatMap((group) => group.series.map((point) => ({ ...point, type: group.indicator_type })))
    .sort((a, b) => new Date(b.measured_at) - new Date(a.measured_at))
    .slice(0, RECENT_COUNT);
}

export function ReadingForm({ locationId }) {
  const [types, setTypes] = useState([]);
  const [recent, setRecent] = useState([]);
  const [typeId, setTypeId] = useState('');
  const [value, setValue] = useState('');
  const [measuredAt, setMeasuredAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  useEffect(() => {
    listIndicatorTypes()
      .then((list) => {
        setTypes(list);
        if (list.length > 0) setTypeId(list[0].id);
      })
      .catch(() => setTypes([]));
    fetchReadings(locationId)
      .then((groups) => setRecent(flattenRecent(groups)))
      .catch(() => setRecent([]));
  }, [locationId]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaved('');
    setSaving(true);
    try {
      const payload = { indicator_type_id: typeId, value: Number(value) };
      // datetime-local has no timezone; new Date() reads it as the browser's local time
      if (measuredAt) payload.measured_at = new Date(measuredAt).toISOString();
      await createReading(locationId, payload);
      const type = types.find((t) => t.id === typeId);
      setSaved(`บันทึก ${type?.name ?? 'ค่าตัวชี้วัด'} = ${value} แล้ว`);
      setValue('');
      setRecent(flattenRecent(await fetchReadings(locationId)));
    } catch (err) {
      setError(err.message || 'บันทึกค่าไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card" aria-labelledby="reading-title">
      <div>
        <h2 className="card-title" id="reading-title">
          บันทึกค่าตัวชี้วัด
        </h2>
        <p className="hint" style={{ marginTop: 4 }}>
          ใช้บันทึกค่าที่วัดด้วยมือ ค่าที่ได้จากรูปทาง LINE จะเข้าระบบเอง
        </p>
      </div>
      <form className="reading-fields" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="reading-type">ตัวชี้วัด</label>
          <select id="reading-type" className="select" value={typeId} onChange={(e) => setTypeId(e.target.value)} required>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.unit ? ` (${t.unit})` : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="reading-value">ค่าที่วัดได้</label>
          <input
            id="reading-value"
            className="input num"
            type="number"
            step="any"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="reading-at">วันเวลาที่วัด (ว่างไว้ = ตอนนี้)</label>
          <input
            id="reading-at"
            className="input"
            type="datetime-local"
            value={measuredAt}
            onChange={(e) => setMeasuredAt(e.target.value)}
          />
        </div>
        <button type="submit" className="btn btn--primary" disabled={saving || !typeId}>
          {saving ? 'กำลังบันทึก...' : 'บันทึกค่า'}
        </button>
      </form>
      {error && <p className="form-error">{error}</p>}
      {saved && <p className="form-success">{saved}</p>}

      {recent.length > 0 && (
        <div className="table-scroll">
          <table className="data-table reading-recent">
            <thead>
              <tr>
                <th>วันเวลาที่วัด</th>
                <th>ตัวชี้วัด</th>
                <th>ค่า</th>
                <th>ที่มา</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r, i) => (
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
