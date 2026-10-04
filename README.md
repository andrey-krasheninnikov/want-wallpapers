# Want Wallpapers

Коллекция дизайнерских обоев Want. Исходные PNG находятся в S3; при сборке создаются копии для скачивания и сжатые превью. Целевой хостинг — VPS с Nginx за Traefik и Cloudflare на `wallpapers.want.foundation`; Firebase Auth и Firestore остаются в Firebase.

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
firebase emulators:exec --project demo-want-wallpapers --only firestore 'bun test tests/catalog-add.test.ts'
firebase emulators:exec --project demo-want-wallpapers --only firestore 'bun run test:rules'
bun run test:ui
```

Для эмуляторов нужны Firebase CLI и Java. Для браузерных тестов установите Chromium командой `bunx --bun playwright install chromium`.

`test:ui` собирает отдельный сайт в `want-wallpapers-ui/site` внутри системного временного каталога (`os.tmpdir()`), запускает Auth и Firestore с проектом `demo-want-wallpapers` и проверяет четыре языка на ширинах 320, 768, 1024 и 1440 px. В сценариях проверяются доступность, поиск, настройки cookie, скачивание, оценки, комментарии и форма обратной связи. Данные записываются только в локальные эмуляторы. Скриншоты и HTML-отчёт находятся в том же `want-wallpapers-ui/`; рабочая сборка `dist/` не заменяется.

При ручной разработке эмуляторы подключаются только на `localhost` или `127.0.0.1` и только с `PUBLIC_USE_FIREBASE_EMULATORS=true`. Перед этим задайте все публичные Firebase-параметры для тестового проекта; не смешивайте тестовые параметры с настройками публикации.

Метаданные первого выпуска находятся в `src/data/catalog.ts`. Актуальный каталог хранится в Firestore и выгружается в `src/data/catalog-live.json`. После изменения каталога выгрузите его командой `bun run catalog:pull` перед сборкой. `bun run catalog:seed` нужен только для первого заполнения другого проекта: он требует сервисный аккаунт через `GOOGLE_APPLICATION_CREDENTIALS` и не перезаписывает существующие записи. Ключ не хранится в репозитории. Выгрузка публичного каталога использует настройки веб-приложения из `.env`.

## Выпуск новой коллекции

Проектный [skill `release-collection`](.agents/skills/release-collection/SKILL.md) принимает ссылку на публичную папку текущего CDN. Пример запроса:

```text
$release-collection Добавь и выпусти новую коллекцию:
https://s3.twcstorage.ru/wallpapers/assets/collections/0004-collection-name/
```

Замените адрес на реальную папку. Этот запрос запускает подготовку текстов на четырёх языках, проверку desktop/mobile PNG, добавление в Firestore, выгрузку каталога и Gitflow: feature PR со squash в development, release PR с обычным merge в main, защищённый annotated тег и обратный semantic merge. Версия получает следующий minor и patch `0`; после тега публикуется GitHub Release. Feature- и release-ветки удаляются после подтверждения merge. Хостинг обновляется отдельно по соответствующей инструкции ниже.

Для добавления данных используется `catalog:add`. Manifest содержит одну `collection` и массив `wallpapers` в существующих типах `Collection` и `Wallpaper`; поля и правила описаны в [инструкции подготовки каталога](.agents/skills/release-collection/references/catalogue.md). Сначала выполните проверку без доступа к Firebase:

```bash
bun run catalog:add /absolute/path/collection.json --dry-run
```

Для записи в рабочий Firestore нужен сервисный аккаунт проекта `want-wallpapers` с правами чтения и записи данных, например ролью `Cloud Datastore User`. В настройках проекта Firebase откройте «Сервисные аккаунты» и создайте приватный ключ. Сохраните JSON вне репозитория и задайте путь в своём терминале. Firebase CLI login не заменяет этот ключ для importer.

```bash
export GOOGLE_APPLICATION_CREDENTIALS="/absolute/path/outside-repository/service-account.json"
bun run catalog:add /absolute/path/collection.json
bun run catalog:pull
```

Перед рабочим импортом убедитесь, что `FIRESTORE_EMULATOR_HOST` отсутствует. При заданном локальном адресе этой переменной importer записывает данные только в проект `demo-want-wallpapers` эмулятора. Для рабочего импорта всегда используется проект `want-wallpapers`; `--dry-run` не читает и не изменяет Firebase.

Importer проверяет manifest и создаёт коллекцию с обоями одним атомарным batch, затем сверяет серверные документы. Полностью совпадающий повтор не делает записей. Частичные данные, занятый номер или изменённые документы останавливают импорт без перезаписи. При сетевой ошибке сначала проверьте серверное состояние. Не удаляйте данные и не запускайте `catalog:seed` для восстановления незавершённого выпуска. Этот процесс работает на Spark и не требует Cloud Functions.

## Перед публикацией

`bun run build` проверяет исходные desktop/mobile PNG всех обоев, создаёт WebP-превью и кладёт копии PNG в `dist/downloads/`. Папки с изображениями и `dist/` игнорируются Git; сборка для публикации должна выполняться там, где доступен публичный S3. Проверьте размер сборки, свободный диск и лимит трафика выбранного хостинга перед запуском.

Анонимный вход и базовые правила Firestore уже настроены в проекте `want-wallpapers`. На бесплатном тарифе автоматическое удаление по TTL недоступно. При закрытии обращения владелец ставит `status: closed` и поле `expireAt` типа Timestamp на один год позже даты закрытия, создаёт напоминание на эту дату и вручную удаляет запись в Firestore в срок. Открытые обращения остаются без `expireAt`.

Analytics заработает только после подключения Google Analytics к Firebase, получения `measurementId` и установки `PUBLIC_FIREBASE_MEASUREMENT_ID` перед сборкой. Для App Check также нужен зарегистрированный ключ `PUBLIC_RECAPTCHA_SITE_KEY` и проверка работы после развёртывания. До этого App Check не включайте в режиме принудительной проверки. Рекламный провайдер пока не подключён.

## Деплой на VPS через Traefik и Cloudflare

Workflow `.github/workflows/vps-build.yml` запускается для push в `main` и `feature/vps-traefik-deployment`, а также для PR и ручного запуска. Сначала выполняются Astro check, тесты поиска, importer и Firestore rules с локальным эмулятором, UI-тесты и полная сборка всех PNG/WebP из текущего каталога. После успешных проверок push в указанные ветки публикует `ghcr.io/andrey-krasheninnikov/want-wallpapers:<commit-SHA>`. PR не публикуют образ. Деплой на VPS автоматически не выполняется; SSH-ключи сервера в GitHub не нужны.

Dockerfile фиксирует базовые образы по digest и использует `.env.example` для публичной конфигурации Firebase. Не передавайте сервисные аккаунты или приватные ключи в сборку. Необязательные публичные значения `PUBLIC_FIREBASE_MEASUREMENT_ID` и `PUBLIC_RECAPTCHA_SITE_KEY` берутся из GitHub Actions repository variables; перед их добавлением настройте соответствующие сервисы и проверьте согласие пользователя.

На сервере должны быть заранее настроены Docker, Traefik с маршрутом `wallpapers.want.foundation` → `http://wallpapers:8080`, сеть `wallpapers-proxy` и origin-сертификат. В Cloudflare включите прокси DNS и SSL/TLS **Full (strict)**. Origin-порты 80/443 должны принимать только сети Cloudflare, включая Docker ingress. Само приложение не публикует host-порты и работает без root с read-only filesystem и лимитами ресурсов.

