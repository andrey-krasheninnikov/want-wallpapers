import '@google/model-viewer';
import type { ModelViewerElement } from '@google/model-viewer';

export const failedDeviceScenes = new WeakSet<ModelViewerElement>();

document.addEventListener('error', (event) => {
  if (event.target instanceof HTMLElement && event.target.localName === 'model-viewer') failedDeviceScenes.add(event.target as ModelViewerElement);
}, true);
