# Development and operations

[Project overview](../README.md) · [Обзор проекта](../README.ru.md)

## Local setup

Run commands from the repository root. Install Bun 1.3.14, Rust 1.93.0, Python 3, Docker and FFmpeg (`ffmpeg` and `ffprobe`). `make install` installs the pinned dependencies without dependency scripts. `age` is needed for backup/restore tests, and Playwright Chromium is needed only for UI tests.

### 1. Prepare a separate development database

Start Docker, then create a local PostgreSQL 18 instance through the existing helper:

```bash
TEST_DB_CONTAINER=want-wallpapers-dev-pg \
TEST_DB_PORT=55433 \
TEST_SECRETS_DIR="$HOME/.config/want-wallpapers/local-db" \
make test-db
```

This binds PostgreSQL to `127.0.0.1:55433` and keeps its connection file at `~/.config/want-wallpapers/local-db/database_url`. The separate container, port and secret directory keep ordinary tests, which use their own defaults, away from the development database. Choose other values if the name or port is already in use; do not remove an unknown container to free them. This database is for local development only.

### 2. Create local administrator files

```bash
python3 scripts/create-secrets.py "$HOME/.config/want-wallpapers/local"
```

The helper asks privately for an administrator password of at least 16 characters, its confirmation, an application database URL and a migration database URL. Read the connection file from step 1 in a private local editor and use that same local URL for both database prompts. Do not use a production connection. The helper creates these files outside Git and refuses to overwrite existing ones:

- `database_url` and `migration_database_url`.
- `admin_password_hash`, an Argon2id password hash.
- `admin_totp_secret`, the local authenticator secret.
- `catalog_api_token`, a local catalog token.

If you want to use `/admin/login/`, add the local TOTP secret to your authenticator privately. Keep these files and the administrator password out of reports and commits.

### 3. Configure the two environment files

```bash
cp -n .env.example .env
cp -n frontend/.env.example frontend/.env
```

Edit `.env` for this local setup. The shell expands `$HOME` when you source the file:

```bash
APP_ENV=development
SITE_URL=http://localhost:4321
BIND_ADDR=127.0.0.1:8080
STATIC_DIR=frontend/dist
DATABASE_URL_FILE=$HOME/.config/want-wallpapers/local/database_url
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH_FILE=$HOME/.config/want-wallpapers/local/admin_password_hash
ADMIN_TOTP_SECRET_FILE=$HOME/.config/want-wallpapers/local/admin_totp_secret
CATALOG_API_TOKEN_FILE=$HOME/.config/want-wallpapers/local/catalog_api_token
TRUSTED_PROXY_CIDRS=
RECAPTCHA_ENABLED=false
```

Leave optional Analytics values in `frontend/.env` empty for local development. With reCAPTCHA disabled in development, Google credentials and a production CAPTCHA key are not required. Production requires its own secure configuration and must not use this setup. Neither environment file is committed.

### 4. Build, migrate and start Rust

```bash
make build
set -a
. ./.env
set +a
cargo run --locked -p want-wallpapers-server -- migrate
make dev-backend
```

The build downloads and validates catalog media, creates the static site and CSP hashes, then builds the Rust server. It needs public CDN access and can take time on the first run. Migration seeds the local catalog; it does not import production visitor data. The backend does not load `.env` itself, so keep the export steps before migration and startup.

### 5. Start the frontend

In a second terminal at the repository root:

```bash
make dev
```

Open <http://localhost:4321>. Astro proxies `/api` to Rust on `127.0.0.1:8080`. Check backend readiness separately with `curl --fail http://127.0.0.1:8080/health/ready`. The development-only component gallery is at <http://localhost:4321/ui-kit/>. A static preview alone does not provide the API or administration.

Stop both foreground processes with Ctrl+C when finished. You can stop the development database with `docker stop want-wallpapers-dev-pg`; retain it to keep local data. The n8n and generation commands in the technical reference are separate local tools, not requirements for running the website.

## Checks

Use the smallest check covering the change. The existing root targets include:

```bash
make test-frontend
make test-backend
make test-ci
make check
```

`make test` additionally runs encrypted backup/restore tests and requires `age`. `make test-ui` builds the frontend and runs the complete UI suites. See the technical reference below for browser prerequisites, temporary directories and isolated database settings. Never point test commands at a production database.

For a documentation-only change, check the diff, links and any rendered images; a full application build is not a substitute for those checks.

## Technical reference

The following sections retain the detailed Russian development, catalog and operations instructions.

