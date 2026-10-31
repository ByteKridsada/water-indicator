const WIDTH = 220;
const HEIGHT = 64;
const PADDING = 6;

export function Sparkline({ series, color }) {
  if (!series || series.length === 0) {
    return <div className="sparkline sparkline--empty">ไม่มีข้อมูล</div>;
  }
  if (series.length === 1) {
    return (
      <div className="sparkline sparkline--single">
        <strong>{series[0].value}</strong>
      </div>
    );
  }

  const values = series.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = series.map((p, i) => {
    const x = PADDING + (i / (series.length - 1)) * (WIDTH - PADDING * 2);
    const y = HEIGHT - PADDING - ((p.value - min) / range) * (HEIGHT - PADDING * 2);
    return [x, y];
  });

  const path = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const last = points[points.length - 1];

  return (
    <svg
      className="sparkline"
      width={WIDTH}
      height={HEIGHT}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={`กราฟแนวโน้ม ${series.length} ค่า ตั้งแต่ ${values[0]} ถึง ${values[values.length - 1]}`}
    >
      <path d={path} fill="none" stroke={color} strokeWidth="2" />
      <circle cx={last[0]} cy={last[1]} r="3" fill={color} />
    </svg>
  );
}
