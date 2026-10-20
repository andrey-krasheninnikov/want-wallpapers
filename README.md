<p align="center">
  <a href="https://wallpapers.want.foundation/">
    <img src="frontend/assets/logo.svg" width="80" height="80" alt="Want Wallpapers logo">
  </a>
</p>

<h1 align="center">Want Wallpapers</h1>

<p align="center">
  <strong>Wallpapers worth keeping.</strong><br>
  Original PNG wallpapers for desktop and mobile.
</p>

<p align="center">
  <a href="README.md" lang="en">English</a> · <a href="README.ru.md" lang="ru">Русский</a><br>
  <a href="https://wallpapers.want.foundation/">wallpapers.want.foundation</a> · <a href="https://t.me/want_wallpapers">Telegram Channel</a>
</p>

<p align="center">
  <a href="https://wallpapers.want.foundation/">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="docs/assets/cover-dark.png">
      <source media="(prefers-color-scheme: light)" srcset="docs/assets/cover-light.png">
      <img src="docs/assets/cover-light.png" width="1600" height="800" alt="Want Wallpapers: the violet pixel logo and three catalog previews from Neon Tide, A Night Beneath the Ice and Contours of Silence.">
    </picture>
  </a>
</p>

<p align="center">
  <a href="https://github.com/andrey-krasheninnikov/want-wallpapers/releases/latest"><img src="https://img.shields.io/github/v/release/andrey-krasheninnikov/want-wallpapers?style=flat-square&amp;color=5B4FFF" alt="Latest release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/code%20license-MIT-5B4FFF?style=flat-square" alt="Code license: MIT"></a>
  <a href="https://github.com/andrey-krasheninnikov/want-wallpapers/stargazers"><img src="https://img.shields.io/github/stars/andrey-krasheninnikov/want-wallpapers?style=social" alt="GitHub stars"></a>
</p>

## Contents

