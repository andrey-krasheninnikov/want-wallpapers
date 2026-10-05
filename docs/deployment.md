# Деплой на VPS: Docker, Traefik, внешний PostgreSQL 18

Сайт: `https://wallpapers.want.foundation/`. Развёртывание выполняется оператором отдельно от Git release. В production нет контейнера PostgreSQL и Docker socket приложения. Нужны DNS домена на VPS, уже работающий Traefik с HTTPS origin-сертификатом и готовым маршрутом к `http://wallpapers:8080`, существующая internal Docker network `wallpapers-proxy`, отдельная внешняя non-internal egress network и внешний PostgreSQL 18 с сертификатом, соответствующим DNS/IP соединения. Укажите точные значения вашей установки, а не пример subnet.

## 1. База и роли

На PostgreSQL 18 через защищённое административное соединение создайте новую БД и две роли. Пароли задавайте интерактивно через `\password`, не в SQL-файле или истории shell.

```sql
CREATE ROLE "wallpapers-migrator" LOGIN;
\password "wallpapers-migrator"
CREATE ROLE wallpapers LOGIN;
\password wallpapers
CREATE DATABASE wallpapers OWNER "wallpapers-migrator";
REVOKE ALL ON DATABASE wallpapers FROM PUBLIC;
GRANT CONNECT ON DATABASE wallpapers TO wallpapers;
```

Это только первоначальное provisioning новой выделенной БД. На действующей установке не создавайте роли/БД повторно: проверьте фактические `wallpapers-migrator` и `wallpapers`, владельцев и grants. Migrator владеет БД и выполняет DDL только в one-off операции. App получает ограниченные права после миграций через `deploy/runtime-grants.sql`. На сервере БД разрешите TLS-соединения только с VPS и настройте SCRAM authentication. Не публикуйте PostgreSQL на весь интернет без сетевого ограничения.

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

В Google Cloud project `want-wallpapers` включите reCAPTCHA Enterprise API. Создайте Web key со score-based integration для `wallpapers.want.foundation`, сохранив проверку домена. На действующей установке сохраните Web key, score, domain verification и JSON credentials из operational config; повторное создание ключа не требуется. При новой установке возьмите Web Key ID из **reCAPTCHA → Keys → Key ID**; ID сервисного аккаунта для этого не подходит. Текущее публичное значение из recovery notes приведено ниже как документированный snapshot, а не свежая проверка Google assessment.

