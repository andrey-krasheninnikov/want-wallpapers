# Want Wallpapers

Коллекция дизайнерских обоев Want. Исходные PNG находятся в S3; при сборке копии для скачивания и сжатые превью публикуются на Firebase Hosting.

Интерфейс использует Astro, React, Tailwind CSS 4 и локальные компоненты shadcn/ui на Radix. Каталог и метаданные рендерятся в HTML; React отвечает за меню, поиск, форматы, формы и настройки cookie. Цвета и размеры задаются в `src/styles/global.css`, настройки компонентов — в `components.json`.

## Локальная разработка

```bash
bun install
bun run dev
```

Для сборки нужен доступ к публичному S3 и переменные Firebase из `.env` (см. `.env.example`).

```bash
bun run build
bun run preview
```

## Проверки

```bash
bun run check
bun test tests/catalog-search.test.ts tests/search-filters.test.ts
firebase emulators:exec --project demo-want-wallpapers --only firestore 'bun run test:rules'
bun run test:ui
```

Для эмуляторов нужны Firebase CLI и Java. Для браузерных тестов установите Chromium командой `bunx --bun playwright install chromium`.

`test:ui` собирает отдельный сайт в `/private/tmp/want-wallpapers-ui/site`, запускает Auth и Firestore с проектом `demo-want-wallpapers` и проверяет четыре языка на ширинах 320, 768, 1024 и 1440 px. В сценариях проверяются доступность, поиск, настройки cookie, скачивание, оценки, комментарии и форма обратной связи. Данные записываются только в локальные эмуляторы. Скриншоты и HTML-отчёт находятся в `/private/tmp/want-wallpapers-ui/`; рабочая сборка `dist/` не заменяется.

При ручной разработке эмуляторы подключаются только на `localhost` или `127.0.0.1` и только с `PUBLIC_USE_FIREBASE_EMULATORS=true`. Перед этим задайте все публичные Firebase-параметры для тестового проекта; не смешивайте тестовые параметры с настройками публикации.

Метаданные первого выпуска находятся в `src/data/catalog.ts`. Текущие 3 коллекции и 25 обоев уже загружены в Firestore. После изменения каталога выгрузите его командой `bun run catalog:pull` перед сборкой. `bun run catalog:seed` нужен только для первого заполнения другого проекта: он требует сервисный аккаунт через `GOOGLE_APPLICATION_CREDENTIALS` и не перезаписывает существующие записи. Ключ не хранится в репозитории. Выгрузка публичного каталога использует настройки веб-приложения из `.env`.

## Перед публикацией

`bun run build` проверяет 50 исходных PNG, создаёт WebP-превью и кладёт копии PNG в `dist/downloads/`. Папки с изображениями и `dist/` игнорируются Git; сборка для публикации должна выполняться там, где доступен публичный S3. Проверьте размер сборки и лимит трафика Firebase Hosting перед запуском.

Анонимный вход и базовые правила Firestore уже настроены в проекте `want-wallpapers`. На бесплатном тарифе автоматическое удаление по TTL недоступно. При закрытии обращения владелец ставит `status: closed` и поле `expireAt` типа Timestamp на один год позже даты закрытия, создаёт напоминание на эту дату и вручную удаляет запись в Firestore в срок. Открытые обращения остаются без `expireAt`.

Analytics заработает только после подключения Google Analytics к Firebase, получения `measurementId` и установки `PUBLIC_FIREBASE_MEASUREMENT_ID` перед сборкой. Для App Check также нужен зарегистрированный ключ `PUBLIC_RECAPTCHA_SITE_KEY` и проверка работы после развёртывания. До этого App Check не включайте в режиме принудительной проверки. Рекламный провайдер пока не подключён.
