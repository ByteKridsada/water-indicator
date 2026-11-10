import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { listTeams } from '../api/teams.js';
import {
  createLocation,
  deleteLocationImage,
  fetchLocation,
  fetchLocationImageUrl,
  updateLocation,
  uploadLocationImage,
} from '../api/locations.js';
import { LocationPicker } from '../components/LocationPicker.jsx';
import { ReadingForm } from '../components/ReadingForm.jsx';
import { IconChevronLeft, IconImage, IconUpload } from '../components/icons.jsx';

const emptyForm = {
  team_id: '',
  member_name: '',
  location_name: '',
  latitude: null,
  longitude: null,
  meta_data_1: '',
  line_user_id: '',
};

function ImageCard({ isEdit, canEdit, imageUrl, onUpload, onDelete }) {
  const [dragging, setDragging] = useState(false);

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onUpload(file);
  }

  return (
    <section className="card">
      <div>
        <h2 className="card-title">รูปหมุดบนแผนที่</h2>
        <p className="hint" style={{ marginTop: 4 }}>
          รูปนี้แสดงเป็นหมุดบนแผนที่ แยกจากรูปที่ส่งผ่าน LINE ซึ่งลบอัตโนมัติหลัง 24 ชม.
        </p>
      </div>
      {!isEdit ? (
        <p className="form-warning">บันทึกจุดตรวจวัดก่อน แล้วจึงอัปโหลดรูปหมุดได้</p>
      ) : (
        <div className="image-row">
          <span className="thumb thumb--large">{imageUrl ? <img src={imageUrl} alt="รูปหมุดปัจจุบัน" /> : <IconImage size={32} />}</span>
          {canEdit &&
            (imageUrl ? (
              <button type="button" className="btn btn--danger btn--small" onClick={onDelete}>
                ลบรูป
              </button>
            ) : (
              <label
                className={`dropzone${dragging ? ' dropzone--active' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
              >
                <IconUpload size={26} style={{ color: 'var(--indigo)' }} />
                <span>
                  ลากไฟล์มาวาง หรือ <strong>เลือกไฟล์จากเครื่อง</strong>
                </span>
                <span className="hint">PNG / JPG / WebP ไม่เกิน 5 MB</span>
                <input
                  type="file"
                  className="visually-hidden"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
                />
              </label>
            ))}
        </div>
      )}
    </section>
  );
}

export function LocationFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { user } = useAuth();
  const navigate = useNavigate();

  const [teams, setTeams] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [canEdit, setCanEdit] = useState(true);
  const [imageUrl, setImageUrl] = useState(null);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    listTeams().then(setTeams).catch(() => setTeams([]));
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    fetchLocation(id)
      .then((data) => {
        setForm({
          team_id: data.team?.id || '',
          member_name: data.member_name,
          location_name: data.location_name,
          latitude: data.latitude,
          longitude: data.longitude,
          meta_data_1: data.meta_data_1 || '',
          line_user_id: data.line_user_id || '',
        });
        setCanEdit(data.can_edit);
        if (data.avatar_image_url) {
          fetchLocationImageUrl(id).then(setImageUrl).catch(() => {});
        }
      })
      .catch((err) => setError(err.message || 'โหลดข้อมูลไม่สำเร็จ'))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!Number.isFinite(form.latitude) || !Number.isFinite(form.longitude)) {
      setError('กรุณาระบุพิกัดโดยค้นหาสถานที่ คลิกบนแผนที่ หรือกรอก Latitude และ Longitude');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        member_name: form.member_name,
        location_name: form.location_name,
        latitude: form.latitude,
        longitude: form.longitude,
        meta_data_1: form.meta_data_1 || null,
        line_user_id: form.line_user_id || null,
      };
      if (user.role === 'admin') {
        payload.team_id = form.team_id || null;
      }

      if (isEdit) {
        await updateLocation(id, payload);
        navigate('/');
      } else {
        const created = await createLocation(payload);
        navigate(`/locations/${created.id}/edit`);
      }
    } catch (err) {
      setError(err.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  }

  async function handleImageUpload(file) {
    setError('');
    try {
      await uploadLocationImage(id, file);
      setImageUrl(await fetchLocationImageUrl(id));
    } catch (err) {
      setError(err.message || 'อัปโหลดรูปไม่สำเร็จ');
    }
  }

  async function handleImageDelete() {
    try {
      await deleteLocationImage(id);
      setImageUrl(null);
    } catch (err) {
      setError(err.message || 'ลบรูปไม่สำเร็จ');
    }
  }

  if (loading) return <p className="page-loading">กำลังโหลด...</p>;

  // members can't choose a team: new locations go to their own team, existing ones keep theirs
  const memberTeamName = isEdit
    ? teams.find((t) => t.id === form.team_id)?.team_name || 'ไม่มีทีม'
    : user?.team?.team_name || 'ยังไม่มีทีม';

  return (
    <div className="page">
      <Link to="/" className="back-link">
        <IconChevronLeft />
        กลับไปหน้ารายการ
      </Link>

      <div>
        <h1 className="page-title">{isEdit ? 'แก้ไขจุดตรวจวัด' : 'เพิ่มจุดตรวจวัด'}</h1>
        <p className="page-sub">สมาชิกในทีมเดียวกันแก้ไขจุดนี้ร่วมกันได้</p>
      </div>

      {isEdit && !canEdit && <p className="form-warning">คุณไม่มีสิทธิ์แก้ไขจุดนี้ จึงแสดงเป็นแบบอ่านอย่างเดียว</p>}

      <form onSubmit={handleSubmit}>
        <fieldset disabled={!canEdit || saving} className="page">
          <div className="form-columns">
            <div className="stack">
              <section className="card">
                <h2 className="card-title">ข้อมูลจุดตรวจวัด</h2>
                <div className="field">
                  <label htmlFor="loc-name">ชื่อสถานที่ / ที่ตั้ง</label>
                  <input
                    id="loc-name"
                    className="input"
                    type="text"
                    value={form.location_name}
                    onChange={(e) => update('location_name', e.target.value)}
                    required
                  />
                </div>
                <div className="grid-2">
                  <div className="field">
                    <label htmlFor="loc-member">ชื่อสมาชิกผู้รับผิดชอบ</label>
                    <input
                      id="loc-member"
                      className="input"
                      type="text"
                      value={form.member_name}
                      onChange={(e) => update('member_name', e.target.value)}
                      required
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="loc-team">ทีม</label>
                    {user?.role === 'admin' ? (
                      <select id="loc-team" className="select" value={form.team_id} onChange={(e) => update('team_id', e.target.value)}>
                        <option value="">ไม่มีทีม</option>
                        {teams.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.team_name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input id="loc-team" className="input" type="text" value={memberTeamName} disabled />
                    )}
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="loc-meta">ประเภทแหล่งน้ำ (Meta Data 1)</label>
                  <input
                    id="loc-meta"
                    className="input"
                    type="text"
                    value={form.meta_data_1}
                    onChange={(e) => update('meta_data_1', e.target.value)}
                  />
                  <p className="hint">รอเจ้าของโครงการยืนยันชุดตัวเลือกที่แน่นอน</p>
                </div>
                <div className="field">
                  <label htmlFor="loc-line">LINE User ID (ถ้ามี)</label>
                  <input
                    id="loc-line"
                    className="input"
                    type="text"
                    value={form.line_user_id}
                    onChange={(e) => update('line_user_id', e.target.value)}
                  />
                </div>
              </section>

              <ImageCard
                isEdit={isEdit}
                canEdit={canEdit}
                imageUrl={imageUrl}
                onUpload={handleImageUpload}
                onDelete={handleImageDelete}
              />
            </div>

            <section className="card">
              <h2 className="card-title">ตำแหน่งที่ตั้ง</h2>
              <LocationPicker
                latitude={form.latitude}
                longitude={form.longitude}
                onChange={(lat, lng) => setForm((prev) => ({ ...prev, latitude: lat, longitude: lng }))}
                disabled={!canEdit}
              />
            </section>
          </div>

          {error && <p className="form-error">{error}</p>}

          <div className="form-actions">
            <Link to="/" className="btn btn--quiet">
              ยกเลิก
            </Link>
            <button type="submit" className="btn btn--primary" disabled={saving} style={{ minWidth: 140 }}>
              {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
          </div>
        </fieldset>
      </form>

      {isEdit && canEdit && <ReadingForm locationId={id} />}
    </div>
  );
}
