# Деплой на VPS: Docker, Traefik, внешний PostgreSQL 18

Сайт: `https://wallpapers.want.foundation/`. Развёртывание выполняется оператором отдельно от Git release. В production нет контейнера PostgreSQL и Docker socket приложения. Нужны DNS домена на VPS, уже работающий Traefik с HTTPS entrypoint/resolver, его внешняя Docker network и внешний PostgreSQL 18 с сертификатом, соответствующим DNS/IP соединения. Укажите точные значения вашей установки, а не пример subnet.

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

Вне checkout подготовьте новую директорию, например `/etc/want-wallpapers/secrets` с режимом 0700. На доверенной машине с Bun выполните:

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

Не сохраняйте секреты в Git, Docker build args, образе или frontend. Файлы: database_url, migration_database_url, admin_password_hash, admin_totp_secret, catalog_api_token, postgres_ca.pem. Каталожный токен разрешает только каталог, без модерации/обращений/сессий.

## 3. Образ и Traefik

Соберите из проверенного release checkout при доступном CDN. Backend и frontend входят в один образ. Analytics public settings передаются только при сборке; без measurement ID она выключена.

```bash
docker build -t want-wallpapers:<release> .
cp deploy/.env.example deploy/.env
```

Задайте APP_IMAGE с точным тегом или digest, SECRETS_DIR, ADMIN_USERNAME, TRAEFIK_NETWORK, TRAEFIK_ENTRYPOINT, TRAEFIK_CERT_RESOLVER и TRUSTED_PROXY_CIDRS. Последний содержит только фактические адреса доверенных Traefik proxy; не используйте 0.0.0.0/0. Проверьте subnet через `docker network inspect <network>` и фиксируйте адрес proxy либо контролируемую изолированную сеть. Внешние клиенты не должны иметь прямого доступа к app :8080. Traefik должен заменять недоверенный X-Forwarded-For; не включайте forwardedHeaders.insecure. Встроенная защита рассматривает цепочку справа налево только при доверенном socket peer.

```bash
make deploy-config
make migrate
```

После миграций примените `deploy/runtime-grants.sql` к БД wallpapers от migrator/DBA. App не должен владеть схемой, таблицами или иметь CREATE. Не выдавайте app права на `_sqlx_migrations`. Новая миграция с новыми таблицами требует соответствующего явного grant.

```bash
docker compose --env-file deploy/.env -f deploy/compose.yaml up -d app
```

Один сервис app подключён к существующей внешней network. Он работает uid 10001 с read-only filesystem, без Linux capabilities, с no-new-privileges, 32 MiB tmpfs, ограничениями RAM/CPU. PostgreSQL подключается через обычный DNS/IP и TLS. Сервис migrate включается только профилем operations и не получает Traefik route. Runtime не выполняет миграции сам.

## 4. Проверка после запуска

Проверьте свежим readback:

```bash
curl --fail https://wallpapers.want.foundation/health/ready
curl --fail https://wallpapers.want.foundation/api/v1/catalog
curl --head https://wallpapers.want.foundation/admin/login/
curl --fail https://wallpapers.want.foundation/sitemap-index.xml
```

Проверьте реальные HTTPS, certificate chain, noindex у admin, отсутствие admin/API в sitemap, новый домен в canonical/hreflang/OG/schema, четыре языка, изображения, обе загрузки и regional fallback. В `/admin/login/` войдите паролем/TOTP, проверьте редактирование переводов, архив/restore, комментарии, жалобы и обращения. Logout должен отзывать cookie. Каталожный токен должен получать 403 на moderation; проверяйте токен с защищённым config/header file, не через буквальный аргумент CLI. Сохраните результаты без секретов и персональных сообщений. Local/CI checks не подтверждают production.

## 5. Обновления и rollback

Перед миграциями сделайте backup внешней БД и проверьте восстановление в отдельной среде. Посмотрите diff миграций и совместимость предыдущего runtime. Соберите образ с новым неизменяемым тегом, выполните migrate с новой версией, выдайте необходимые новые grants, переключите APP_IMAGE и `up -d app`, затем повторите smoke checks. Rollback контейнера допустим только если схема совместима с прошлой версией; иначе нужен проверенный план восстановления. Автоматическое удаление/откат БД не выполняется.

Каталог: админка/API, `make catalog-pull`, проверки, сборка нового образа, обновление app. Не отдавайте приложению Docker socket для самостоятельного rebuild. Чтобы исключить изменение каталога во время сборки, сохраните согласованный snapshot в release checkout и сравните API readback перед публикацией.

Ротация токена: замените внешний catalog_api_token новым случайным значением ≥32 символов и пересоздайте app (`up -d --force-recreate app`), затем readback с новым токеном и отказ старого. Изменение password hash, username или TOTP seed отзывает старые admin sessions при следующей проверке. Сначала подготовьте новый аутентификатор приватно, затем замените секрет и пересоздайте app. Cookie visitor остаются отдельными.

Ежедневная очистка запускается сразу при старте и далее раз в 24 часа. Закрытые обращения старше года удаляются; открытые сохраняются. Время простоя может задержать удаление до следующего запуска. Следите за сообщением `scheduled cleanup failed`, доступностью БД, диском и трафиком PNG. Audit хранит только тип действия, ID цели, роль и время; отдельного автоматического удаления audit/social данных нет.
