import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
export function context(budget = 40, usage: unknown[] = []) {
  return {
    key: { id: 'synthetic-key', valid: true, type: 'secret', questPollenOnly: true, pollenBudget: budget,
      permissions: { models: ['openai/gpt-image-2', 'openai/gpt-5.4-nano'], account: [] } },
    imageModel: { name: 'openai/gpt-image-2', paid_only: false, supported_endpoints: ['/v1/images/generations', '/v1/images/edits'],
      pricing: { promptTextTokens: '0.00000375', promptImageTokens: '0.000006', completionImageTokens: '0.0000225' } },
    textModel: { name: 'openai/gpt-5.4-nano', paid_only: false, supported_endpoints: ['/v1/chat/completions'],
      pricing: { promptTextTokens: '0.00000015', completionTextTokens: '0.0000009375' } },
    usage,
  };
}

export function plan(collectionId = '900026-test-light') {
  const slug = collectionId.replace(/^\d+-/, '');
  const localized = (text: string) => ({ en: text, ru: `Свет ${text}`, 'zh-cn': `光 ${text}`, 'pt-br': `Luz ${text}`, ja: `光 ${text}` });
  return { manifest: {
    collection: { id: collectionId, slug, count: 5, title: localized('Light'), description: localized('Quiet light') },
    wallpapers: Array.from({ length: 5 }, (_, index) => ({ id: `${slug}-${index + 1}`, slug: `${slug}-${index + 1}`,
      collection: slug, collectionId, s3Folder: collectionId, fileStem: slug, number: index + 1, category: 'abstract' as const, tags: ['blue' as const, 'light' as const],
      title: localized(`Shape ${index + 1}`), description: localized(`Central shape ${index + 1}`) })),
  }, scenes: Array.from({ length: 5 }, (_, index) => ({ number: index + 1, scene: `Blue shape ${index + 1}`,
    desktopPrompt: `Wide blue shape ${index + 1}`, mobilePrompt: `Tall blue shape ${index + 1}` })) };
}

if (import.meta.main) {
  const directory = process.argv[2]!;
  writeFileSync(join(directory, 'provider.json'), JSON.stringify({ context: context(), plan: plan() }));
  for (let number = 1; number <= 5; number++) for (const variant of ['desktop', 'mobile']) {
    const width = variant === 'desktop' ? 3840 : 2160, height = variant === 'desktop' ? 2160 : 3840;
    const bytes = await sharp({ create: { width, height, channels: 3, background: { r: number * 20, g: 10, b: 90 } } }).png().toBuffer();
    writeFileSync(join(directory, `${number}-${variant}.png`), bytes);
  }
}
