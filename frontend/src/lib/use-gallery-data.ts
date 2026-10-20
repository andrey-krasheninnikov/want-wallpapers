import { useEffect, useState } from 'react';
import type { Locale } from '@/data/catalog';
import { loadGalleryData, type GalleryData } from './gallery-data';

export function useGalleryData(url: string | undefined, locale: Locale) {
  const [data, setData] = useState<GalleryData>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!url) return;
    let active = true;
    void loadGalleryData(url, locale).then(value => { if (active) setData(value); }, () => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [url, locale]);
  return { data, failed };
}
