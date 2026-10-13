import { expect, test } from 'bun:test';
import { selectAdvertisingProvider, startAdvertisement, type MountAdvertisement } from '../src/lib/advertising';
import { normalizeCountry, parseCookiePreferences } from '../src/lib/privacy-policy';

const allowed = { analytics: false, advertising: true };
const denied = { analytics: true, advertising: false };

test('normalized RU, KZ and BY select Yandex independently of analytics', () => {
  for (const code of [' ru ', 'kz', 'BY']) {
    const country = normalizeCountry({ success: true, country_code: code });
    expect(selectAdvertisingProvider(country, null)).toBe('yandex');
    expect(selectAdvertisingProvider(country, allowed)).toBe('yandex');
    expect(selectAdvertisingProvider(country, denied)).toBeNull();
  }
});

test('other countries use Adsterra while EEA and unknown require an explicit choice', () => {
  for (const country of ['US', 'BR', 'GE', 'GB']) expect(selectAdvertisingProvider(country, null)).toBe('adsterra');
  for (const country of ['DE', 'NO', 'AX', 'GF', null]) {
    expect(selectAdvertisingProvider(country, null)).toBeNull();
    expect(selectAdvertisingProvider(country, allowed)).toBe('adsterra');
    expect(selectAdvertisingProvider(country, denied)).toBeNull();
  }
});

test('stored denial, legacy analytics and corrupt preferences never enable advertising', () => {
  for (const preferences of [denied, parseCookiePreferences(null, 'analytics'), parseCookiePreferences('broken', null)]) {
    for (const country of ['RU', 'KZ', 'BY', 'US', 'DE', null]) expect(selectAdvertisingProvider(country, preferences)).toBeNull();
  }
});

function container() {
  type Child = { parentElement: typeof host | null; remove: () => void };
  const children = new Set<Child>();
  const host = {
    hidden: false,
    ownerDocument: { createElement: () => {
      const child: Child = { parentElement: null, remove() { children.delete(child); child.parentElement = null; } };
      return child;
    } },
    appendChild(child: Child) { children.add(child); child.parentElement = host; },
  };
  return { host: host as unknown as HTMLElement, children };
}

const tick = () => Bun.sleep(0);

test('one placement becomes visible after mounting and cleanup is idempotent', async () => {
  const { host, children } = container();
  let calls = 0, disposed = 0;
  let signal!: AbortSignal;
  const stop = startAdvertisement(host, 'yandex', 'left', async (context) => {
    calls++; signal = context.signal;
    expect(context.provider).toBe('yandex'); expect(context.side).toBe('left');
    expect(context.container).not.toBe(host);
    return () => { disposed++; };
  });
  expect(host.hidden).toBe(true);
  await tick();
  expect(calls).toBe(1); expect(host.hidden).toBe(false); expect(children.size).toBe(1);
  stop(); stop();
  expect(signal.aborted).toBe(true); expect(disposed).toBe(1);
  expect(host.hidden).toBe(true); expect(children.size).toBe(0);
});

test('cancellation before mounting starts prevents the optional operation', async () => {
  const { host, children } = container(); let calls = 0;
  const stop = startAdvertisement(host, 'adsterra', 'right', async () => { calls++; return () => {}; });
  stop(); await tick();
  expect(calls).toBe(0); expect(host.hidden).toBe(true); expect(children.size).toBe(0);
});

test('a late completed mount is disposed without reviving a cancelled placement', async () => {
  const { host, children } = container(); let disposed = 0;
  let finish!: (cleanup: () => void) => void;
  const stop = startAdvertisement(host, 'adsterra', 'left', () => new Promise((resolve) => { finish = resolve; }));
  await tick(); stop(); finish(() => { disposed++; }); await tick();
  expect(disposed).toBe(1); expect(host.hidden).toBe(true); expect(children.size).toBe(0);
});

test('no-fill, synchronous throws and rejected mounts stay hidden without retries', async () => {
  for (const mount of [async () => null, () => { throw new Error('Blocked'); }, async () => { throw new Error('Unavailable'); }] as MountAdvertisement[]) {
    const { host, children } = container(); let calls = 0;
    const stop = startAdvertisement(host, 'yandex', 'right', (context) => { calls++; return mount(context); });
    await tick(); await tick();
    expect(calls).toBe(1); expect(host.hidden).toBe(true); expect(children.size).toBe(0); stop();
  }
});

test('failed cleanup cannot leave a visible placement or throw into the page', async () => {
  const { host, children } = container();
  const stop = startAdvertisement(host, 'yandex', 'left', async () => () => { throw new Error('Cleanup failed'); });
  await tick(); expect(() => stop()).not.toThrow();
  expect(host.hidden).toBe(true); expect(children.size).toBe(0);
});

test('late cleanup from an old mount cannot hide a newer placement', async () => {
  const { host, children } = container(); let finish!: (cleanup: () => void) => void;
  const stopOld = startAdvertisement(host, 'yandex', 'left', () => new Promise((resolve) => { finish = resolve; }));
  await tick(); stopOld();
  const stopNew = startAdvertisement(host, 'adsterra', 'left', async () => () => {});
  await tick(); finish(() => {}); await tick();
  expect(host.hidden).toBe(false); expect(children.size).toBe(1); stopNew();
});

test('a provider that detaches its own node cannot leave the label visible on cleanup', async () => {
  const { host, children } = container();
  const stop = startAdvertisement(host, 'yandex', 'left', async ({ container }) => () => container.remove());
  await tick(); expect(host.hidden).toBe(false); stop();
  expect(host.hidden).toBe(true); expect(children.size).toBe(0);
});
