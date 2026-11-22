# REST API Spec — ระบบรายงานคุณภาพน้ำและแผนที่แสดงผลเชิงพื้นที่

อ้างอิง [db/schema.sql](../db/schema.sql) และ [docs/architecture.md](architecture.md)
Base path: `/api/v1` · Content-Type: `application/json` · เวลาเป็น ISO 8601 (timestamptz)

---

## 1. ข้อตกลงร่วม (Conventions)

### Authentication
JWT ส่งผ่าน header `Authorization: Bearer <token>` ทุก endpoint ยกเว้น `/auth/register`, `/auth/login` และ `/webhook/line` (ซึ่งยืนยันตัวตนด้วย LINE signature แทน)

### Authorization — กฎเดียวที่ใช้ทั้งระบบ

```
canEditLocation(user, location):
    if user.role == 'admin'      -> true
    if user.team_id == null      -> false        # รอแอดมินกำหนดทีม
    return user.team_id == location.team_id
```

บังคับที่ **application layer** ไม่ใช่ DB constraint (ตามที่ระบุใน architecture.md ข้อ 4) — สมาชิกทุกคนในทีมเดียวกันแก้ไข location ของทีมได้ร่วมกัน ไม่ผูกกับเจ้าของคนเดียว

### Pagination
Query `?page=1&limit=20` (limit สูงสุด 100) ตอบกลับ:

```json
{ "data": [ ... ], "meta": { "page": 1, "limit": 20, "total": 134 } }
```

### Error shape

```json
{ "error": { "code": "LOCATION_FORBIDDEN", "message": "ไม่มีสิทธิ์แก้ไขจุดตรวจวัดนี้" } }
```

| Status | ใช้เมื่อ |
|---|---|
| 400 | payload ผิดรูปแบบ / validation ไม่ผ่าน |
| 401 | ไม่มี token หรือ token หมดอายุ |
| 403 | login แล้วแต่ไม่มีสิทธิ์ (รวมกรณี `team_id` เป็น null) |
| 404 | ไม่พบ resource |
| 409 | ขัดแย้งกับข้อมูลเดิม (เช่น email ซ้ำ, ลบ indicator_type ที่มีการใช้งาน) |
| 410 | ไฟล์ภาพถูกลบตาม retention 24 ชม. แล้ว |
| 413 | ไฟล์อัปโหลดใหญ่เกินกำหนด |
| 422 | พิกัดนอกช่วง / ค่า indicator ไม่ใช่ตัวเลข |

---

## 2. Auth & Profile

| Method | Path | สิทธิ์ | หน้าที่ |
|---|---|---|---|
| POST | `/auth/register` | public | สมัครสมาชิก — สร้าง user ด้วย `role='member'`, `team_id=null` |
| POST | `/auth/login` | public | คืน JWT |
| GET | `/auth/me` | authenticated | ข้อมูลบัญชีตนเอง + ทีมที่สังกัด |
| PATCH | `/auth/me` | authenticated | แก้ไข `email` / `first_name` / `last_name` ของตนเอง (ส่งเฉพาะฟิลด์ที่เปลี่ยน) — ส่ง `team_id` หรือ `role` มา -> 400 |
| POST | `/auth/me/password` | authenticated | เปลี่ยนรหัสผ่าน (ต้องส่ง `current_password`) |
| POST | `/auth/me/avatar` | authenticated | อัปโหลดรูปโปรไฟล์ (multipart ฟิลด์ `image`, JPG/PNG/WebP ตรวจจาก magic bytes) คืน user ที่อัปเดตแล้ว |
| GET | `/auth/me/avatar` | authenticated | ไฟล์รูปโปรไฟล์ของตนเอง — 404 ถ้ายังไม่มี |
| DELETE | `/auth/me/avatar` | authenticated | ลบรูปโปรไฟล์ คืน user ที่อัปเดตแล้ว |

`POST /auth/register`

```json
// request — first_name และ last_name บังคับ (1–100 ตัวอักษร)
{ "email": "suchada@example.org", "password": "••••••••", "first_name": "สุชาดา", "last_name": "อินทร" }

// 201 response
{
  "data": {
    "token": "eyJhbGci...",
    "user": {
      "id": "uuid", "email": "suchada@example.org",
      "first_name": "สุชาดา", "last_name": "อินทร",
      "role": "member", "team": null, "avatar_url": null
    }
  }
}
```