Дизайнерские обои Want на https://wallpapers.want.foundation/. Публичный интерфейс Astro/React/shadcn сохранён: коллекции, поиск, desktop/mobile PNG, шесть языков. Rust API хранит каталог и действия посетителей в PostgreSQL 18. Админка: `/admin/login/` и `/admin/`. Firebase используется только для необязательной Analytics. reCAPTCHA Enterprise защищает публичные изменения и вход в админку.

### Структура

- `frontend/`: Astro, React, стили, статический каталог и инструменты export/import.
- `backend/`: Axum/Tokio/SQLx, миграции PostgreSQL 18, авторизация, публичный API и модерация.
- `deploy/`: один контейнер за существующим Traefik, внешний PostgreSQL.
- `automation/n8n/`: отдельный локальный n8n на MacBook, постоянный Docker volume и приватные snapshots.
- `Makefile`: все основные команды из корня; Bun workspace и Cargo workspace.

Нужны Bun 1.3.14, Rust 1.93.0, Python 3, FFmpeg (ffmpeg/ffprobe) для проверки видеообложек, Docker для тестовой БД и `age` для проверки encrypted backup/restore. Версия выпуска — корневой package.json и Cargo workspace. Установка не выполняет dependency scripts.

```bash
make install
make test-db
make test
make check
make build
make docker-build
make test-container
cd frontend && bunx playwright install chromium
cd ..
make test-ui
```

`make test` запускает поиск/фильтры/manifest, Rust API на отдельном PostgreSQL 18, CI/deployment contracts и изолированное encrypted backup/restore. UI-прогоны создают новую локальную БД с уникальным именем, запускают Rust со статической сборкой, проверяют шесть языков на 320/768/1024/1440 px, доступность, cookie, оценки, комментарии, жалобы, обращения и админку. Существующие БД не удаляются. Отчёты: `want-wallpapers-ui/` внутри системного временного каталога (`os.tmpdir()`); в CI он задаётся через TMPDIR. Тестовые секреты: `/tmp/want-wallpapers-test-<uid>/`, режим 0700. Контейнер: `want-wallpapers-test-pg`; TEST_DB_CONTAINER, TEST_DB_PORT и TEST_SECRETS_DIR позволяют выбрать другую изолированную среду. Не задавайте production DATABASE_URL для тестов.

