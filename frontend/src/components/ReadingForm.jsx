import { useEffect, useState } from 'react';
import { listIndicatorTypes } from '../api/indicatorTypes.js';
import { createReading, fetchReadings } from '../api/readings.js';

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
    <section className="reading-form">
      <h3>บันทึกค่าตัวชี้วัด</h3>
      <p className="form-hint">ใช้บันทึกค่าที่วัดด้วยมือ ค่าที่ได้จากรูปทาง LINE จะเข้าระบบเอง</p>
      <form className="reading-form__fields" onSubmit={handleSubmit}>
        <label>
          ตัวชี้วัด
          <select value={typeId} onChange={(e) => setTypeId(e.target.value)} required>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.unit ? ` (${t.unit})` : ''}
              </option>
            ))}
          </select>
        </label>
        <label>
          ค่าที่วัดได้
          <input type="number" step="any" value={value} onChange={(e) => setValue(e.target.value)} required />
        </label>
        <label>
          วันเวลาที่วัด (ว่างไว้ = ตอนนี้)
          <input type="datetime-local" value={measuredAt} onChange={(e) => setMeasuredAt(e.target.value)} />
        </label>
        <button type="submit" className="btn btn--primary" disabled={saving || !typeId}>
          {saving ? 'กำลังบันทึก...' : 'บันทึกค่า'}
        </button>
      </form>
      {error && <p className="form-error">{error}</p>}
      {saved && <p className="form-success">{saved}</p>}

      {recent.length > 0 && (
        <table className="data-table reading-form__recent">
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
                <td>{new Date(r.measured_at).toLocaleString('th-TH')}</td>
                <td>{r.type.name}</td>
                <td>
                  {r.value}
                  {r.type.unit ? ` ${r.type.unit}` : ''}
                </td>
                <td>{r.source === 'ai' ? 'แปลผลจากรูป' : 'บันทึกด้วยมือ'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