`avatar_url` เป็น `/api/v1/auth/me/avatar?v=<เวลาแก้ไขล่าสุด>` เมื่อมีรูป — `?v=` เปลี่ยนทุกครั้งที่อัปโหลดใหม่ เพื่อไม่ให้ browser ใช้รูปเก่าที่ cache ไว้ บัญชีที่สร้างก่อนมีฟิลด์ชื่อ (รวมถึงแอดมินที่ `migrate` สร้าง) จะมี `first_name`/`last_name` เป็น null จนกว่าจะกรอกในหน้าโปรไฟล์

**หมายเหตุสำคัญ:** `role` และ `team_id` **ไม่รับจาก client** ตอน register เสมอ — กำหนดโดย server เท่านั้น ไม่งั้นผู้สมัครจะตั้งตัวเองเป็น admin ได้ · ทีมเปลี่ยนได้โดยแอดมินเท่านั้น (`PATCH /users/:id`) เพราะทีมเป็นตัวกำหนดว่าสมาชิกแก้ไข location ใดได้

ผู้ใช้ที่ `team_id` เป็น null จะ login ได้ แต่ `canEditLocation` คืน false ทุกกรณี (ดูได้แต่แก้ไม่ได้) จนกว่าแอดมินจะกำหนดทีม

---

## 3. Teams

| Method | Path | สิทธิ์ | หมายเหตุ |
|---|---|---|---|
| GET | `/teams` | authenticated | ใช้เติม dropdown ในฟอร์มและ filter บนแผนที่ |
| POST | `/teams` | admin | `{ "team_name": "ทีมลุ่มน้ำปิง" }` — ซ้ำ -> 409 |
| PATCH | `/teams/:id` | admin | เปลี่ยนชื่อทีมจุดเดียว มีผลทุก location/user ที่อ้างถึง |
| DELETE | `/teams/:id` | admin | **ไม่ลบ location** — FK เป็น `ON DELETE SET NULL` จุดที่สังกัดจะกลายเป็นไม่มีทีม ต้องเตือนผู้ใช้ก่อนยืนยัน |

---

## 4. Users (ฝั่งแอดมิน)

| Method | Path | สิทธิ์ | หมายเหตุ |
|---|---|---|---|
| GET | `/users` | admin | filter: `?team_id=`, `?unassigned=true`, `?q=` (ค้นหาจากอีเมล ชื่อ นามสกุล) — แต่ละคนมี `first_name`, `last_name`, `avatar_url` |
| PATCH | `/users/:id` | admin | กำหนด `team_id` / เปลี่ยน `role` / `is_active` (แอดมินใช้ endpoint นี้เปลี่ยนทีมของตัวเองจากหน้าโปรไฟล์ด้วย) |
| GET | `/users/:id/avatar` | admin | ไฟล์รูปโปรไฟล์ของผู้ใช้คนนั้น |

`?unassigned=true` คือ query ที่หน้า Admin ใช้แสดงแบนเนอร์ "มีสมาชิก N คนที่ยังไม่ถูกกำหนดทีม"

**ไม่มี `DELETE /users/:id`** — ใช้ `PATCH { "is_active": false }` แทน เพราะการลบ user ทิ้งจะทำให้ `locations.created_by_user_id` กลายเป็น null และเสีย audit trail ไปโดยไม่จำเป็น

---

## 5. Locations (หัวใจของระบบ)

| Method | Path | สิทธิ์ | หมายเหตุ |
|---|---|---|---|
| GET | `/locations` | authenticated | รายการ/แผนที่ |
| GET | `/locations/:id` | authenticated | รายละเอียดสำหรับ popup |
| POST | `/locations` | admin หรือ member ที่มีทีม | สร้างจุดใหม่ |
| PATCH | `/locations/:id` | `canEditLocation` | แก้ไข |
| DELETE | `/locations/:id` | **admin เท่านั้น** | cascade ลบ images + indicator_readings ทั้งหมดของจุดนั้น |
| POST | `/locations/:id/image` | `canEditLocation` | อัปโหลดรูปหมุด (multipart) |
| DELETE | `/locations/:id/image` | `canEditLocation` | ลบรูปหมุด |

เหตุผลที่ `DELETE /locations/:id` จำกัดไว้ที่ admin: มันลบประวัติค่าตัวชี้วัดทั้งหมดของจุดนั้นไปด้วย (ตาม `ON DELETE CASCADE`) ซึ่งกู้คืนไม่ได้ — member ควรแก้ไขได้ แต่ไม่ควรลบทิ้งได้เอง

### GET /locations

