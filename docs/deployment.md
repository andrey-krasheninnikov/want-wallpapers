# Деплой на VPS: Docker, Traefik, внешний PostgreSQL 18

Сайт: `https://wallpapers.want.foundation/`. Развёртывание выполняется оператором отдельно от Git release. В production нет контейнера PostgreSQL и Docker socket приложения. Нужны DNS домена на VPS, уже работающий Traefik с HTTPS origin-сертификатом и готовым маршрутом к `http://wallpapers:8080`, внешняя Docker network `wallpapers-proxy` и внешний PostgreSQL 18 с сертификатом, соответствующим DNS/IP соединения. Укажите точные значения вашей установки, а не пример subnet.

## 1. База и роли

На PostgreSQL 18 через защищённое административное соединение создайте новую БД и две роли. Пароли задавайте интерактивно через `\password`, не в SQL-файле или истории shell.

```sql
CREATE ROLE wallpapers_migrator LOGIN;
\password wallpapers_migrator
CREATE ROLE wallpapers_app LOGIN;
\password wallpapers_app
CREATE DATABASE wallpapers OWNER wallpapers_migrator;
REVOKE ALL ON DATABASE wallpapers FROM PUBLIC;
GRANT CONNECT ON DATABASE wallpapers TO wallpapers_app;
```

Migrator владеет БД и выполняет DDL только в one-off операции. App получает ограниченные права после миграций через `deploy/runtime-grants.sql`. На сервере БД разрешите TLS-соединения только с VPS и настройте SCRAM authentication. Не публикуйте PostgreSQL на весь интернет без сетевого ограничения.

URL каждого секрета: `postgresql://<role>:<percent-encoded-password>@<certificate-host>:5432/wallpapers?sslmode=verify-full`. Если используется IP, сертификат должен содержать этот IP в SAN. Не заменяйте verify-full на require/disable. Приложение проверяет major 18 и отказывается работать с другой версией. CA PostgreSQL сохраните в отдельный `postgres_ca.pem` (для публичного CA тоже можно предоставить цепочку доверия).

## 2. Секреты и вход

Вне checkout подготовьте новую директорию, например `/etc/want-wallpapers/secrets` с режимом 0700. Нужны Python 3 и Bun либо Docker. Без Bun скрипт использует закреплённый Bun-контейнер с отключённой сетью, read-only filesystem и паролем через stdin. Выполните:

```bash
python3 scripts/create-secrets.py /absolute/path/outside-repository/secrets
```

Скрипт интерактивно запрашивает пароль (≥16 символов) и два DB URL, сохраняет только Argon2id hash, создаёт TOTP seed и отдельный случайный токен каталога. Существующие файлы не перезаписывает. Добавьте секрет `admin_totp_secret` в приложение аутентификатора приватно: TOTP, SHA1, 6 цифр, период 30 секунд. Не включайте seed, пароль или provisioning URI в отчёты и логи. Пароль храните в password manager; синхронизируйте время VPS через NTP. Администратора нельзя создавать через публичный сайт; вход всегда требует пароль и TOTP.

Перенесите файлы по защищённому каналу. На VPS directory принадлежит root и имеет 0700. Файлы секретов и CA должны читаться uid 10001 внутри контейнера. Compose использует file-backed secrets; поля uid/mode не меняют права bind mount. Пример после размещения файлов:

```bash
sudo chown root:root /etc/want-wallpapers/secrets
sudo chmod 700 /etc/want-wallpapers/secrets
sudo chown 10001:10001 /etc/want-wallpapers/secrets/*
sudo chmod 400 /etc/want-wallpapers/secrets/*
```

Не сохраняйте секреты в Git, Docker build args, образе или frontend. Файлы: database_url, migration_database_url, admin_password_hash, admin_totp_secret, catalog_api_token, postgres_ca.pem, google_application_credentials.json. Каталожный токен разрешает только каталог, без модерации/обращений/сессий.

### reCAPTCHA Enterprise

В Google Cloud project `want-wallpapers` включите reCAPTCHA Enterprise API. Создайте Web key со score-based integration для `wallpapers.want.foundation`, сохранив проверку домена. Переданное публичное значение `5465df27916cff0097d19961415940bc247e052d` нужно сверить с **reCAPTCHA → Keys → Key ID** перед запуском. Оно ещё не подтверждено реальным browser assessment; не используйте ID ключа сервисного аккаунта вместо Web key.

