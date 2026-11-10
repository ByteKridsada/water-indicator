import { IconDrop } from './icons.jsx';

function MapArt() {
  return (
    <svg viewBox="0 0 640 860" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="640" height="860" fill="#dcebe6" />
      <path d="M0 160 L240 140 L380 220 L340 420 L150 480 L0 450 Z" fill="#e6f1ec" />
      <circle cx="120" cy="290" r="44" fill="#cfe5d9" />
      <circle cx="190" cy="340" r="30" fill="#cfe5d9" />
      <circle cx="520" cy="150" r="52" fill="#cfe5d9" />
      <path
        d="M-30 90 C 160 170, 250 330, 380 400 C 510 470, 590 600, 620 890"
        stroke="#a9d3e3"
        strokeWidth="44"
        fill="none"
        strokeLinecap="round"
      />
      <ellipse cx="180" cy="640" rx="110" ry="66" fill="#a9d3e3" />
      <g stroke="#f7fbfa" strokeWidth="7" fill="none" strokeLinecap="round">
        <path d="M60 260 L420 230 L660 300" />
        <path d="M0 760 L640 720" />
      </g>
      <rect x="318" y="372" width="56" height="56" rx="20" fill="#e3eeec" stroke="#0e7c66" strokeWidth="3" />
      <rect x="430" y="555" width="48" height="48" rx="18" fill="#e3eeec" stroke="#0e7c66" strokeWidth="3" />
      <rect x="150" y="226" width="48" height="48" rx="18" fill="#e3eeec" stroke="#0e7c66" strokeWidth="3" />
      <circle cx="346" cy="400" r="40" fill="none" stroke="#5a56b8" strokeWidth="3" opacity=".4" />
    </svg>
  );
}

export function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="auth-page">
      <section className="auth-art" aria-hidden="true">
        <MapArt />
        <div className="auth-art__caption">
          <h2>แผนที่แสดงผลเชิงพื้นที่</h2>
          <p>จัดการข้อมูลจุดตรวจวัด และดูค่าตัวชี้วัดคุณภาพน้ำของทุกจุดบนแผนที่เดียว</p>
        </div>
      </section>
      <main className="auth-main">
        <div className="auth-form">
          <div className="auth-brand">
            <span className="brand-mark" style={{ width: 52, height: 52, borderRadius: 18 }}>
              <IconDrop size={26} />
            </span>
            <div>
              <h1>{title}</h1>
              <p className="muted">{subtitle}</p>
            </div>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
