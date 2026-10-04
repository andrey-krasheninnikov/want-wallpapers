import { useEffect, useState } from 'react';
import { getRegion, initializePrivacy, type Region } from './privacy';

export function useRegion() {
  const [region, setRegion] = useState<Region>('pending');
  useEffect(() => {
    const update = () => setRegion(getRegion());
    window.addEventListener('want:region', update);
    update();
    void initializePrivacy();
    return () => window.removeEventListener('want:region', update);
  }, []);
  return region;
}