Query parameters:

| Param | ตัวอย่าง | หน้าที่ |
|---|---|---|
| `team_id` | uuid | กรองตามทีม |
| `meta_data_1` | `แม่น้ำ` | กรองตาม Meta Data 1 |
| `q` | `บ้านดง` | ค้นหาจาก `location_name` |
| `bbox` | `98.90,18.70,99.05,18.85` | กรองตามกรอบพิกัดที่มองเห็นบนแผนที่ (`minLng,minLat,maxLng,maxLat`) |
| `include` | `latest_readings` | แนบค่าตัวชี้วัดล่าสุดของแต่ละ indicator type มาด้วย (หน้าแผนที่ใช้อันนี้) |

```json
// GET /locations?include=latest_readings
{
  "data": [
    {
      "id": "uuid",
      "location_name": "ท่าน้ำบ้านดง",
      "team": { "id": "uuid", "team_name": "ทีมลุ่มน้ำปิง" },
      "latitude": 18.7904,
      "longitude": 98.9847,
      "meta_data_1": "แม่น้ำ",
      "avatar_image_url": "/api/v1/locations/uuid/image",
      "line_linked": true,
      "latest_readings": [
        { "indicator_type": { "code": "ph", "name": "ค่าความเป็นกรด-ด่าง (pH)", "unit": null },
          "value": 7.4, "measured_at": "2026-10-25T10:24:00+07:00", "source": "ai" },
        { "indicator_type": { "code": "do", "name": "ออกซิเจนละลายน้ำ (DO)", "unit": "mg/L" },
          "value": 6.6, "measured_at": "2026-10-25T10:24:00+07:00", "source": "ai" }
      ],
      "updated_at": "2026-10-25T10:24:00+07:00"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 4 }
}
```

หมายเหตุ: ส่ง `line_linked` เป็น boolean แทนการส่ง `line_user_id` ดิบออกไป — LINE User ID เป็นข้อมูลระบุตัวบุคคล ไม่ควรหลุดไปอยู่ใน payload ของหน้าแผนที่ที่ทุกคนที่ login เห็น (ส่งค่าจริงเฉพาะใน `GET /locations/:id` ให้ผู้ที่ `canEditLocation` ผ่าน)

### POST /locations

```json
{
  "team_id": "uuid",            // optional (nullable ตาม schema)
  "location_name": "ท่าน้ำบ้านดง",
  "latitude": 18.7904,
  "longitude": 98.9847,
  "meta_data_1": "แม่น้ำ",
  "line_user_id": "U4af498..."  // optional
}
```

Validation: `latitude` ต้องอยู่ใน −90..90, `longitude` −180..180 (ตรงกับ CHECK constraint ใน DB — ตรวจทั้งสองชั้น) · `line_user_id` ซ้ำกับจุดอื่น -> 409

Server กำหนด `created_by_user_id` จาก JWT เอง **ไม่รับจาก client**

ไม่มีฟิลด์ `member_name` แล้ว — ผู้รับผิดชอบจุดตรวจวัดแสดงเป็น **ทีม** ของจุดนั้น และชื่อสมาชิกอยู่ในโปรไฟล์ของผู้ใช้ (`first_name`, `last_name`)

สิทธิ์ตอนสร้าง: `role='admin'` ส่ง `team_id` เป็นทีมใดก็ได้ · `role='member'` ส่งได้เฉพาะ `team_id` ของทีมตนเอง (ถ้าส่งทีมอื่น -> 403)

---

## 6. Indicator Types (master data)

| Method | Path | สิทธิ์ | หมายเหตุ |
|---|---|---|---|
| GET | `/indicator-types` | authenticated | |
| POST | `/indicator-types` | admin | `{ code, name, unit, description }` · `code` ซ้ำ -> 409 |
| PATCH | `/indicator-types/:id` | admin | |
| DELETE | `/indicator-types/:id` | admin | FK เป็น `ON DELETE RESTRICT` — ถ้ามี reading อ้างอยู่ -> **409** ไม่ใช่ลบตาม |

---

## 7. Indicator Readings

| Method | Path | สิทธิ์ | หมายเหตุ |
|---|---|---|---|
| GET | `/locations/:id/readings` | authenticated | ข้อมูลสำหรับกราฟ + ตาราง |
| POST | `/locations/:id/readings` | `canEditLocation` | บันทึกค่าด้วยมือ |
| DELETE | `/readings/:id` | admin | |