Chromium запускается с включённым sandbox. На Ubuntu 24.04+ AppArmor может запрещать user namespaces скачанным браузерам: разрешите `userns` для конкретных установленных Playwright-бинарников по [инструкции Chromium](https://chromium.googlesource.com/chromium/src/+/main/docs/security/apparmor-userns-restrictions.md). CI создаёт профили с точными путями и выполняет smoke-launch на одноразовом runner; настройки VPS не меняются.

### Разработка

Публичные заголовки используют общий размер 32-56 px. Страницы `/404/`, `/ru/404/`, `/zh-cn/404/`, `/pt-br/404/`, `/ja/404/` и `/ar/404/` возвращают HTTP 404 и исключены из индексации. Неизвестный публичный URL получает страницу на языке своего префикса; без известного префикса используется английский. API и health сохраняют JSON-ошибки.

`make dev` запускает frontend на localhost:4321; `/api` проксируется на Rust :8080. Скопируйте корневой `.env.example` в `.env`, задайте внешние secret files и `APP_ENV=development`, `SITE_URL=http://localhost:4321`. Публичные настройки Analytics находятся в `frontend/.env.example`; скопируйте их в `frontend/.env`. Для локальной разработки RECAPTCHA_ENABLED=false допустим; production требует Web key и credentials Google из внешнего файла. Backend не читает `.env` автоматически: экспортируйте переменные в терминале.

```bash
set -a
. ./.env
set +a
cargo run --locked -p want-wallpapers-server -- migrate
make dev-backend
```

Для локального DATABASE_URL_FILE можно использовать файл тестовой БД, подготовленный `make test-db`. Создайте отдельные секреты администратора через `scripts/create-secrets.py` вне репозитория. Для запуска Rust сначала нужна `make build`: она создаёт static site и CSP hashes. После этого frontend можно разрабатывать отдельно. Для просмотра production поведения используйте Rust: публичный API и production static site обслуживает Rust; `bun run preview` доступен для просмотра только статических страниц.

### Каталог и CDN

CDN: `https://want-foundation.s3.twcstorage.ru/wallpapers/assets/collections/<id>/<number>-desktop.png` и `-mobile.png`. Публичные ID/slug/download имена сохраняются. Поле fileStem остаётся в manifest для совместимости и больше не входит в имя CDN-файла. Новые PNG не загружаются через админку: она работает с существующими CDN-парами.

Миграция первоначально добавляет snapshot из Git: 3 коллекции / 25 дизайнов; старые социальные данные Firebase не импортируются. Рабочий каталог меняется через админку либо защищённый API. Кнопки «Показать/Скрыть» меняют списки, поиск и навигацию при следующем запросе. Прямые страницы, индексация и социальные действия сохраняются. Архив работает отдельно. Изменение содержимого и новые страницы требуют полного snapshot export и rebuild:

```bash
export BACKEND_API_URL=https://wallpapers.want.foundation
make catalog-pull
make build
```

Для атомарного импорта сохраните JSON `{collection,wallpapers}` и используйте токен вне репозитория. Формат и проверка PNG описаны в [инструкции каталога](../.agents/skills/release-collection/references/catalogue.md).

```bash
make catalog-add MANIFEST=/absolute/path/collection.json ARGS=--dry-run
export CATALOG_API_TOKEN_FILE=/absolute/path/outside-repository/catalog_api_token
make catalog-add MANIFEST=/absolute/path/collection.json
make catalog-pull
```

Dry-run не обращается к CDN/API. Импорт делает точный повтор без записи; частичные или отличающиеся данные дают conflict и не перезаписываются. После сетевого сбоя сначала выполните защищённый readback (`GET /api/v1/admin/catalog`). Номер папки уникален независимо от ведущих нулей. Существующие ID и социальные данные сохраняются. Новые категории/теги требуют отдельного согласованного обновления frontend/backend и деплоя до импорта. Для тестового API HTTP допустим только localhost/127.0.0.1.

Для выпуска коллекции используйте локальный `release-collection` с URL новой CDN-папки. Он сохраняет Gitflow и разрешения конкретного выпуска; запрос изучить папку разрешает только чтение. Protected v* tag сам ничего не запускает. Production workflow запускается вручную на том же tag ref; deployment требует подготовленного VPS и работающего Mac backup worker.

`make build` скачивает и декодирует оба PNG каждого дизайна, проверяет обе стороны ≥500 px, создаёт WebP и копии PNG для скачивания. CDN недоступен — сборка завершается ошибкой. Видеообложки необязательны: [формат, проверка и публикация](../docs/collection-covers.md). Сборка проверяет MP4/H.264 без аудио, до 10 секунд и 8 MiB, а также обязательный PNG-постер. FFmpeg нужен только в build/test-среде; Docker build устанавливает его автоматически. Кэш и build output не коммитятся.

### Эксплуатация

[Локальный n8n](../docs/local-n8n.md): запуск на MacBook, приватный вход, постоянные workflows/credentials/Wait и журнал, backup и восстановление в новый volume. n8n не развёртывается на VPS и не принимает публичные webhooks.

[Деплой на VPS](../docs/deployment.md) описывает PostgreSQL 18/TLS, роли, секреты, готовый маршрут Traefik к `wallpapers:8080` в сети `wallpapers-proxy`, Cloudflare Full (strict), GHCR, первый запуск, обновление, rollback и smoke checks. [HTTP API](../docs/api.md) описывает контракт и защиту. [ADR](../docs/adr/0004-rust-monorepo.md) фиксирует архитектуру.

Analytics включается только с полной публичной конфигурацией и разрешением analytics в независимых настройках согласия. Страна определяет defaults: вне EEA optional services включены для новых посетителей, в EEA и при неизвестной стране ожидают явного выбора. Сохранённый отказ имеет приоритет. Российский IP и ошибка ipwho.is не отключают оценки, комментарии и обращения; просмотр, поиск и скачивание доступны независимо от выбора. Админка не загружает optional tracking. Закрытые обращения удаляются ежедневной задачей через год. [Политика согласия](../docs/adr/0005-regional-availability-and-consent.md) описывает правила; [интеграция рекламы](../docs/advertising-providers.md) описывает баннеры и всплывающие окна HilltopAds на публичных страницах, кроме главных. CSP расширяется только для рекламных HTML-страниц; реальные показы требуют отдельной production-проверки.

Для выпуска готового `origin/development` используйте [`$release-patch`](../.agents/skills/release-patch/SKILL.md) для patch-инкремента с `fast` или [`$release-minor`](../.agents/skills/release-minor/SKILL.md) для minor-инкремента с `full` и patch `0`:

```text
$release-patch Выпусти origin/development и задеплой patch-релиз.
$release-minor Выпусти origin/development и задеплой minor-релиз.
```

Оба skill выполняют Gitflow через release PR в main, protected tag, ручной production deployment и обратный merge в development. [`$release-feature`](../.agents/skills/release-feature/SKILL.md) сохраняет общий порядок, поддержку feature-ветки и явной версии; без выбора профиля использует full. Для добавления коллекции из CDN приоритет имеет `release-collection`. Изменение или изучение skill не запускает выпуск.

Для выпуска с MacBook без Actions используйте [`$release-local`](../.agents/skills/release-local/SKILL.md) с явной версией и необязательным `fast`. Он сохраняет весь Gitflow, публикует подписанные образы обеих архитектур в GHCR и запускает restricted deployment. Нужны установленный local validator и приватная конфигурация Mac; [подготовка и команды](ci-releases.md#локальный-выпуск-с-macbook). Локальные проверки не запускают n8n.

Все GitHub workflows запускаются вручную. Checks проверяет выбранный HEAD без deployment. Один запуск Production deployment на protected annotated tag из истории main выполняет verification, публикацию тех же checked amd64/arm64 images без rebuild, eligibility и production backup/deploy. Full выбран по умолчанию; fast пропускает только полный UI/E2E suite. Создание тега ничего не запускает; повтор требует исходный digest и профиль. [CI и допуск релиза](../docs/ci-releases.md) описывает команды и evidence; [production deployment](../docs/production-deployments.md) описывает установку VPS validator, private backup worker и recovery.

Зависимости и ограниченные исключения audit описаны в [безопасности](../docs/security.md). Выполняйте `make audit` после установки cargo-audit 0.22.2. Проверка блокирует новые findings и просроченную оценку.

### Visual system and UI kit

See [DESIGN.md](../DESIGN.md) for visual tokens, typography, component composition and responsive rules. The design philosophy and direction board live in [docs/design](../docs/design/).

The public frontend and administration install @want-foundation/desyst-foundation and @want-foundation/desyst-react at the same exact version, currently 0.3.0. [Want Desyst](https://github.com/andrey-krasheninnikov/want-desyst) owns primitives, themes, local fonts, brand resources, liquid glass and common effects. Its [showcase](https://github.com/andrey-krasheninnikov/want-desyst/tree/v0.3.0/apps/showcase) provides the common component reference.

Layouts import @want-foundation/desyst-foundation/styles.css and @want-foundation/desyst-foundation/fonts.css. Product CSS imports @want-foundation/desyst-foundation/tailwind.css after Tailwind. React code imports public named exports from @want-foundation/desyst-react. Do not recreate local components/ui sources or alias another checkout.

Upgrade both packages together after reading the upstream changelog:

```sh
DESYST_VERSION=0.3.0
bun add --cwd frontend --exact "@want-foundation/desyst-foundation@$DESYST_VERSION" "@want-foundation/desyst-react@$DESYST_VERSION"
```

Review the lockfile, run frontend checks, a cached-media build and the affected browser scenarios. A dependency update does not deploy the site.

Wallpaper catalogue data, routes, API services, analytics, advertising, consent, saved theme preferences, feedback drafts and social mutations remain here. Product wrappers supply localized labels, UTC comment dates, contact destinations and event handlers. Astro navigation owns effect disposal and preserved animation phases. The private collection-review tool retains build-only Fontsource dependencies; public pages load fonts from foundation.

Run `bun run dev` and open `http://127.0.0.1:4321/ui-kit/` for installed-package smoke tests and product integration examples. The route remains development-only. Rebuild the local device scene with `bun frontend/scripts/device-scene.ts` after syncing previews.

Патч `patches/lunr-languages@1.22.0.patch` сохраняет состояние арабского stemmer в локальном объекте: браузерные ESM-модули выполняются в strict mode. Bun применяет патч при установке; Docker копирует его до установки зависимостей.

Браузерные тесты импортируют `test` и `expect` из `frontend/tests/browser.ts`. Общий fixture подменяет рекламный тег на уровне context до создания страниц; тесты рекламы задают собственные ответы без реальных показов и кликов.

## Продуктовая аналитика

Контракт событий, настройки согласия, ограничения и инструкция GA4 описаны в [product-analytics.md](product-analytics.md). `bun run test:analytics-ui` выполняет отдельные браузерные проверки с подменой внешних сервисов. Сценарий включён в `make test-ui` и локальный профиль full.

The public CTA composition owns visibility and background-effects preference wiring for the shared Glow. Product sphere hit testing dispatches want:background-shimmer; the shared foundation owns wave timing, restart and cleanup. Home mosaic selection and device-scene cycles remain product behavior.