Задайте в deploy/.env RECAPTCHA_PROJECT_ID=want-wallpapers, PUBLIC_RECAPTCHA_SITE_KEY=<проверенный Web Key ID>, RECAPTCHA_MIN_SCORE=0.5. Создайте сервисный аккаунт с минимальной ролью `roles/recaptchaenterprise.agent`; JSON разместите вне checkout как google_application_credentials.json. Compose монтирует его только в app: GOOGLE_APPLICATION_CREDENTIALS=/run/secrets/google_application_credentials. Migrator и сборка его не получают. Не копируйте JSON в frontend, CI variables, build args или логи. [Создание Web key](https://docs.cloud.google.com/recaptcha/docs/create-key-website), [создание assessment](https://docs.cloud.google.com/recaptcha/docs/create-assessment-website).

Production требует корректные настройки и файл credentials при старте; отключить CAPTCHA нельзя. Ошибка Google, низкий score, чужой action/hostname или просроченный/повторный токен блокируют действие. Во время сбоя просмотр и скачивания работают. Проверьте исходящий HTTPS к Google, время VPS и quotas проекта. Ошибки IAM/key/domain исправляйте в настройках, без ослабления защиты. Реальный assessment подтверждается отдельно на домене после деплоя; SDK stubs и CI synthetic credentials этого не доказывают.

Enterprise.js загружается при отправке формы или оценки, включая admin login, независимо от согласия на необязательную Analytics. Google badge и ссылки Privacy/Terms сохраняются. CSP разрешает только нужные пути Google/gstatic; пользовательские поля Google не передаются.

## 3. Образ и Traefik

Backend и frontend входят в один Rust-образ. Базовые образы закреплены digest, OCI labels содержат repository URL и revision. Checks выполняет audit, static/unit/API/UI и production TLS проверки на native amd64/arm64 runners; после успеха main/VPS-ветка публикуют `ghcr.io/andrey-krasheninnikov/want-wallpapers:<commit-SHA>` как multi-platform index linux/amd64 + linux/arm64. Публикуются именно проверенные образы из CI artifacts; повторной сборки между тестом и push нет. OCI revision обеих платформ совпадает с commit SHA. PR, development и Rust-ветка только проверяются. Сборки выполняются в CI или на машине с достаточной памятью; малоресурсный VPS получает готовый образ. Workflow не подключается по SSH и не развёртывает сайт.

Для ручной сборки используйте проверенный checkout с доступным CDN:

```bash
make docker-build
cp -n deploy/.env.example deploy/.env
```

Перед первым GHCR pull сделайте пакет публичным либо настройте отдельный доступ только на чтение пакета. Права Git сами по себе не дают pull-доступ. В APP_IMAGE укажите `ghcr.io/andrey-krasheninnikov/want-wallpapers@sha256:<verified-digest>` из результата успешной публикации; локальная сборка использует `want-wallpapers:local`. Analytics следует настройкам согласия ADR 0005: defaults включены для новых посетителей вне ЕЭЗ, а ЕЭЗ и unknown требуют явного выбора; сохранённый отказ имеет приоритет. При сборке передавайте публичные PUBLIC_FIREBASE_API_KEY, PUBLIC_FIREBASE_PROJECT_ID, PUBLIC_FIREBASE_APP_ID и PUBLIC_FIREBASE_MEASUREMENT_ID; CI берёт их из repository variables. Без полной публичной конфигурации Analytics выключена. Приватные ключи, DB URL и токены в build args не передаются.

Задайте SECRETS_DIR, ADMIN_USERNAME, TRAEFIK_NETWORK, EGRESS_NETWORK и TRUSTED_PROXY_CIDRS. EGRESS_NETWORK обязательна: укажите имя уже существующей non-internal egress сети из read-only inventory. App подключается к proxy и egress; migrate — только к egress, без alias `wallpapers`. Compose не создаёт сети и не меняет Traefik. Перед обновлением проверьте, что `wallpapers-proxy` имеет Internal=true, egress — Internal=false, и alias принадлежит только действующему app. Не создавайте вторую egress сеть при обновлении. Compose добавляет alias `wallpapers` только сервису app в существующей сети `wallpapers-proxy`; route и origin-сертификат принадлежат установленному Traefik. Docker discovery выключен для app/migrate, labels не создают второй route. Если существующий route использует healthcheck, укажите `/health/ready` вместо прежнего Nginx `/healthz`. Перед переключением остановите прежний контейнер с тем же alias по его существующей инструкции: два контейнера с alias `wallpapers` одновременно создадут неоднозначную маршрутизацию. Данные внешней PostgreSQL не удаляются.

В Cloudflare включите прокси DNS и [SSL/TLS Full (strict)](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/); origin-сертификат должен быть действующим и соответствовать wallpapers.want.foundation. Origin-порты 80/443 разрешают только текущие сети Cloudflare, включая Docker ingress. App не публикует host-порты. Cache Rules должны обходить `/api/*`, `/admin/*` и `/health/*`; приватные ответы, Set-Cookie и Cache-Control: no-store не кешируются. Не включайте Cache Everything для этих путей.

TRUSTED_PROXY_CIDRS содержит фактические адреса доверенных Traefik proxy. Если сохранённый X-Forwarded-For включает Cloudflare, добавьте её актуальные proxy CIDRs, полученные из [официального списка](https://www.cloudflare.com/ips/), чтобы проверка цепочки дошла до IP посетителя. Traefik должен доверять forwarded headers только Cloudflare через [forwardedHeaders.trustedIPs](https://doc.traefik.io/traefik/reference/install-configuration/entrypoints/#forwarded-headers); forwardedHeaders.insecure выключен. Для прямого Traefik без Cloudflare доверяйте только Traefik. Не используйте 0.0.0.0/0 или все private ranges. Встроенная защита проверяет цепочку справа налево при доверенном socket peer и игнорирует поддельный левый префикс. Адрес proxy фиксируйте либо используйте контролируемую изолированную сеть; проверьте её через `docker network inspect <network>`.

Для первоначального provisioning, если сети действительно отсутствуют и эти имена не заняты другими сервисами, оператор создаёт их отдельно:

```bash
docker network create --internal wallpapers-proxy
docker network create wallpapers-egress
```

Во втором случае EGRESS_NETWORK=wallpapers-egress. На существующем VPS используйте фактическое имя сети; пример не доказывает её текущее имя.

Перед обновлением скачайте проверенный образ, пока прежний app работает. `make deploy-config` использует `config --quiet` и не печатает секреты. Получите проверенный backup/restore record, затем остановите только app в согласованное окно обслуживания. `make migrate` отказывается запускаться, пока Compose app работает: на этом VPS app и миграции не должны конкурировать за память. Внешний proxy не останавливайте. Не используйте глобальные down/prune/--remove-orphans.

```bash
make deploy-config
docker compose --env-file deploy/.env -f deploy/compose.yaml pull app migrate
docker compose --env-file deploy/.env -f deploy/compose.yaml stop app
make migrate
```

После миграций примените `deploy/runtime-grants.sql` к БД wallpapers от migrator/DBA, затем `deploy/verify-runtime-grants.sql`. Скрипты поддерживают psql variables `runtime_role` и `migrator_role`; defaults — `wallpapers` и `wallpapers-migrator`, идентификаторы всегда quoted. Новая таблица требует явного grant и обновления allowlist проверки.

Используйте заранее настроенный приватный libpq service `wallpapers-operator` с TLS verify-full/CA и внешним password file, доступным только оператору. Не передавайте URL/пароль в argv, shell history или CI. Service подключается к выделенной wallpapers БД от migrator/DBA:

```bash
psql -X 'service=wallpapers-operator' -v ON_ERROR_STOP=1 -v runtime_role=wallpapers -f deploy/runtime-grants.sql
psql -X 'service=wallpapers-operator' -v ON_ERROR_STOP=1 -v runtime_role=wallpapers -v migrator_role=wallpapers-migrator -f deploy/verify-runtime-grants.sql
```

Проверка read-only: нет superuser/CREATEDB/CREATEROLE/BYPASSRLS, memberships, владения объектами, CREATE/TEMP, grant options, широких stored default ACL и доступа к `_sqlx_migrations`, включая column grants. Runtime имеет CRUD только на явных таблицах приложения; audit — SELECT/INSERT и sequence USAGE/SELECT, без изменения/удаления. Результат общий, без строк приложения и credentials.

Если проверка не проходит, не запускайте новый app. Просмотрите владельцев, memberships, column ACL, глобальные и schema default ACL в защищённой сессии. После review только для выделенной wallpapers БД и остановленного app разрешена процедура `deploy/runtime-hardening.sql`, затем повторное применение grants и verification:

```bash
psql -X 'service=wallpapers-operator' -v ON_ERROR_STOP=1 -v runtime_role=wallpapers -v migrator_role=wallpapers-migrator -f deploy/runtime-hardening.sql
psql -X 'service=wallpapers-operator' -v ON_ERROR_STOP=1 -v runtime_role=wallpapers -f deploy/runtime-grants.sql
psql -X 'service=wallpapers-operator' -v ON_ERROR_STOP=1 -v runtime_role=wallpapers -v migrator_role=wallpapers-migrator -f deploy/verify-runtime-grants.sql
```

Hardening отзывает известные table/sequence ACL у runtime/PUBLIC, CREATE/TEMP этой БД и CREATE public; отдельно очищает global/public defaults только указанного migrator. REVOKE использует RESTRICT: зависимые grants требуют ручного review. Процедура не меняет владельцев, memberships, column ACL, неизвестные объекты/creator roles и другие БД, не запускается автоматически при деплое. Если такие нарушения найдены, подготовьте отдельные точные REVOKE/ALTER после review; не используйте REASSIGN OWNED, DROP OWNED или CASCADE. После любого сбоя оставьте app остановленным до восстановления allowlist и успешной проверки.

```bash
docker compose --env-file deploy/.env -f deploy/compose.yaml up -d --wait app
```

Один сервис app подключён к двум существующим внешним сетям: internal proxy и non-internal egress. Он работает uid 10001 с read-only filesystem, без Linux capabilities, с no-new-privileges, 32 MiB tmpfs, 512 MiB RAM без container swap, 1 CPU, лимитом 64 процессов и local logging (max-size=5m, max-file=3). PostgreSQL подключается через обычный DNS/IP и TLS. Сервис migrate включается только профилем operations, имеет 128 MiB RAM без container swap и 1 CPU, получает только migration_database_url и CA. В его environment нет admin, Google, reCAPTCHA или proxy config. Runtime получает только runtime DB URL и не выполняет миграции сам.

### Бюджет и baseline действующей установки

Для host около 889 MiB: app 512 MiB + отдельно управляемый Traefik 192 MiB оставляют около 185 MiB на OS/Docker и лёгкий мониторинг. Это пределы, не измеренное одновременное потребление. Monitor/CIDR updater запускаются кратковременно; перед операцией проверьте available RAM, swap, disk и текущие нагрузки. Host swap 1 GiB не заменяет бюджет контейнеров. Миграция 128 MiB выполняется при остановленном app; при OOM/ошибке миграции дальнейший запуск запрещён. Backup/restore PostgreSQL 18 выполняется вне VPS по [ADR 0007](adr/0007-off-vps-restore-verification.md); сборки и тяжёлые E2E на VPS не запускаются.

Read-only SSH 5 октября 2026 подтвердил linux/amd64, 1 CPU, 910440 KiB MemTotal (около 889 MiB), swap 1 GiB и активные want-monitor/want-cloudflare-update timers. `/README.md` скачан как recovery snapshot. В notes текущий release — v1.3.0, хотя operational directory остаётся `/opt/want/apps/wallpapers-v1.1.0`. Read-only checkout `/home/krasheninnikov/want-wallpapers-v1.3.0-mjtuffxk` содержит revision `017ce1cc4ea033aedfa1784d0c9cccfd82b7e612`; `/opt/want/repos/want-wallpapers` остаётся более старым checkout и не определяет deployed revision.

Notes указывают platform digest `sha256:9f83237ed9b29fe73813b671fd4bc8ae779d7e21b88c19dc154bf2ea8c4360d5`, CPU 1, RAM 512 MiB, локальную egress patch, роли `wallpapers-migrator`/`wallpapers`, внешний PostgreSQL 18.6/verify-full и успешный ранее Google assessment. Документированный Web key — `6LdJa98tAAAAAA6TZlxW7OPKJ0v1fm6YDMmcvzeh`, project want-wallpapers, score 0.5. Это сведения recovery notes, не свежий Docker/DB readback; обновление не должно заменять текущие значения.

Различия репозитория исправлены: общий CPU 2 снижен до 1, явная egress сеть добавлена, migrate лишён proxy/alias и runtime secrets/environment, grants используют реальные quoted role identifiers. Фактическое имя egress, running image/revision, mounts, владельцы/default ACL и operational Compose требуют привилегированного read-only отчёта: обычный SSH не имеет доступа к Docker и закрытым файлам, sudo требует интерактивной авторизации. До отчёта не переносите Compose поверх operational файлов и не считайте acceptance этого пункта завершённым. Сохраните локальные patch, deploy/.env, root0700 secret directory с файлами UID10001/GID10001 mode0400, Traefik route `/health/ready`, monitor `/usr/local/sbin/want-monitor` и updater.

Перед первым применением сверяйте этот snapshot с `/README.md` и закрытым inventory; сохраните прежний digest/config в root0700 rollback directory. Notes указывают предыдущий record `/var/lib/want-deploy/wallpapers/20261005T041256Z-v130-aholi5md`; путь нужно проверить заново, а не считать постоянным. Не печатайте Compose config, environment dump или полный Docker inspect. Возвращайте только allowlisted resource/network/mount metadata, без содержимого секретов.

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

Перед миграциями сделайте свежий backup внешней БД и проверьте восстановление в изолированной PostgreSQL 18 среде вне VPS по ADR 0007. Pull нового digest выполняется до остановки прежнего app; миграции — только после остановки app и успешного restore record. Посмотрите diff миграций и совместимость предыдущего runtime. Получите проверенный новый digest, выполните migrate с новой версией, выдайте необходимые новые grants, переключите APP_IMAGE и `up -d --wait app`, затем повторите smoke checks. Сохраните предыдущий digest до обновления; rollback возвращает этот digest и повторяет `up -d --wait app`. Rollback контейнера допустим только если схема совместима с прошлой версией; иначе нужен проверенный план восстановления. Автоматическое удаление/откат БД не выполняется.

Каталог: админка/API, `make catalog-pull`, проверки, сборка нового образа, обновление app. Не отдавайте приложению Docker socket для самостоятельного rebuild. Чтобы исключить изменение каталога во время сборки, сохраните согласованный snapshot в release checkout и сравните API readback перед публикацией.

Ротация токена: замените внешний catalog_api_token новым случайным значением ≥32 символов и пересоздайте app (`up -d --force-recreate app`), затем readback с новым токеном и отказ старого. Изменение password hash, username или TOTP seed отзывает старые admin sessions при следующей проверке. Сначала подготовьте новый аутентификатор приватно, затем замените секрет и пересоздайте app. Cookie visitor остаются отдельными.

Ежедневная очистка запускается сразу при старте и далее раз в 24 часа. Закрытые обращения старше года удаляются; открытые сохраняются. Время простоя может задержать удаление до следующего запуска. Следите за сообщением `scheduled cleanup failed`, доступностью БД, диском и трафиком PNG. Audit хранит только тип действия, ID цели, роль и время; отдельного автоматического удаления audit/social данных нет.
