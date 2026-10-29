-- ============================================================
-- Database Schema: ระบบรายงานคุณภาพน้ำและแผนที่แสดงผลเชิงพื้นที่
-- Engine: PostgreSQL 14+
-- ดูภาพรวม architecture ที่ docs/architecture.md
--
-- หมายเหตุการออกแบบ: users และ locations แยกกันเด็ดขาด (ไม่ใช่ 1:1)
-- เพราะข้อมูลจุดตรวจวัด (location) ถูกส่งเข้ามาผ่าน LINE OA โดยใครก็ได้
-- โดยไม่จำเป็นต้องมีบัญชีผู้ใช้บนเว็บ.
--
-- teams ผูกกับทั้ง users และ locations แยกเส้นทางกัน (ไม่ไหลผ่านกัน):
--   - locations.team_id: ระบุทีมของหมุดนั้นสำหรับแสดงผลบนแผนที่/popup
--     (ต้องมีค่าได้แม้ location ไม่มี user ผูกอยู่เลย — nullable เผื่อ
--     กรณีบุคคลทั่วไปส่งข้อมูลแบบไม่มีทีม)
--   - users.team_id: ใช้กำหนดสิทธิ์ของสมาชิกที่ login เว็บ — member คนไหน
--     ก็ได้ในทีมเดียวกันแก้ไขได้ทุก location ที่ team_id ตรงกัน ไม่ผูกกับ
--     "เจ้าของคนเดียว" (nullable เพราะสมาชิกสมัครก่อน แอดมินค่อยกำหนดทีมทีหลัง)
--   - locations.created_by_user_id: เก็บไว้เป็น audit เฉยๆ ว่า user คนไหน
--     (ถ้ามี) เป็นผู้ลงทะเบียน/แก้ไขจุดนี้ล่าสุดทางเว็บ — ไม่ใช่ตัวตัดสินสิทธิ์
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- สำหรับ gen_random_uuid()

