import { useEffect, useState } from 'react';
import { fetchLocationImageUrl } from '../api/locations.js';

// Images sit behind an authenticated endpoint, so each one is fetched as a blob
// and shown through an object URL, which is revoked when the location list changes.
export function useLocationImages(locations) {
  const [urls, setUrls] = useState({});

  useEffect(() => {
    let cancelled = false;
    const created = [];
    const withImage = locations.filter((loc) => loc.avatar_image_url);
    Promise.all(
      withImage.map((loc) =>
        fetchLocationImageUrl(loc.id)
          .then((url) => {
            created.push(url);
            return [loc.id, url];
          })
          .catch(() => null)
      )
    ).then((pairs) => {
      if (!cancelled) setUrls(Object.fromEntries(pairs.filter(Boolean)));
    });
    return () => {
      cancelled = true;
      created.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [locations]);

  return urls;
}