Перед первым pull сделайте GHCR-пакет публичным в его настройках либо настройте отдельную авторизацию на чтение пакета. GitHub автоматически не делает новый пакет публичным; fine-grained PAT для Git не заменяет GHCR pull-доступ.

После успешного workflow используйте digest из результата `docker push`, а не изменяемый тег. Сохраните значение `WALLPAPERS_IMAGE=ghcr.io/andrey-krasheninnikov/want-wallpapers@sha256:<verified-digest>` в `/opt/want/apps/wallpapers/.env` рядом с копией `deploy/compose.yml`. Выполняйте развёртывание администратором:

```bash
sudo docker compose --project-directory /opt/want/apps/wallpapers -f /opt/want/apps/wallpapers/compose.yml pull
sudo docker compose --project-directory /opt/want/apps/wallpapers -f /opt/want/apps/wallpapers/compose.yml up -d --wait
sudo docker compose --project-directory /opt/want/apps/wallpapers -f /opt/want/apps/wallpapers/compose.yml ps
curl --fail --silent --show-error https://wallpapers.want.foundation/ru/ -o /dev/null
```

Проверьте четыре языка, вложенные URL и настоящие 404, canonical/sitemap, PNG/WebP, скачивания и cookie-настройки. В Firebase проверьте Authorized domains, ограничения API key и App Check для нового домена, если они используются; Auth и Firestore не мигрируют на VPS. Не включайте эмуляторы в production.

Сборку, Astro check и UI-тесты выполняйте в CI или на машине с достаточной памятью, не на малоресурсном VPS. Для отката сохраните предыдущий digest в `.env` и повторите `up -d --wait`. Старый Firebase Hosting не удаляется этим workflow; его отключение или редирект требуют отдельного решения. Раздел ниже сохранён для временного резервного хостинга; canonical остаётся на новом домене.

## Альтернативный деплой на Firebase Hosting (Spark)