- [About the project](#about-the-project)
- [FAQ](#faq)
- [Monetization](#monetization)
- [Fork and run locally](#fork-and-run-locally)
- [Contributing](#contributing)
- [Changelog and latest update](#changelog-and-latest-update)
- [Development ideas](#development-ideas)
- [License](#license)

## About the project

Want Wallpapers is a collection of original wallpapers for the screens you use every day. Find a mood you like, then download a landscape or portrait PNG. Each design has a desktop and mobile composition, so your screens can share a visual theme without relying on one crop.

- Themed collections and search by subject or colour.
- Stories behind the work, ratings and comments.
- English, Russian, Simplified Chinese, Brazilian Portuguese, Japanese and Arabic.
- Browsing and downloads without an account.

[Andrey Krasheninnikov](https://github.com/andrey-krasheninnikov) maintains the project. For questions, licensing or collaboration, write to [wallpapers@want.foundation](mailto:wallpapers@want.foundation).

## FAQ

### Are the wallpapers free?

Yes. The published wallpapers are free for personal use on your own screens. They remain available when you decline optional analytics or advertising.

### Which file should I download?

Choose desktop for a landscape screen or mobile for a portrait screen. Downloads are PNG files; dimensions depend on the image. You may crop a wallpaper to fit your own device.

### Can I use the images in a product or commercial project?

Ask [wallpapers@want.foundation](mailto:wallpapers@want.foundation) first. The wallpaper license covers personal, noncommercial display. It does not allow resale, redistribution as a wallpaper pack or commercial use without permission.

### Do I need to register?

No visitor account is required to browse or download. Ratings and comments use an anonymous browser session. Administration has a separate protected login.

### What happens if I decline tracking?

Browsing, search and downloads remain available. Analytics and advertising have separate preferences in the footer's cookie settings. Protected actions such as posting a comment use reCAPTCHA Enterprise independently of optional analytics. See the [consent policy](docs/adr/0005-regional-availability-and-consent.md).

## Monetization

The site includes Yandex Auto Placement and Adsterra banner integrations. The provider depends on country and advertising preferences; home pages and administration are excluded. Viewing an ad is not a condition for downloading a wallpaper. [Advertising documentation](docs/advertising-providers.md) describes the implementation and the production checks still required. An integration does not establish impressions, payouts or revenue.

Future income could come from physical editions, licenses and AR/VR experiences described below. Those ideas are not products currently on sale. There is no paid tier, shop or donation link announced here. Published wallpapers remain free for personal use.

## Fork and run locally

The frontend uses Astro, React and shadcn/ui. The Rust API uses Axum, Tokio and SQLx with PostgreSQL 18. Firebase is used only for optional Analytics.

Fork this repository on GitHub, replace `YOUR-USERNAME`, and create a working branch from upstream development:

```bash
git clone https://github.com/YOUR-USERNAME/want-wallpapers.git
cd want-wallpapers
git remote add upstream https://github.com/andrey-krasheninnikov/want-wallpapers.git
git fetch upstream development
git switch -c my-change upstream/development
make install
```

Use Bun 1.3.14, Rust 1.93.0, Python 3, FFmpeg and Docker. Follow the [local setup](docs/development.md#local-setup) to create a separate local PostgreSQL instance, private administrator files and development environment files. No production credentials are needed. The guide includes the exact steps; n8n is not required to run the site.

After configuring the local environment, build the site and start the backend:

```bash
make build
set -a
. ./.env
set +a
cargo run --locked -p want-wallpapers-server -- migrate
make dev-backend
```

In a second terminal, from the same repository:

```bash
make dev
```

Open <http://localhost:4321>. The frontend proxies `/api` to Rust on `127.0.0.1:8080`. The first build fetches catalog images and needs access to the public CDN. Detailed checks, catalog commands, deployment links and troubleshooting are in the [development guide](docs/development.md).

## Contributing

[Open an issue](https://github.com/andrey-krasheninnikov/want-wallpapers/issues/new) for a bug, a collection idea or an improvement. For a bug, include the page URL, reproduction steps and expected behaviour. Keep credentials and personal information out of reports.

Translations, accessibility fixes, documentation and code changes are welcome. Discuss substantial changes in an issue first, keep the change focused and target PRs at `development`. Follow [the visual system](DESIGN.md) and run the checks relevant to your change from the [development guide](docs/development.md#checks). The six public locales and existing download links must remain usable.

If you propose artwork or a physical edition, state the rights you hold and discuss publication terms before contributing files. The code license does not grant commercial rights to the existing wallpaper collection.

## Changelog and latest update

See [CHANGELOG.md](CHANGELOG.md) for the full history, including unreleased changes.

Latest published release: [v1.9.3](https://github.com/andrey-krasheninnikov/want-wallpapers/releases/tag/v1.9.3), October 20, 2026. It adds Arabic and right-to-left layout, makes feedback submission full width, and improves side-ad spacing with larger text. This README update does not change the application version.

## Development ideas

Ten directions to test, covering physical spaces and AR/VR. They have no committed dates or revenue forecasts. Printed editions need print-ready files and proofs; XR experiences need purpose-built scenes and device testing. Neither follows automatically from a downloadable PNG.

1. Limited art prints and posters for collectors. Sell numbered editions; test interest with a small preorder after approving one print proof.
2. Custom wall murals for homes and studios, with an AR placement preview. Earn from made-to-measure orders; test one room with a print partner.
3. Desk mats and interior textiles for people building a coordinated workspace. Sell physical pieces; start with one material sample and a request for interest.
4. Curated collections for digital picture-frame owners. Sell display licenses or a collection subscription; test one compatible frame before promising wider support.
5. Projection installations for cafés, hotels and events. Charge for a commissioned installation or a display license; try a short pilot with one venue.
6. Printed artwork with an AR animation layer. Sell a physical edition with the experience included; demonstrate one print through a phone camera.
7. AR portals from a room into a collection's world. Sell scenes or access to a themed experience; start with one portal prototype and audience feedback.
8. VR spaces for rest and focus. Sell individual environments or themed packs; test one scene on one supported headset platform.
9. Ticketed virtual exhibitions. Earn from admission or sponsorship; test a small exhibition and demand before building a permanent gallery.
10. Commissioned AR/VR scenes for brands and spaces. Charge for creation and defined usage rights; use a small demonstration to seek one paid pilot.

## License

Source code and documentation are available under the [MIT license](LICENSE).

Wallpaper images have separate [personal-use terms](https://wallpapers.want.foundation/license/). Downloading, displaying on your own devices and personal cropping are allowed. Resale, pack redistribution and commercial use require permission. The banner includes catalog artwork and does not expand those image rights. For licensing questions, contact [wallpapers@want.foundation](mailto:wallpapers@want.foundation).