Задайте в deploy/.env RECAPTCHA_PROJECT_ID=want-wallpapers, PUBLIC_RECAPTCHA_SITE_KEY=<проверенный Web Key ID>, RECAPTCHA_MIN_SCORE=0.5. Создайте сервисный аккаунт с минимальной ролью `roles/recaptchaenterprise.agent`; JSON разместите вне checkout как google_application_credentials.json. Compose монтирует его только в app: GOOGLE_APPLICATION_CREDENTIALS=/run/secrets/google_application_credentials. Migrator и сборка его не получают. Не копируйте JSON в frontend, CI variables, build args или логи. [Создание Web key](https://docs.cloud.google.com/recaptcha/docs/create-key-website), [создание assessment](https://docs.cloud.google.com/recaptcha/docs/create-assessment-website).

Production требует корректные настройки и файл credentials при старте; отключить CAPTCHA нельзя. Ошибка Google, низкий score, чужой action/hostname или просроченный/повторный токен блокируют действие. Во время сбоя просмотр и скачивания работают. Проверьте исходящий HTTPS к Google, время VPS и quotas проекта. Ошибки IAM/key/domain исправляйте в настройках, без ослабления защиты. Реальный assessment подтверждается отдельно на домене после деплоя; SDK stubs и CI synthetic credentials этого не доказывают.

Enterprise.js загружается при отправке формы или оценки, включая admin login, независимо от согласия на необязательную Analytics. Google badge и ссылки Privacy/Terms сохраняются. CSP разрешает только нужные пути Google/gstatic; пользовательские поля Google не передаются.

## 3. Образ и Traefik

Backend и frontend входят в один Rust-образ. Базовые образы закреплены digest, OCI labels содержат repository URL и revision. Только main проходит audit, полный UI и native amd64/arm64 production runtime с PostgreSQL 18/TLS; feature, development, release и PR используют лёгкий static/unit/API набор. Main публикует проверенные images через Docker artifacts без rebuild и OCI index с долговечным release record в GHCR. Production eligibility требует immutable protected annotated v* тег, успешный main run/attempt и совпадение source SHA, image IDs, platform digests/revisions и общего digest. Ранний тег ожидает публикацию до 90 минут; failed/missing/mismatched evidence блокирует допуск. Registry reference содержит SHA/run/attempt, а deployment использует точный digest. [Контракт и команды проверки](ci-releases.md) описывают outputs и исходный digest для повторов. Runtime publication и release eligibility не выполняют SSH или deployment.

Для ручной сборки используйте проверенный checkout с доступным CDN:

```bash
make docker-build
cp -n deploy/.env.example deploy/.env
```

Перед первым GHCR pull сделайте пакет публичным либо настройте отдельный доступ только на чтение пакета. Права Git сами по себе не дают pull-доступ. В APP_IMAGE укажите `ghcr.io/andrey-krasheninnikov/want-wallpapers@sha256:<verified-digest>` из record успешного release gate для выбранного защищённого тега; локальная сборка использует `want-wallpapers:local`. Analytics следует настройкам согласия ADR 0005: defaults включены для новых посетителей вне ЕЭЗ, а ЕЭЗ и unknown требуют явного выбора; сохранённый отказ имеет приоритет. При сборке передавайте публичные PUBLIC_FIREBASE_API_KEY, PUBLIC_FIREBASE_PROJECT_ID, PUBLIC_FIREBASE_APP_ID и PUBLIC_FIREBASE_MEASUREMENT_ID; CI берёт их из repository variables. Без полной публичной конфигурации Analytics выключена. Приватные ключи, DB URL и токены в build args не передаются.

Задайте SECRETS_DIR, ADMIN_USERNAME, TRAEFIK_NETWORK и TRUSTED_PROXY_CIDRS. Compose добавляет alias `wallpapers` только сервису app в существующей сети `wallpapers-proxy`; route и origin-сертификат принадлежат установленному Traefik. Docker discovery выключен для app/migrate, labels не создают второй route. Если существующий route использует healthcheck, укажите `/health/ready` вместо прежнего Nginx `/healthz`. Перед переключением остановите прежний контейнер с тем же alias по его существующей инструкции: два контейнера с alias `wallpapers` одновременно создадут неоднозначную маршрутизацию. Данные внешней PostgreSQL не удаляются.

В Cloudflare включите прокси DNS и [SSL/TLS Full (strict)](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/); origin-сертификат должен быть действующим и соответствовать wallpapers.want.foundation. Origin-порты 80/443 разрешают только текущие сети Cloudflare, включая Docker ingress. App не публикует host-порты. Cache Rules должны обходить `/api/*`, `/admin/*` и `/health/*`; приватные ответы, Set-Cookie и Cache-Control: no-store не кешируются. Не включайте Cache Everything для этих путей.

TRUSTED_PROXY_CIDRS содержит фактические адреса доверенных Traefik proxy. Если сохранённый X-Forwarded-For включает Cloudflare, добавьте её актуальные proxy CIDRs, полученные из [официального списка](https://www.cloudflare.com/ips/), чтобы проверка цепочки дошла до IP посетителя. Traefik должен доверять forwarded headers только Cloudflare через [forwardedHeaders.trustedIPs](https://doc.traefik.io/traefik/reference/install-configuration/entrypoints/#forwarded-headers); forwardedHeaders.insecure выключен. Для прямого Traefik без Cloudflare доверяйте только Traefik. Не используйте 0.0.0.0/0 или все private ranges. Встроенная защита проверяет цепочку справа налево при доверенном socket peer и игнорирует поддельный левый префикс. Адрес proxy фиксируйте либо используйте контролируемую изолированную сеть; проверьте её через `docker network inspect <network>`.

```bash
make deploy-config
make migrate
```

После миграций примените `deploy/runtime-grants.sql` к БД wallpapers от migrator/DBA. App не должен владеть схемой, таблицами или иметь CREATE. Не выдавайте app права на `_sqlx_migrations`. Новая миграция с новыми таблицами требует соответствующего явного grant.

```bash
docker compose --env-file deploy/.env -f deploy/compose.yaml pull
docker compose --env-file deploy/.env -f deploy/compose.yaml up -d --wait app
```

Один сервис app подключён к существующей внешней network. Он работает uid 10001 с read-only filesystem, без Linux capabilities, с no-new-privileges, 32 MiB tmpfs, 512 MiB RAM без swap, 2 CPU, лимитом 64 процессов и local logging (max-size=5m, max-file=3). PostgreSQL подключается через обычный DNS/IP и TLS. Сервис migrate включается только профилем operations и не получает Traefik route. Runtime не выполняет миграции сам.

## 4. Проверка после запуска

Проверьте свежим readback:

```bash
curl --fail https://wallpapers.want.foundation/health/ready
curl --fail https://wallpapers.want.foundation/api/v1/catalog
curl --head https://wallpapers.want.foundation/admin/login/
curl --fail https://wallpapers.want.foundation/sitemap-index.xml
```

Проверьте реальные HTTPS, certificate chain, отсутствие edge cache у admin/API/health и IP посетителя в ограничении входа за Cloudflare/Traefik, noindex у admin, отсутствие admin/API в sitemap, новый домен в canonical/hreflang/OG/schema, четыре языка, изображения, обе загрузки и доступность функций при ошибке country lookup. Проверьте настоящий Google assessment для оценки и обращения: action, hostname и score. Убедитесь, что запрос без токена и повторный токен блокируются. В `/admin/login/` войдите с CAPTCHA, паролем/TOTP, проверьте редактирование переводов, архив/restore, комментарии, жалобы и обращения. Logout должен отзывать cookie. Каталожный токен должен получать 403 на moderation; проверяйте токен с защищённым config/header file, не через буквальный аргумент CLI. Сохраните результаты без секретов и персональных сообщений. Local/CI checks не подтверждают production.

## 5. Обновления и rollback

Перед миграциями сделайте backup внешней БД и проверьте восстановление в отдельной среде. Посмотрите diff миграций и совместимость предыдущего runtime. Получите record успешного release gate для нового защищённого тега и сохраните tag/SHA/run/attempt/digest вне checkout. Для повтора сверяйте исходный digest через gate, без выбора latest или rebuild. Выполните migrate с новой версией, выдайте необходимые новые grants, переключите APP_IMAGE и `up -d --wait app`, затем повторите smoke checks. Сохраните предыдущий digest до обновления; rollback возвращает этот digest и повторяет `up -d --wait app`. Rollback контейнера допустим только если схема совместима с прошлой версией; иначе нужен проверенный план восстановления. Автоматическое удаление/откат БД не выполняется.

Каталог: админка/API, `make catalog-pull`, проверки, сборка нового образа, обновление app. Не отдавайте приложению Docker socket для самостоятельного rebuild. Чтобы исключить изменение каталога во время сборки, сохраните согласованный snapshot в release checkout и сравните API readback перед публикацией.

Ротация токена: замените внешний catalog_api_token новым случайным значением ≥32 символов и пересоздайте app (`up -d --force-recreate app`), затем readback с новым токеном и отказ старого. Изменение password hash, username или TOTP seed отзывает старые admin sessions при следующей проверке. Сначала подготовьте новый аутентификатор приватно, затем замените секрет и пересоздайте app. Cookie visitor остаются отдельными.

Ежедневная очистка запускается сразу при старте и далее раз в 24 часа. Закрытые обращения старше года удаляются; открытые сохраняются. Время простоя может задержать удаление до следующего запуска. Следите за сообщением `scheduled cleanup failed`, доступностью БД, диском и трафиком PNG. Audit хранит только тип действия, ID цели, роль и время; отдельного автоматического удаления audit/social данных нет.