-- ------------------------------------------------------------
-- teams: ชื่อทีมที่ประจำอยู่ที่จุดตรวจวัด (lookup, ใช้ซ้ำได้หลาย location)
-- ------------------------------------------------------------
CREATE TABLE teams (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_name   VARCHAR(255) NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- users: บัญชี login สำหรับเข้าใช้งานเว็บ (admin / member)
-- ไม่ผูกกับ location โดยตรง — team_id กำหนดว่า member คนนี้มีสิทธิ์
-- แก้ไข location ของทีมไหนได้บ้าง (ดูหมายเหตุด้านบน)
-- ------------------------------------------------------------
CREATE TYPE user_role AS ENUM ('admin', 'member');

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id         UUID REFERENCES teams(id) ON DELETE SET NULL, -- nullable: สมัครก่อน แอดมินกำหนดทีมทีหลัง
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    role            user_role NOT NULL DEFAULT 'member',
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_team_id ON users(team_id);

-- ------------------------------------------------------------
-- locations: จุดตรวจวัด/หมุดบนแผนที่ — หน่วยหลักของระบบ
-- 1 location = 1 หมุดบนแผนที่. team_id เป็นตัวบอก "ทีม" ของหมุดนี้โดยตรง
-- (ไม่ผ่าน users) เพราะต้องแสดงผลได้แม้ location ไม่มี user ผูกอยู่เลย.
-- created_by_user_id เป็นแค่ audit ไม่ใช่ตัวกำหนดสิทธิ์แก้ไข (สิทธิ์แก้ไข
-- มาจาก users.team_id ตรงกับ locations.team_id แทน)
-- ------------------------------------------------------------
CREATE TABLE locations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id         UUID REFERENCES teams(id) ON DELETE SET NULL, -- nullable: อนุญาตจุดที่ไม่มีทีม (เช่น บุคคลทั่วไป)
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- audit เท่านั้น, ไม่ unique
    member_name     VARCHAR(255) NOT NULL,       -- ชื่อผู้รับผิดชอบจุดนี้ ณ ตอนลงทะเบียน (ไม่จำเป็นต้องมี user account)
    location_name   VARCHAR(255) NOT NULL,
    latitude        NUMERIC(10, 7) NOT NULL CHECK (latitude BETWEEN -90 AND 90),
    longitude       NUMERIC(10, 7) NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    meta_data_1     VARCHAR(255),                 -- ประเภทข้อมูล เช่น หมวดหมู่/สถานะ ตามการใช้งาน
    avatar_image_path VARCHAR(500),               -- รูปที่ใช้เป็นหมุดบนแผนที่
    line_user_id    VARCHAR(255) UNIQUE,          -- LINE User ID ที่ผูกไว้สำหรับส่งรูปเข้า location นี้ (nullable)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_locations_team_id ON locations(team_id);
CREATE INDEX idx_locations_created_by_user_id ON locations(created_by_user_id);
CREATE INDEX idx_locations_line_user_id ON locations(line_user_id);
CREATE INDEX idx_locations_lat_lng ON locations(latitude, longitude);

-- ------------------------------------------------------------
-- indicator_types: master data ของตัวชี้วัดคุณภาพน้ำ (pH, DO, Turbidity, ...)
-- ------------------------------------------------------------
CREATE TABLE indicator_types (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(50) NOT NULL UNIQUE,   -- เช่น 'ph', 'do', 'turbidity'
    name        VARCHAR(255) NOT NULL,         -- เช่น 'ค่าความเป็นกรด-ด่าง (pH)'
    unit        VARCHAR(50),                   -- เช่น 'mg/L', '°C'
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- images: รูปภาพที่รับเข้ามาผ่าน LINE OA ผูกกับ location (ไม่ใช่ user)
-- การจับคู่ภาพเข้ากับ location ทำผ่าน locations.line_user_id
-- ------------------------------------------------------------
CREATE TYPE image_status AS ENUM ('received', 'processing', 'processed', 'deleted', 'failed');

CREATE TABLE images (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id     UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    line_user_id    VARCHAR(255) NOT NULL,      -- เก็บซ้ำไว้ ณ เวลาที่ส่ง เพื่อ audit แม้ location เปลี่ยนการผูกบัญชีในอนาคต
    line_message_id VARCHAR(255) UNIQUE,        -- message id จาก LINE webhook ป้องกันบันทึกซ้ำ
    file_path       VARCHAR(500),               -- NULL หลังจากไฟล์ถูกลบตาม retention policy
    status          image_status NOT NULL DEFAULT 'received',
    received_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at      TIMESTAMPTZ NOT NULL,       -- received_at + 24 ชั่วโมง, ใช้โดย cron job
    deleted_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_images_location_id ON images(location_id);
CREATE INDEX idx_images_expires_at ON images(expires_at) WHERE status <> 'deleted';

-- ------------------------------------------------------------
-- ai_image_results: ผลการแปลผลภาพด้วย AI (เก็บถาวร แม้ไฟล์ภาพถูกลบแล้ว)
-- ------------------------------------------------------------
CREATE TYPE ai_result_status AS ENUM ('success', 'failed', 'low_confidence');

CREATE TABLE ai_image_results (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_id        UUID NOT NULL REFERENCES images(id) ON DELETE CASCADE,
    ai_provider     VARCHAR(100) NOT NULL,      -- เช่น 'claude-vision', 'google-vision'
    status          ai_result_status NOT NULL DEFAULT 'success',
    raw_response    JSONB,                       -- เก็บผลตอบดิบจาก AI service ทั้งหมด
    confidence      NUMERIC(4, 3),               -- 0.000 - 1.000
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_image_results_image_id ON ai_image_results(image_id);

-- ------------------------------------------------------------
-- indicator_readings: ค่าตัวชี้วัดที่ผูกกับ location ณ เวลาหนึ่ง
-- source = 'ai' (จากการแปลผลภาพ) หรือ 'manual' (กรอกเอง/นำเข้า)
-- ------------------------------------------------------------
CREATE TYPE reading_source AS ENUM ('ai', 'manual');

CREATE TABLE indicator_readings (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id         UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    indicator_type_id   UUID NOT NULL REFERENCES indicator_types(id) ON DELETE RESTRICT,
    ai_image_result_id  UUID REFERENCES ai_image_results(id) ON DELETE SET NULL, -- NULL ถ้าเป็น manual
    value               NUMERIC(12, 4) NOT NULL,
    measured_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    source              reading_source NOT NULL DEFAULT 'manual',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_indicator_readings_location_id ON indicator_readings(location_id);
CREATE INDEX idx_indicator_readings_location_type_time
    ON indicator_readings(location_id, indicator_type_id, measured_at DESC);

-- ------------------------------------------------------------
-- updated_at auto-touch trigger (ใช้ร่วมกันหลายตาราง)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_users
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_locations
    BEFORE UPDATE ON locations
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ============================================================
-- ER Diagram (Mermaid) — ดูภาพรวมความสัมพันธ์
-- ============================================================
-- erDiagram
--     TEAMS ||--o{ USERS : "มีสมาชิก login (optional)"
--     TEAMS ||--o{ LOCATIONS : "มีจุดตรวจวัด (optional)"
--     USERS ||--o{ LOCATIONS : "audit: ผู้ลงทะเบียนล่าสุด (optional)"
--     LOCATIONS ||--o{ IMAGES : "ส่งรูปเข้ามา"
--     LOCATIONS ||--o{ INDICATOR_READINGS : "มีค่าตัวชี้วัด"
--     IMAGES ||--o| AI_IMAGE_RESULTS : "ถูกแปลผลโดย AI"
--     AI_IMAGE_RESULTS ||--o{ INDICATOR_READINGS : "สร้างค่า indicator"
--     INDICATOR_TYPES ||--o{ INDICATOR_READINGS : "เป็นประเภทของ"
--
-- หมายเหตุ: TEAMS->USERS และ TEAMS->LOCATIONS เป็นเส้นทางอิสระ ไม่ไหลผ่านกัน
-- สิทธิ์แก้ไข location ของ member มาจากการจับคู่ users.team_id = locations.team_id
-- ที่ application layer ไม่ใช่ FK constraint ในฐานข้อมูล