Сайт собирается в статические файлы и использует обычный Firebase Hosting. Проект остаётся на бесплатном тарифе Spark. Конфигурация уже находится в `firebase.json` и `.firebaserc`: каталог публикации `dist`, проект `want-wallpapers`. Повторно запускать `firebase init` не нужно.

### 1. Подготовьте инструменты

Для сборки нужен Bun. Установите Firebase CLI по [официальной инструкции](https://firebase.google.com/docs/cli#install_the_firebase_cli); для CLI также нужен поддерживаемый Node.js. Java и Chromium нужны для проверок из раздела «Проверки».

Все следующие команды выполняйте из корня репозитория:

```bash
bun --version
firebase --version
bun install --frozen-lockfile
```

### 2. Войдите в Firebase и проверьте проект

```bash
firebase login
firebase projects:list
```

В списке должен присутствовать проект с ID `want-wallpapers`. Используйте аккаунт с правом деплоя в этот проект. Проверьте в настройках Firebase, что тариф остаётся Spark; подключать платёжный аккаунт для этого сайта не требуется.

### 3. Проверьте переменные сборки

Если `.env` ещё нет, создайте его из примера. Команда сохраняет существующий файл:

```bash
cp -n .env.example .env
```

В `.env` должны быть публичные настройки веб-приложения проекта `want-wallpapers`: `PUBLIC_FIREBASE_API_KEY`, `PUBLIC_FIREBASE_AUTH_DOMAIN`, `PUBLIC_FIREBASE_PROJECT_ID` и `PUBLIC_FIREBASE_APP_ID`. `PUBLIC_USE_FIREBASE_EMULATORS` должен отсутствовать или иметь значение `false`.

`PUBLIC_FIREBASE_MEASUREMENT_ID` и `PUBLIC_RECAPTCHA_SITE_KEY` заполняйте только после настройки соответствующих сервисов. Пока они пустые, аналитика и App Check не подключены. Сервисный аккаунт и `GOOGLE_APPLICATION_CREDENTIALS` для деплоя Hosting не нужны. Не добавляйте `.env` и ключи сервисного аккаунта в Git.

### 4. Обновите каталог, если меняли его в Firestore

```bash
bun run catalog:pull
```

Для правок интерфейса без изменения каталога этот шаг пропустите. `catalog:seed` не входит в обычный деплой.

### 5. Выполните проверки

Запустите команды из раздела «Проверки» выше. Браузерные сценарии используют локальные эмуляторы и не меняют данные рабочего проекта. Продолжайте после успешного завершения проверок.

### 6. Соберите и просмотрите сайт локально

```bash
bun run build
du -sh dist
bun run preview
```

Для сборки нужен доступ к публичному S3. В выводе preview будет локальный адрес сайта. Проверьте главную страницу, поиск, четыре языка, контакты и оба формата скачивания. Остановите preview через `Ctrl+C` перед следующим шагом.

Сборка включает по два оригинальных PNG на каждый дизайн в `dist/downloads/`: desktop и mobile. Скачивание этих файлов расходует трафик Firebase Hosting, даже если исходники находятся в S3. `.env` читается при сборке: после изменения переменных выполните `bun run build` ещё раз.

### 7. Опубликуйте сборку

Следующая команда обновляет публичный сайт:

```bash
firebase deploy --only hosting --project want-wallpapers
```

Флаг `--only hosting` публикует файлы из `dist` и настройки Hosting. Правила Firestore и настройки других сервисов этой командой не обновляются. Для этого проекта не требуются Cloud Functions, App Hosting или переход на Blaze. Подробнее: [деплой Firebase Hosting](https://firebase.google.com/docs/hosting/quickstart).

### 8. Проверьте результат

После сообщения об успешном деплое откройте [want-wallpapers.web.app](https://want-wallpapers.web.app/) и [русскую главную](https://want-wallpapers.web.app/ru/). Проверьте featured «Ночное дерево», поиск, изображения, скачивание desktop/mobile PNG, контакты, cookie-настройки, `robots.txt` и `sitemap-index.xml`.

Оценки, комментарии и форма доступны только в разрешённом регионе. Аналитика требует настройки и согласия посетителя. Успешный деплой сам по себе не подтверждает работу этих функций или подключение рекламы.

### Лимиты бесплатного тарифа

Firebase Hosting предоставляет 10 GB хранения и 10 GB исходящего трафика в месяц без оплаты. Хранение включает сохранённые релизы. При заполнении хранилища новый деплой будет заблокирован; освободите место, удалив ненужные старые релизы. При исчерпании трафика после короткого льготного периода сайт может быть отключён до начала следующего месяца. Следите за расходом в разделе Hosting в Firebase Console и сверяйте [актуальные лимиты Hosting](https://firebase.google.com/docs/hosting/usage-quotas-pricing).

Публикация коммитов в GitHub не выполняет деплой Hosting. После получения новых изменений повторите проверки, сборку и команду деплоя из этой инструкции.
