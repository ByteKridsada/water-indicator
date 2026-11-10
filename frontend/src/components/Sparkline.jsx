import { useState } from 'react';
import { formatDateTime } from '../lib/format.js';

const PAD_X = 6;
const PAD_Y = 6;

export function Sparkline({ series, unit = '', width = 150, height = 44, color = 'var(--teal)' }) {
  const [hover, setHover] = useState(null);

  if (!series || series.length < 2) {
    return <p className="hint">ต้องมีอย่างน้อย 2 ค่าจึงจะแสดงแนวโน้ม</p>;
  }

  const values = series.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = (width - PAD_X * 2) / (series.length - 1);
  const points = series.map((p, i) => ({
    x: PAD_X + i * step,
    y: height - PAD_Y - ((p.value - min) / range) * (height - PAD_Y * 2),
    point: p,
  }));

  const line = points.map(({ x, y }, i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${points[points.length - 1].x.toFixed(1)},${height} L${points[0].x.toFixed(1)},${height} Z`;
  const last = points[points.length - 1];
  const active = hover === null ? null : points[hover];
  const unitText = unit ? ` ${unit}` : '';

  function handleMove(e) {
    const box = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * width;
    setHover(Math.max(0, Math.min(series.length - 1, Math.round((x - PAD_X) / step))));
  }

  return (
    <div className="sparkline" style={{ maxWidth: width }}>
      <svg
        width="100%"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`แนวโน้ม ${series.length} ค่า ต่ำสุด ${min}${unitText} สูงสุด ${max}${unitText} ล่าสุด ${last.point.value}${unitText}`}
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
      >
        <path d={area} fill={color} fillOpacity="0.12" />
        <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={last.x} cy={last.y} r="4" fill={color} stroke="var(--surface-soft)" strokeWidth="2" />
        {active && (
          <>
            <line x1={active.x} x2={active.x} y1="0" y2={height} stroke="#b9cfca" strokeWidth="1" />
            <circle cx={active.x} cy={active.y} r="5" fill={color} stroke="#ffffff" strokeWidth="2" />
          </>
        )}
      </svg>
      {active && (
        <span className="sparkline__tip" style={{ left: `${(active.x / width) * 100}%` }}>
          <span className="num">{active.point.value}</span>
          {unitText}
          <small>{formatDateTime(active.point.measured_at)}</small>
        </span>
      )}
    </div>
  );
}
