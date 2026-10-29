<p align="center">
  <a href="https://wallpapers.want.foundation/">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="docs/assets/cover-dark.png">
      <source media="(prefers-color-scheme: light)" srcset="docs/assets/cover-light.png">
      <img src="docs/assets/cover-light.png" width="1600" alt="Want Wallpapers: violet pixel logo, Lunar molt, Colour Rays and Tree of the Night. Wallpapers worth keeping.">
    </picture>
  </a>
</p>

<p align="center">
  <a href="README.md" lang="en">English</a> · <a href="README.ru.md" lang="ru">Русский</a><br>
  <a href="https://wallpapers.want.foundation/">wallpapers.want.foundation</a> · <a href="https://t.me/want_wallpapers">Telegram Channel</a><br>
  <a href="https://wallpapers.want.foundation/wallpapers/neon-tide-7/">Lunar molt</a> · <a href="https://wallpapers.want.foundation/wallpapers/woven-spectrum-4/">Colour Rays</a> · <a href="https://wallpapers.want.foundation/wallpapers/contours-of-silence-11/">Tree of the Night</a>
</p>

<p align="center">
  <a href="https://github.com/andrey-krasheninnikov/want-wallpapers/releases/latest"><img src="https://img.shields.io/github/v/release/andrey-krasheninnikov/want-wallpapers?style=flat-square&amp;color=5B4FFF" alt="Latest release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/code%20license-MIT-5B4FFF?style=flat-square" alt="Code license: MIT"></a>
  <a href="https://github.com/andrey-krasheninnikov/want-wallpapers/stargazers"><img src="https://img.shields.io/github/stars/andrey-krasheninnikov/want-wallpapers?style=social" alt="GitHub stars"></a>
</p>

## 🧭 Contents

- [About the project](#-about-the-project)
- [FAQ](#-faq)
- [Monetization](#-monetization)
- [Fork and run locally](#-fork-and-run-locally)
- [Contributing](#-contributing)
- [Changelog and latest update](#-changelog-and-latest-update)
- [Development ideas](#-development-ideas)
- [License](#-license)

## 🌄 About the project

Original PNG wallpapers, composed separately for desktop and mobile so both screens share a mood.

- Themed collections, search by subject or colour, stories, ratings and comments.
- Six languages: English, Russian, Simplified Chinese, Brazilian Portuguese, Japanese and Arabic.
- Browsing and downloads without an account.

By [Andrey Krasheninnikov](https://github.com/andrey-krasheninnikov). Questions and collaboration: [wallpapers@want.foundation](mailto:wallpapers@want.foundation).

## 💬 FAQ

### Are the wallpapers free?

Yes, for personal use on your own screens, even if you decline optional analytics or advertising.

### Which file should I download?

Desktop for landscape, mobile for portrait. Both are PNGs; sizes vary, and personal cropping is allowed.

### Can I use them commercially?

Resale, pack redistribution and commercial use require permission. Ask [wallpapers@want.foundation](mailto:wallpapers@want.foundation).

### Do I need to register?

No account is needed to browse or download. Ratings and comments use an anonymous session; administration has a separate protected login.

### What if I decline tracking?

Browsing, search and downloads stay available; analytics and ads have separate cookie settings in the footer. Protected actions such as comments use reCAPTCHA Enterprise independently of optional analytics: [consent policy](docs/adr/0005-regional-availability-and-consent.md).

## 💸 Monetization

HilltopAds provides banners and popup windows according to advertising preferences; administration is excluded. Ads never control downloads. See [provider details and production checks](docs/advertising-providers.md); integration alone does not confirm revenue.

There is no paid tier, shop or donation link. The ideas below are possible future income sources; published wallpapers remain free for personal use.

## 🔧 Fork and run locally

Astro, React and the shared [Want Desyst UI kit](https://github.com/andrey-krasheninnikov/want-desyst) on the frontend; Rust (Axum, Tokio, SQLx) and PostgreSQL 18 on the backend. Firebase serves optional Analytics only.

Fork on GitHub, replace `YOUR-USERNAME`, then:

```bash
git clone https://github.com/YOUR-USERNAME/want-wallpapers.git
cd want-wallpapers
git remote add upstream https://github.com/andrey-krasheninnikov/want-wallpapers.git
git fetch upstream development
git switch -c my-change upstream/development
make install
```

Requires Bun 1.3.14, Rust 1.93.0, Python 3, FFmpeg and Docker. [Local setup](docs/development.md#local-setup) covers a separate database, private files, environment and startup without production credentials. The first build needs public CDN access; open <http://localhost:4321>.

## 🤝 Contributing

[Open an issue](https://github.com/andrey-krasheninnikov/want-wallpapers/issues/new) with the page URL, steps and expected behaviour. Keep credentials and personal data private.

Translations, accessibility, docs and code are welcome. Discuss large changes first, target `development`, follow [DESIGN.md](DESIGN.md) and run [relevant checks](docs/development.md#checks). Preserve all six locales and download links. For artwork, confirm your rights and agree on publication terms first.

## 📝 Changelog and latest update

[Full changelog](CHANGELOG.md) · [Latest release: v1.14.0](https://github.com/andrey-krasheninnikov/want-wallpapers/releases/tag/v1.14.0), October 29, 2026: the home mosaic keeps the hovered image while the other tiles change. The 3D scene cycles through works without repeats, and primary actions use shared Glow from Want Desyst 0.3.0.

## 💡 Development ideas

Ten income ideas to test, without committed dates or revenue forecasts. Prints need proofs; XR needs dedicated scenes and device testing.

1. Numbered art prints and posters for collectors, starting with a small preorder.
2. Custom wall murals with an AR placement preview, sold by room size.
3. Desk mats and interior textiles for coordinated workspaces.
4. Curated digital picture-frame collections through display licenses or a subscription.
5. Projection installations for cafés, hotels and events, commissioned or licensed.
6. Physical prints with an included AR animation layer.
7. AR portals into collection worlds, sold as scenes or access to an experience.
8. VR spaces for rest and focus, sold individually or in themed packs.
9. Virtual exhibitions funded by tickets or sponsorship.
10. Commissioned AR/VR scenes with defined usage rights for brands and spaces.

## 📄 License

Code and documentation: [MIT](LICENSE). Wallpapers: separate [personal, noncommercial terms](https://wallpapers.want.foundation/license/), including display and cropping on your own devices.

Resale, pack redistribution and commercial use need permission. The cover does not expand artwork rights. Licensing: [wallpapers@want.foundation](mailto:wallpapers@want.foundation).
