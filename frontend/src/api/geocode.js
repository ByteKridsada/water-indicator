const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

// Uses fetch rather than apiClient so the login token is never sent to a third party.
// Nominatim's usage policy forbids autocomplete, so call this only on an explicit search.
export async function searchPlaces(query) {
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    limit: '5',
    countrycodes: 'th',
    'accept-language': 'th',
  });
  const response = await fetch(`${NOMINATIM_URL}?${params}`);
  if (!response.ok) throw new Error(`Nominatim responded with ${response.status}`);
  const places = await response.json();
  return places.map((place) => ({
    id: place.place_id,
    name: place.display_name,
    latitude: Number(Number(place.lat).toFixed(6)),
    longitude: Number(Number(place.lon).toFixed(6)),
  }));
}

// Accepts "lat, lng" or "lat lng"; returns null when the text is not a valid coordinate pair.
export function parseCoordinates(text) {
  const match = text.trim().match(/^(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}
