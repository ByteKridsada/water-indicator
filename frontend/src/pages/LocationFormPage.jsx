import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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

const emptyForm = {
  team_id: '',
  member_name: '',
  location_name: '',
  latitude: null,
  longitude: null,
  meta_data_1: '',
  line_user_id: '',
};

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

  async function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file || !isEdit) return;
    setError('');
    try {
      await uploadLocationImage(id, file);
      const url = await fetchLocationImageUrl(id);
      setImageUrl(url);
    } catch (err) {
      setError(err.message || 'อัปโหลดรูปไม่สำเร็จ');
    }
  }

  async function handleImageDelete() {
    if (!isEdit) return;
    try {
      await deleteLocationImage(id);
      setImageUrl(null);
    } catch (err) {
      setError(err.message || 'ลบรูปไม่สำเร็จ');
    }
  }

  if (loading) return <p>กำลังโหลด...</p>;

  return (
    <div className="form-page">
      <h1>{isEdit ? 'แก้ไขจุดตรวจวัด' : 'เพิ่มจุดตรวจวัด'}</h1>

      {isEdit && !canEdit && (
        <p className="form-warning">คุณไม่มีสิทธิ์แก้ไขจุดนี้ — แสดงเป็นแบบอ่านอย่างเดียว</p>
      )}

      <form className="location-form" onSubmit={handleSubmit}>
        <fieldset disabled={!canEdit || saving}>
          <label>
            ชื่อจุดตรวจวัด
            <input
              type="text"
              value={form.location_name}
              onChange={(e) => update('location_name', e.target.value)}
              required
            />
          </label>
          <label>
            ชื่อผู้รายงาน
            <input
              type="text"
              value={form.member_name}
              onChange={(e) => update('member_name', e.target.value)}
              required
            />
          </label>

          {user?.role === 'admin' && (
            <label>
              ทีม
              <select value={form.team_id} onChange={(e) => update('team_id', e.target.value)}>
                <option value="">ไม่มีทีม</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.team_name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label>
            Meta Data 1 (ประเภทแหล่งน้ำ ฯลฯ — รอยืนยันชุดตัวเลือกจริงจากเจ้าของโครงการ)
            <input
              type="text"
              value={form.meta_data_1}
              onChange={(e) => update('meta_data_1', e.target.value)}
            />
          </label>

          <label>
            LINE User ID (ถ้ามี)
            <input
              type="text"
              value={form.line_user_id}
              onChange={(e) => update('line_user_id', e.target.value)}
            />
          </label>

          <LocationPicker
            latitude={form.latitude}
            longitude={form.longitude}
            onChange={(lat, lng) => setForm((prev) => ({ ...prev, latitude: lat, longitude: lng }))}
            disabled={!canEdit}
          />

          {isEdit && (
            <div className="image-upload">
              <h3>รูปหมุด</h3>
              {imageUrl ? (
                <div>
                  <img src={imageUrl} alt="รูปหมุด" className="avatar-preview" />
                  <button type="button" className="btn btn--small btn--danger" onClick={handleImageDelete}>
                    ลบรูป
                  </button>
                </div>
              ) : (
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleImageUpload} />
              )}
            </div>
          )}

          {error && <p className="form-error">{error}</p>}

          <div className="form-actions">
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => navigate('/')}>
              ยกเลิก
            </button>
          </div>
        </fieldset>
      </form>

      {isEdit && canEdit && <ReadingForm locationId={id} />}
    </div>
  );
}
