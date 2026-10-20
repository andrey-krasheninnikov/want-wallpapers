import { lstatSync, mkdirSync, readFileSync } from 'node:fs';
import { packagePath, requirePackage, validatePackage, writePrivate, type Asset } from './collection-package';

const escape = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!));
export async function reviewPackage(root: string) {
  const checked = await validatePackage(root), { value, packageHash } = checked;
  const review = packagePath(checked.root, 'review'); mkdirSync(review, { recursive: true, mode: 0o700 });
  requirePackage(!(lstatSync(review).mode & 0o077), 'private-review-directory-required');
  const fonts = ['onest', 'manrope', 'noto-sans-jp', 'noto-sans-arabic'];
  const faces: string[] = [];
  for (const font of fonts) {
    const source = new URL(`../../node_modules/@fontsource-variable/${font}/files/${font}-${font === 'noto-sans-jp' ? 'japanese' : font === 'noto-sans-arabic' ? 'arabic' : 'latin'}-wght-normal.woff2`, import.meta.url);
    if (await Bun.file(source).exists()) {
      writePrivate(packagePath(checked.root, `review/${font}.woff2`), readFileSync(source));
      faces.push(`@font-face{font-family:${font};src:url('./${font}.woff2') format('woff2');font-weight:100 900;font-display:swap}`);
    }
  }
  const image = (asset: Asset, label: string, emoji = false) => `<figure><a href="../${escape(asset.path)}"><img ${emoji ? 'class="emoji"' : ''} src="../${escape(asset.path)}" width="${asset.width}" height="${asset.height}" loading="lazy" alt="${escape(label)}"></a><figcaption>${escape(label)} · ${asset.width}×${asset.height}</figcaption></figure>`;
  let body = `<h1>${escape(value.manifest.collection.title.ru)}</h1><p>Приватный пакет · версия ${value.revision}</p><p class="hash">SHA-256 ${packageHash}</p><p>Проверьте все изображения, переводы, истории, emoji и тексты публикаций. Эта страница ничего не публикует.</p><a class="control" href="#copy">Тексты публикаций</a>`;
  for (let design = 1; design <= 5; design++) {
    const wallpaper = value.manifest.wallpapers[design - 1]!;
    body += `<section><h2>${design}. ${escape(wallpaper.title.ru)}</h2><div class="pair">`;
    for (const variant of ['desktop', 'mobile']) {
      const final = value.assets.find(asset => asset.role === 'final' && asset.design === design && asset.variant === variant)!;
      const source = value.assets.find(asset => asset.path === final.source)!;
      const native = value.assets.find(asset => asset.role === 'native' && asset.design === design && asset.variant === variant)!;
      const label = final.sha256 === native.sha256 ? 'Native 4K' : source.width < final.width ? 'Увеличенный PNG' : 'Финальный PNG';
      body += `<div>${image(final, `${variant} · ${label}`)}<a href="../${escape(native.path)}">Native PNG ${native.width}×${native.height}</a></div>`;
    }
    const emoji = value.assets.find(asset => asset.role === 'emoji' && asset.design === design)!;
    body += '</div>' + image(emoji, [emoji.name ?? 'Emoji', emoji.emoji ?? ''].join(' ').trim(), true);
    body += '<div class="emoji-checks">' + ['light', 'dark'].map(background => `<figure class="emoji-${background}"><figcaption>${background === 'light' ? 'Светлый фон' : 'Тёмный фон'} · 100px / 32px</figcaption><img src="../${escape(emoji.path)}" width="100" height="100" alt="${escape(emoji.name ?? 'Emoji')}"><img src="../${escape(emoji.path)}" width="32" height="32" alt=""></figure>`).join('') + '</div></section>';
  }
  for (const [locale, paragraphs] of Object.entries(value.stories)) {
    body += `<details lang="${escape(locale)}" dir="${locale === 'ar' ? 'rtl' : 'ltr'}"><summary>${escape(locale)} · ${escape(value.manifest.collection.title[locale as keyof typeof value.stories])}</summary><p>${escape(value.manifest.collection.description[locale as keyof typeof value.stories])}</p>`;
    for (const item of value.manifest.wallpapers) body += `<h3>${escape(item.title[locale as keyof typeof value.stories])}</h3><p>${escape(item.description[locale as keyof typeof value.stories])}</p>`;
    body += paragraphs.map(paragraph => `<p>${escape(paragraph)}</p>`).join('') + '</details>';
  }
  body += '<section id="copy"><h2>Публикации на английском</h2>';
  for (const [destination, posts] of Object.entries(value.copy)) body += `<h3>${escape(destination)}</h3>` + posts.map(post => `<article lang="en"><h4>${escape(post.title)}</h4><p>${escape(post.description)}</p></article>`).join('');
  body += '</section><p>Одобрение выполняется в терминале с указанным SHA-256. Любые изменения требуют повторной проверки.</p>';
  const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' file:; font-src 'self' file:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>Проверка коллекции</title><style>${faces.join('')}
:root{color-scheme:dark;background:#141414;color:#E8E8E8;font-family:manrope,system-ui,sans-serif;font-size:16px;line-height:1.7}body{max-width:1100px;margin:auto;padding:24px}h1,h2,h3,h4{font-family:onest,system-ui,sans-serif;line-height:1.2}h1{font-size:clamp(28px,4vw,40px)}h2{font-size:26px}section,details{background:#1C1C1C;border-radius:24px;padding:24px;margin-block:24px}article{background:#252525;padding:16px;border-radius:12px;margin-block:16px}.pair{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}figure{margin:0}img{display:block;max-width:100%;height:auto;border-radius:24px;background:#101010}.emoji-checks{display:flex;flex-wrap:wrap;gap:16px;margin-block:16px}.emoji-checks figure{padding:16px;border-radius:12px}.emoji-checks img{display:inline-block;background:none;border-radius:0;margin:8px;vertical-align:middle}.emoji-light{background:#F4F4F4;color:#141414}.emoji-dark{background:#101010;color:#E8E8E8}.emoji{width:100px;border-radius:12px;background:repeating-conic-gradient(#252525 0 25%,#858585 0 50%) 0/20px 20px}a{color:#E8E8E8;text-underline-offset:4px;display:inline-flex;align-items:center;min-height:44px}a:focus-visible,summary:focus-visible{outline:2px solid #5B4FFF;outline-offset:3px}summary{cursor:pointer;min-height:44px}p{max-width:65ch;overflow-wrap:anywhere}.hash{font-family:monospace;color:#ADADAD;overflow-wrap:anywhere}[lang=ar]{font-family:noto-sans-arabic,system-ui,sans-serif}[lang=ja]{font-family:noto-sans-jp,system-ui,sans-serif}.control{background:#5B4FFF;padding:4px 24px;border-radius:999px}@media(max-width:640px){body{padding:16px}.pair{grid-template-columns:1fr}section,details{padding:16px}}@media(forced-colors:active){a:focus-visible,summary:focus-visible{outline-color:Highlight}}
</style></head><body>${body}</body></html>`;
  const path = packagePath(checked.root, 'review/index.html'); writePrivate(path, html); return path;
}