`GET /locations/:id/readings?from=2026-10-14&to=2026-10-25&indicator_type_id=uuid`

ตอบกลับแบบ **group ตาม indicator type** เพราะหน้า popup วาดกราฟแยกสเกลต่อตัวชี้วัด (small multiples) ไม่ได้วาดรวมแกนเดียว:

```json
{
  "data": [
    {
      "indicator_type": { "id": "uuid", "code": "ph", "name": "ค่าความเป็นกรด-ด่าง (pH)", "unit": null },
      "series": [
        { "measured_at": "2026-10-14T09:10:00+07:00", "value": 7.2, "source": "ai" },
        { "measured_at": "2026-10-15T09:05:00+07:00", "value": 7.3, "source": "ai" }
      ]
    }
  ]
}
```

`POST /locations/:id/readings`

```json
{ "indicator_type_id": "uuid", "value": 7.4, "measured_at": "2026-10-25T10:24:00+07:00" }
```

**`source` เป็นค่าที่ server กำหนด ไม่รับจาก client** — endpoint นี้เขียน `'manual'` ตายตัว ค่าที่ `source='ai'` สร้างได้จาก pipeline การแปลผลภาพเท่านั้น ถ้าให้ client ส่ง `source` มาได้ ก็จะปลอมที่มาของข้อมูลว่า "AI แปลผล" ได้

---

## 8. Images (รับจาก LINE OA)

| Method | Path | สิทธิ์ | หมายเหตุ |
|---|---|---|---|
| GET | `/locations/:id/images` | authenticated | รายการ record ภาพ + สถานะ |
| GET | `/images/:id/file` | `canEditLocation` | ไฟล์ต้นฉบับ — **410 Gone** ถ้าถูกลบตาม retention แล้ว |
| GET | `/images/:id/ai-result` | authenticated | ผลแปลผล AI (อยู่ถาวร แม้ไฟล์ถูกลบ) |

**ไม่มี POST** — ภาพการตรวจวัดเข้าระบบทาง LINE webhook ทางเดียวตาม TOR ข้อ 2.3 (`POST /locations/:id/image` ในข้อ 5 เป็นรูปหมุดบนแผนที่ คนละเรื่องกัน)

ไฟล์ถูกเสิร์ฟผ่าน endpoint นี้เท่านั้น **ไม่ expose โฟลเดอร์ `/uploads` เป็น static path** — ไม่งั้นใครเดา path ถูกก็ดูภาพของจุดอื่นได้โดยไม่ผ่านการตรวจสิทธิ์

ตาราง `images` มี `user_id` (nullable) อยู่คู่กับ `line_user_id` — บันทึกว่าภาพเป็นของบัญชีเว็บคนไหน ถ้าผู้ส่งมีบัญชี ส่วน `line_user_id` ยังเก็บไว้ตามที่ LINE ส่งมาเสมอ · วิธีเลือก `location_id` ให้ภาพแต่ละภาพยังไม่สรุป (ผูกกับข้อ 11 เรื่องการผูก LINE)

---

## 9. LINE Webhook

```
POST /webhook/line          (อยู่นอก /api/v1 · ไม่ใช้ JWT)
```

ลำดับการทำงาน:

1. **ตรวจ `X-Line-Signature` ก่อนทำอย่างอื่นทั้งสิ้น** — HMAC-SHA256 ของ **raw request body** ด้วย channel secret ไม่ตรง -> 401 ทันที (ต้องเก็บ raw body ไว้ก่อน parse JSON ไม่งั้นลายเซ็นจะไม่ตรง)
2. ตอบ **200 ทันที** แล้วประมวลผลแบบ async — LINE มี timeout สั้นและจะ retry ถ้าตอบช้า
3. สำหรับแต่ละ event ที่เป็น `message` + `type: image`:
   - idempotency: ถ้า `line_message_id` มีใน DB แล้ว -> ข้าม (ป้องกัน LINE retry บันทึกซ้ำ · มี UNIQUE constraint รองรับอยู่)
   - หา location จาก `locations.line_user_id` = `event.source.userId`
     - **ไม่พบ** -> reply ข้อความแจ้งให้ลงทะเบียนจุดก่อน แล้วไม่บันทึกภาพ
   - ดาวน์โหลดไฟล์ด้วย `GET /v2/bot/message/{messageId}/content`
   - เซฟที่ `/uploads/{locationId}/{yyyy-mm-dd}/{imageId}.jpg`
   - insert `images` (`status='received'`, `expires_at = received_at + 24h`)
   - ส่งเข้าคิวแปลผล AI -> insert `ai_image_results` + `indicator_readings` (`source='ai'`) -> `status='processed'`
   - แปลผลล้มเหลว -> `status='failed'` และเก็บ error ไว้ใน `ai_image_results.raw_response`

