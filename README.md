# Want Wallpapers

Дизайнерские обои Want на https://wallpapers.want.foundation/. Публичный интерфейс Astro/React/shadcn сохранён: коллекции, поиск, desktop/mobile PNG, четыре языка. Rust API хранит каталог и действия посетителей в PostgreSQL 18. Админка: `/admin/login/` и `/admin/`. Firebase используется только для необязательной Analytics. reCAPTCHA Enterprise защищает публичные изменения и вход в админку.

## Структура

- `frontend/`: Astro, React, стили, статический каталог и инструменты export/import.
- `backend/`: Axum/Tokio/SQLx, миграции PostgreSQL 18, авторизация, публичный API и модерация.
- `deploy/`: один контейнер за существующим Traefik, внешний PostgreSQL.
- `Makefile`: все основные команды из корня; Bun workspace и Cargo workspace.

Нужны Bun 1.3.14, Rust 1.93.0, Python 3 и Docker для тестовой БД. Версия выпуска — корневой package.json и Cargo workspace. Установка не выполняет dependency scripts.

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

`make test` запускает поиск/фильтры/manifest и Rust API на отдельном PostgreSQL 18. UI-прогоны создают новую локальную БД с уникальным именем, запускают Rust со статической сборкой, проверяют четыре языка на 320/768/1024/1440 px, доступность, cookie, оценки, комментарии, жалобы, обращения и админку. Существующие БД не удаляются. Отчёты: `want-wallpapers-ui/` внутри системного временного каталога (`os.tmpdir()`); в CI он задаётся через TMPDIR. Тестовые секреты: `/tmp/want-wallpapers-test-<uid>/`, режим 0700. Контейнер: `want-wallpapers-test-pg`; TEST_DB_CONTAINER, TEST_DB_PORT и TEST_SECRETS_DIR позволяют выбрать другую изолированную среду. Не задавайте production DATABASE_URL для тестов.

Chromium запускается с включённым sandbox. На Ubuntu 24.04+ AppArmor может запрещать user namespaces скачанным браузерам: разрешите `userns` для конкретных установленных Playwright-бинарников по [инструкции Chromium](https://chromium.googlesource.com/chromium/src/+/main/docs/security/apparmor-userns-restrictions.md). CI создаёт профили с точными путями и выполняет smoke-launch на одноразовом runner; настройки VPS не меняются.

## Разработка

`make dev` запускает frontend на localhost:4321; `/api` проксируется на Rust :8080. Скопируйте корневой `.env.example` в `.env`, задайте внешние secret files и `APP_ENV=development`, `SITE_URL=http://localhost:4321`. Публичные настройки Analytics находятся в `frontend/.env.example`; скопируйте их в `frontend/.env`. Для локальной разработки RECAPTCHA_ENABLED=false допустим; production требует Web key и credentials Google из внешнего файла. Backend не читает `.env` автоматически: экспортируйте переменные в терминале.

```bash
set -a
. ./.env
set +a
cargo run --locked -p want-wallpapers-server -- migrate
make dev-backend
```

Для локального DATABASE_URL_FILE можно использовать файл тестовой БД, подготовленный `make test-db`. Создайте отдельные секреты администратора через `scripts/create-secrets.py` вне репозитория. Для запуска Rust сначала нужна `make build`: она создаёт static site и CSP hashes. После этого frontend можно разрабатывать отдельно. Для просмотра production поведения используйте Rust: публичный API и production static site обслуживает Rust; `bun run preview` доступен для просмотра только статических страниц.

## Каталог и CDN

CDN: `https://want-foundation.s3.twcstorage.ru/wallpapers/assets/collections/<id>/<number>-desktop.png` и `-mobile.png`. Публичные ID/slug/download имена сохраняются. Поле fileStem остаётся в manifest для совместимости и больше не входит в имя CDN-файла. Новые PNG не загружаются через админку: она работает с существующими CDN-парами.

Миграция первоначально добавляет snapshot из Git: 3 коллекции / 25 дизайнов; старые социальные данные Firebase не импортируются. Рабочий каталог меняется через админку либо защищённый API. Статические страницы и поиск обновляются после export и rebuild:

```bash
export BACKEND_API_URL=https://wallpapers.want.foundation
make catalog-pull
make build
```

Для атомарного импорта сохраните JSON `{collection,wallpapers}` и используйте токен вне репозитория. Формат и проверка PNG описаны в [инструкции каталога](.agents/skills/release-collection/references/catalogue.md).

```bash
make catalog-add MANIFEST=/absolute/path/collection.json ARGS=--dry-run
export CATALOG_API_TOKEN_FILE=/absolute/path/outside-repository/catalog_api_token
make catalog-add MANIFEST=/absolute/path/collection.json
make catalog-pull
```

Dry-run не обращается к CDN/API. Импорт делает точный повтор без записи; частичные или отличающиеся данные дают conflict и не перезаписываются. После сетевого сбоя сначала выполните защищённый readback (`GET /api/v1/admin/catalog`). Номер папки уникален независимо от ведущих нулей. Существующие ID и социальные данные сохраняются. Новые категории/теги требуют отдельного согласованного обновления frontend/backend и деплоя до импорта. Для тестового API HTTP допустим только localhost/127.0.0.1.

Для выпуска коллекции используйте локальный `release-collection` с URL новой CDN-папки. Он сохраняет Gitflow и разрешения конкретного выпуска; запрос изучить папку разрешает только чтение. Release не развёртывает сайт автоматически.

`make build` скачивает и декодирует оба PNG каждого дизайна, проверяет обе стороны ≥500 px, создаёт WebP и копии PNG для скачивания. CDN недоступен — сборка завершается ошибкой. Кэш и build output не коммитятся.

## Эксплуатация

[Деплой на VPS](docs/deployment.md) описывает PostgreSQL 18/TLS, роли, секреты, готовый маршрут Traefik к `wallpapers:8080` в сети `wallpapers-proxy`, Cloudflare Full (strict), GHCR, первый запуск, обновление, rollback и smoke checks. [HTTP API](docs/api.md) описывает контракт и защиту. [ADR](docs/adr/0004-rust-monorepo.md) фиксирует архитектуру.

Analytics включается только с measurement ID, согласием посетителя и разрешённым регионом. Российский IP или ошибка ipwho.is отключает социальные функции, обращения и Analytics в публичном интерфейсе; просмотр, поиск и скачивание остаются. Админка работает независимо от региона. Закрытые обращения удаляются ежедневной задачей через год.

Workflow Checks запускает проверки для PR, ручного запуска и push в main, development, feature/vps-traefik-deployment и feature/rust-backend-monorepo. После успешных native container проверок на amd64 и arm64 main/VPS-ветка публикуют `ghcr.io/andrey-krasheninnikov/want-wallpapers:<commit-SHA>`. Это multi-platform index linux/amd64 + linux/arm64 из проверенных CI artifacts. PR и Rust-ветка образ не публикуют. Деплой VPS выполняется отдельно. Для production используйте проверенный digest из результата публикации.

Зависимости и ограниченные исключения audit описаны в [безопасности](docs/security.md). Выполняйте `make audit` после установки cargo-audit 0.22.2. Проверка блокирует новые findings и просроченную оценку.
