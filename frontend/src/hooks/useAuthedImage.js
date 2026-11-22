import { useEffect, useState } from 'react';
import { fetchImageObjectUrl } from '../api/auth.js';

// Loads one protected image (e.g. a profile picture) as an object URL. When `url` changes
// (a new upload changes its ?v= version) the old object URL is revoked and the new one fetched.
export function useAuthedImage(url) {
  // remember which url the loaded image belongs to, so a stale image is never shown
  const [loaded, setLoaded] = useState({ url: null, objectUrl: null });

  useEffect(() => {
    if (!url) return undefined;
    let cancelled = false;
    let created = null;
    fetchImageObjectUrl(url)
      .then((objectUrl) => {
        created = objectUrl;
        if (cancelled) URL.revokeObjectURL(objectUrl);
        else setLoaded({ url, objectUrl });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [url]);

  return url && loaded.url === url ? loaded.objectUrl : null;
}