> **ขั้นตอน "หา location จาก line_user_id" ยังขึ้นกับคำถามที่ยังไม่ confirm** — ดูข้อ 11

---

## 10. Scheduled Job — 24h retention

ไม่ใช่ endpoint แต่เป็นส่วนที่ต้อง implement ให้ตรงกับ TOR ข้อ 2.3 (4)

```
ทุก 1 ชั่วโมง:
  SELECT id, file_path FROM images
  WHERE expires_at < now() AND status <> 'deleted'

  ต่อ record:  ลบไฟล์จริงออกจาก disk
               UPDATE images SET status='deleted', file_path=NULL, deleted_at=now()
```

`ai_image_results` และ `indicator_readings` **ไม่ถูกแตะ** — ผลแปลผลและค่าตัวชี้วัดต้องอยู่ต่อเพื่อแสดงบนแผนที่และกราฟ

ต้องทนกรณีไฟล์หายไปแล้ว (เคยลบสำเร็จแต่ update DB ไม่สำเร็จ) — ถือว่าสำเร็จและ update DB ต่อ ไม่ใช่ throw

---

## 11. จุดที่ spec นี้ยังค้างอยู่ (ต้อง confirm กับเจ้าของโครงการ)

| # | คำถาม | กระทบอะไรใน spec นี้ |
|---|---|---|
| 1 | **Meta Data 1 เก็บอะไร** และมีตัวเลือกจำกัดหรือกรอกเสรี | ถ้ามีตัวเลือกจำกัด `meta_data_1` ควรเป็น enum/lookup + validate ที่ API (400 ถ้าค่าไม่อยู่ในชุด) ตอนนี้เป็น free text |
| 2 | **การผูก `line_user_id` เข้ากับ location ทำตอนไหน/โดยใคร** | ข้อ 9 ขั้นที่ 3 — ถ้าให้ผู้ส่งเลือก location เองตอนส่ง (LIFF) ต้องเพิ่ม endpoint ผูกบัญชี และ `images.location_id` อาจต้องมีสถานะ "รอจับคู่" |
| 3 | **เกณฑ์มาตรฐานคุณภาพน้ำ** (ปกติ/เฝ้าระวัง/เกินมาตรฐาน) | ยังไม่ใส่ field `status` ใน response ของ `/locations` เพราะไม่มีเกณฑ์จริง — **ไม่ควรคิดเกณฑ์เอง** เพราะเป็นข้อมูลที่ผู้ใช้จะนำไปตัดสินใจ |
| 4 | **แผนที่ต้องเปิดให้คนทั่วไปดูได้โดยไม่ login หรือไม่** | ตอนนี้ `GET /locations` ต้อง authenticate ถ้าต้องเปิด public ต้องแยก endpoint สาธารณะที่ตัดข้อมูลส่วนบุคคลออก (ชื่อสมาชิก, LINE, email) |

---

## 12. Security checklist

- [ ] รหัสผ่าน hash ด้วย bcrypt (cost >= 10) ไม่เก็บ plaintext และไม่ส่ง `password_hash` ออก response ใดเลย
- [ ] `role`, `team_id`, `created_by_user_id`, `source` เป็นค่าที่ server กำหนด **ไม่รับจาก client**
- [ ] ตรวจ `X-Line-Signature` จาก raw body ก่อนประมวลผล webhook ทุกครั้ง
- [ ] rate limit `/auth/login` (ป้องกัน brute force)
- [ ] อัปโหลดรูป: ตรวจชนิดไฟล์จาก magic bytes ไม่ใช่แค่นามสกุล/`Content-Type`, จำกัดขนาด (เช่น 5MB -> 413), สร้างชื่อไฟล์เองด้วย UUID ไม่ใช้ชื่อที่ client ส่งมา (ป้องกัน path traversal)
- [ ] ไฟล์ทั้งหมดเสิร์ฟผ่าน API ที่ตรวจสิทธิ์ ไม่ใช่ static directory
- [ ] ไม่ส่ง `line_user_id` ใน list endpoint (ดูข้อ 5)
- [ ] ใช้ parameterized query / ORM ทุกจุด (ค่าที่มาจาก `q`, `bbox` ไปอยู่ใน SQL)
