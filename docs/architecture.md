# Architecture — ระบบรายงานคุณภาพน้ำและแผนที่แสดงผลเชิงพื้นที่

อ้างอิงจาก TOR (งบ 50,000 บาท / 60 วัน) เลือก stack ที่ง่าย ต้นทุนต่ำ ติดตั้ง/ดูแลง่าย เพื่อให้ทำ MVP ทันกำหนดและงบ

## 1. Tech Stack

| Layer | เลือกใช้ | เหตุผล |
|---|---|---|
| Frontend | React (Vite) + TailwindCSS | เร็ว ทำ UI/Map/Dashboard ได้ในเวลาจำกัด |
| Map | Leaflet.js + OpenStreetMap tiles | ไม่มีค่าใช้จ่าย/ไม่ต้องขอ API Key เหมือน Google Maps, รองรับ custom image marker ได้ดี |
| Backend | Node.js + Express (REST API) | นิยม หา dev ง่าย, ไลบรารีเชื่อม LINE SDK พร้อมใช้ (`@line/bot-sdk`) |
| Database | PostgreSQL | รองรับ JSONB (เก็บผลตอบ AI แบบดิบ), ความสัมพันธ์ข้อมูลชัดเจน, ขยายเป็น PostGIS ได้ในอนาคตหากต้องคำนวณเชิงพื้นที่เพิ่ม |
| Auth | JWT + bcrypt | Stateless, ไม่ต้องมี session store เพิ่ม |
| File storage | Local disk (`/uploads/{locationId}/{yyyy-mm-dd}/`) | พอสำหรับ prototype งบจำกัด, โครงสร้าง path ออกแบบให้ย้ายขึ้น S3-compatible ได้ในอนาคตโดยไม่กระทบ schema |
| AI แปลผลภาพ | เรียกผ่าน external API (เช่น Claude Vision / Google Vision) ผ่าน interface กลาง `AIInterpreterService` | ไม่ล็อกกับ provider เดียว สวอปได้ถ้า provider เปลี่ยนราคา/เงื่อนไข |
| Job scheduler | `node-cron` ใน backend process เดียวกัน | ไม่ต้องมี infra แยก, พอสำหรับ job ลบไฟล์ทุก 24 ชม. |
| Deploy | Docker Compose (app + postgres) บน VPS เดียว | ต้นทุนต่ำ เหมาะกับงบ 50,000 บาท |

## 2. Component Diagram

```mermaid
flowchart TB
    subgraph Client
        WebApp[React SPA\n(Member Portal / Admin / Public Map)]
    end

    subgraph LINE
        LineOA[LINE Official Account]
    end

    subgraph Server["Backend (Node.js/Express)"]
        API[REST API]
        WebhookCtrl[LINE Webhook Controller]
        AuthSvc[Auth Service]
        AISvc[AI Interpreter Service]
        CronJob[Cron: Image Expiry Cleanup]
    end

    DB[(PostgreSQL)]
    Storage[(Local Disk /uploads)]
    AIProvider[[External AI Vision API]]

    WebApp -- HTTPS/JSON --> API
    API --> AuthSvc
    API --> DB
    LineOA -- Webhook (image event) --> WebhookCtrl
    WebhookCtrl --> Storage
    WebhookCtrl --> DB
    WebhookCtrl --> AISvc
    AISvc --> AIProvider
    AISvc --> DB
    CronJob --> Storage
    CronJob --> DB
    WebApp -- Leaflet tiles --> OSM[(OpenStreetMap)]
```

## 3. LINE Image Flow (Sequence)

```mermaid
sequenceDiagram
    participant U as ผู้ใช้ (LINE)
    participant L as LINE Platform
    participant W as Webhook Controller
    participant S as Disk Storage
    participant D as PostgreSQL
    participant A as AI Interpreter

    U->>L: ส่งรูปภาพ
    L->>W: POST /webhook/line (event: message/image)
    W->>L: GET content (image binary) ด้วย messageId
    W->>D: หา location จาก locations.line_user_id (ถ้าไม่พบ -> ปฏิเสธ/แจ้งให้ลงทะเบียนก่อน)
    W->>S: บันทึกไฟล์ /uploads/{locationId}/{yyyy-mm-dd}/{imageId}.jpg
    W->>D: insert images(location_id, line_user_id, file_path, received_at, expires_at=+24h)
    W->>A: ส่งภาพไปแปลผล
    A->>D: insert ai_image_results + indicator_readings (source='ai')
    Note over D,S: Cron ทุกชั่วโมง: หา images ที่ expires_at < now() และยังไม่ถูกลบ -> ลบไฟล์จริง, อัปเดต status='deleted', เก็บ row/ผลไว้ใน DB ต่อ
```

## 4. Users vs. Locations — ทำไมต้องแยกตารางเด็ดขาด

ข้อมูลจุดตรวจวัด (`locations`) ถูกส่งเข้ามาผ่าน LINE OA โดย**ใครก็ได้** ไม่จำเป็นต้องมีบัญชีผู้ใช้บนเว็บ (`users`) จึงออกแบบให้:

- `users` และ `locations` เป็นตารางอิสระจากกัน ไม่มี 1:1 บังคับ
- `locations.user_id` เป็น FK แบบ **nullable** และ**ไม่ unique** — ใช้เฉพาะกรณีมีบัญชีเว็บผูกอยู่จริง (เช่น แอดมินลงทะเบียนแทน หรือภายหลังเจ้าของจุดสมัครสมาชิกเว็บเพิ่ม) 1 user จึงดูแลได้มากกว่า 1 location ได้ด้วย
- การจับคู่รูปที่ส่งมาจาก LINE เข้ากับ location ที่ถูกต้อง ใช้ `locations.line_user_id` (ผูกไว้ล่วงหน้าต่อจุด) เป็น key — **ไม่เกี่ยวกับ `users` เลย**

## 5. Data Retention

- ไฟล์รูปต้นฉบับ (`images.file_path`) เก็บไว้สูงสุด **24 ชั่วโมง** หลังจากนั้น cron job จะลบไฟล์จริงออกจาก disk และตั้ง `images.status = 'deleted'`, `images.file_path = NULL`
- ผลการแปลผล (`ai_image_results`, `indicator_readings`) **ไม่ถูกลบ** ยังคงอยู่เพื่อใช้แสดงผลบนแผนที่/กราฟ

## 6. Role & Access

- `admin`: เข้าถึง/แก้ไขข้อมูล location ทั้งหมด, จัดการ indicator master data, ดูภาพ/ผลทุกจุด
- `member`: (ถ้าผูก `user_id` กับ location ของตนเอง) จัดการข้อมูล location ของตนเอง, ดูข้อมูล indicator ของจุดที่ตนดูแล

ดู ER diagram และ DDL เต็มใน [db/schema.sql](../db/schema.sql)
