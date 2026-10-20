# Production deployment и backup

Protected release tag задаёт commit и image digest. GitHub Actions проверяет release evidence и обращается к root-owned механизму. Operational directory сохраняется `/opt/want/apps/wallpapers-v1.1.0`; Traefik, monitoring, CIDR updater и другие приложения обслуживаются отдельно.

## Первоначальная установка

CI account `wallpapers-deploy` принимает только `deploy <tag> <sourceSha> <indexDigest>` и `deploy-status <requestId>`. Для reconciliation потерянного ответа есть readonly `deploy-status <tag> <sourceSha> <indexDigest>`. Worker account `wallpapers-backup` принимает `backup-next` и `backup-result <requestId>` с JSON через stdin, максимум 16 KiB и 10 секунд. Чтение payload не блокирует status и переходы deployment. Повтор идентичного принятого receipt возвращает сохранённый acknowledgement; другой payload и новый запрос со старым receipt отклоняются.

Accounts имеют разные Ed25519 keys, forced command, root-owned authorized keys и недоступный для записи home. Для каждой учётки отдельный Match User задаёт AllowUsers только с её именем, чтобы существующий глобальный список не блокировал CI/worker. Глобальные правила остальных пользователей сохраняются. Shell, PTY, forwarding, user rc, SCP/SFTP, Docker-group и общий sudo отсутствуют. Sudo разрешает только фиксированный launcher с проверкой account/команды. CI не загружает исполняемые scripts на VPS; обновление механизма требует установки проверенного commit оператором.

Создайте keys в приватном каталоге вне checkout. Private keys имеют mode 0600 и не попадают в чат, issues, argv или Git. CI восстанавливает завершающий newline перед записью SSH key: GitHub CLI удаляет его при provisioning через stdin. В чистом checkout проверенного опубликованного commit оператор выполняет:

Для подготовки Mac используйте `python3 scripts/setup-production-owner.py --postgres-host <verified-host> --postgres-ca <private-path-to-same-CA>` в собственном терминале. Helper вводит backup/S3 credentials скрыто, создаёт keys и worker files вне checkout и настраивает GitHub environment. Уже существующие environment protections и AWS profiles сохраняются; несовместимые environment settings требуют review. После этого передайте на VPS только `production-ci.pub` и `backup-ssh.pub` из приватного worker directory.

```sh
sudo python3 scripts/install-deployment.py \
  --source <exact-reviewed-commit> \
  --ci-key /absolute/private/path/production-ci.pub \
  --worker-key /absolute/private/path/backup-worker.pub
```

Installer читает файлы указанного commit, устанавливает их в `/usr/local/lib/wallpapers-deploy`, проверяет sudoers/effective sshd configuration и reload только SSH. App, БД и proxy не перезапускаются. Operational `.env` и Compose сохраняются побайтно и получают root ownership. Migration-only override задаёт egress network, лимит памяти 128 MiB и только migrator URL/CA; runtime environment и admin secrets в migrate не входят. Требуются Docker Compose с `!override` и `psql`.

Приватно создайте PostgreSQL login `wallpapers-backup`: без superuser, role/database creation, replication, bypass RLS и memberships. В базе `wallpapers` выполните `deploy/backup-owner-grants.sql` от фактического database/schema owner (`wallpapers-admin`, public принадлежит `pg_database_owner`), затем `deploy/backup-table-grants.sql` от `wallpapers-migrator`. Backup получает SELECT нужных таблиц/sequence; runtime grants не расширяются. Schema owner предоставляет migrator CREATE public для one-off DDL. Новые таблицы требуют review и обновления grant files. Deployment не хранит administrator password и не исправляет неизвестные ACL автоматически.

## Worker на Mac и S3

Worker запускается вручную перед релизом через исходящий SSH. Нужны включённый Mac, Docker Desktop, `age` и AWS CLI. PostgreSQL 18 client/restore используют закреплённый image; локальный PostgreSQL 17 не используется.

Скопируйте `deploy/backup-worker.example.json` в `~/.config/want-wallpapers/backup-worker/config.json`. Каталог имеет mode 0700, configuration/credentials/CA/keys имеют mode 0600 или 0400 и принадлежат пользователю. Заполните пути и public age recipient; private identity в JSON не входит.

`pg_service.conf` содержит только:

```ini
[wallpapers-backup]
host=<verified-production-postgresql-host>
port=5432
dbname=wallpapers
user=wallpapers-backup
sslmode=verify-full
sslrootcert=/run/secrets/postgres_ca
connect_timeout=10
```

Password находится в отдельном приватном `pgpass`, настроенном владельцем. Service file не содержит password. Используйте ту же CA, что на VPS, и проверьте PostgreSQL access с Mac. Secret files монтируются readonly только в client containers; credential values не передаются через argv.

`ssh_config` содержит alias `wallpapers-backup`, production host, port 14444, user `wallpapers-backup`, отдельный IdentityFile, `IdentitiesOnly yes`, `StrictHostKeyChecking yes` и проверенный UserKnownHostsFile. Host key берётся из ранее проверенного подключения; deployment-time ssh-keyscan запрещён.

Создайте отдельного Timeweb S3 пользователя с read/write для `want-foundation`, без управления bucket, и приватный AWS profile `timeweb-wallpapers-backup`. `timeweb-admin` используется только для policy provisioning; worker его отклоняет. Worker обращается только к generated keys собственного prefix. Timeweb предоставляет bucket-level права: read/write credentials могут обращаться и к другим объектам bucket. Private Mac и credentials входят в доверенную границу; отдельный bucket нужен для изоляции credential permissions по namespace.

```sh
python3 scripts/provision-backup-prefix.py
python3 scripts/provision-backup-prefix.py --apply
python3 scripts/backup-worker.py serve --config ~/.config/want-wallpapers/backup-worker/config.json
```

Первая команда показывает policy. Вторая сохраняет существующие exceptions, включая `axentra/*`, добавляет `wallpapers-backups/*`, проверяет readback и отказ anonymous GET/HEAD на синтетическом объекте. Общий bucket ACL/листинг не меняется. Object names содержат случайные IDs, без пользовательских данных. Backups имеют private object ACL и шифруются до загрузки. При неподтверждённой privacy проверке реальные backups не загружать.

Перед работой worker требует исходное public-read правило с исключением `wallpapers-backups/*`. Допускается только дополнительное правило `PrizmaxisPublicProductionMedia` с `s3:GetObject`, публичным principal и точным Resource `arn:aws:s3:::want-foundation/prizmaxis/production/media/*`. Дополнительные Deny statements допускаются: они ограничивают доступ и не расширяют разрешения. Расширенные или неизвестные Allow statements блокируют запуск. Worker читает policy и не меняет её.

Worker получает consistent snapshot, делает dump, шифрует `age`, загружает ciphertext с запретом overwrite, скачивает объект и сверяет checksum с приватным локальным ledger. Затем decrypt/restore выполняется в новом PostgreSQL 18 container без сети, host ports и постоянного volume. Проверяются schema, migration history и catalogue. Fingerprint использует локальный search_path pg_catalog и текстовый порядок COLLATE "C", поэтому настройки source/restore БД не меняют результат. Только после этого VPS получает deployment-bound receipt. Production restore/down-migrations не выполняются.

Worker ожидается максимум 30 минут; после восстановления proof действителен 5 минут. Worker unavailable, dump/encryption/upload/download/restore failure, mismatch или stale receipt сохраняют работающий app. Backups остаются минимум 30 дней. При запуске worker удаляет старые ciphertext objects только собственного prefix; выключенный Mac откладывает cleanup. Сохраните recovery-копию age identity отдельно, например в приватном password manager. Без identity encrypted backups невосстановимы.

## GitHub environment и release

Создайте environment `production`, разрешающий tags `v*`; branches не должны получать environment. Tag ruleset остаётся immutable без bypass. Variables: `PRODUCTION_SSH_HOST`, `PRODUCTION_SSH_PORT=14444`, `PRODUCTION_SSH_USER=wallpapers-deploy`, `PRODUCTION_SSH_KNOWN_HOSTS` с заранее проверенной host-key записью. Secret `PRODUCTION_SSH_PRIVATE_KEY` доступен только deploy step. Database URLs, Google JSON, password hash, TOTP и catalog token остаются на VPS; backup login/S3/encryption credentials находятся на Mac, вне GitHub.

Protected annotated tag сам ничего не запускает. Вручную выберите этот tag как workflow ref и передайте тот же tag в `Production deployment`. Один запуск выполняет verification, publication, один reusable eligibility и deployment. Production environment допускает только tags `v*`; resolver дополнительно проверяет действующую immutable protection и main ancestry. Concurrency не отменяет активную production job; серверный lock сохраняет сериализацию при отключении SSH.

Перед первым запуском нового release contract установите проверенный опубликованный commit через `install-deployment.py` тем же operator-only способом и с существующими public keys. На VPS нужен чистый Git checkout этого точного SHA, не operational directory без `.git`. Installer читает committed files, обновляет root-owned validator и policy, проверяет restricted SSH и сохраняет application/database/proxy и operational configuration. Сверьте checksum установленных файлов с выбранным commit. Не выдавайте CI общий SSH/sudo и не передавайте ему право обновлять validator.

Validator поддерживает full/fast records v2 единой manual chain и прежние полностью проверенные v1 records. Fast пропускает только Full UI; static/unit/API, audit, drafts, обе runtime платформы и все server/backup gates обязательны. Backup и off-VPS restore могут оставаться самым долгим этапом. Старый validator не принимает новый contract; обновите его до запуска нового релиза. Для восстановления используйте исходный immutable digest и совместимый validator. Не понижайте validator до версии без поддержки evidence активного релиза.

Manual retry передаёт исходный digest и профиль. Branch ref, другой source/digest, fork или неуспешный обязательный job блокируют deployment. Повтор успешного текущего release проверяет running image/health; новый release получает новую backup identity. Более новая публикация того же commit не подменяет исходный deployment intent.

## Состояния, recovery и проверки

Порядок: requested, preflight, pulling, backup-pending, app-stopped, migrating, starting, verifying, complete. Private records находятся в `/var/lib/want-deploy/wallpapers/requests`. Snapshots сохраняют previous immutable image и operational config. Public artifact содержит только allowlisted tag/SHA/digest/request/platform/verification/status metadata.

До остановки app проверяются root-owned profile, resources/networks/secret mounts, PostgreSQL 18/TLS, grants, quiet Compose, image и backup proof. Runtime connection должен использовать `wallpapers`, migrator connection — `wallpapers-migrator`; оба подключаются к одной базе с одной CA. Фактические роли и server/database identity проверяются read-only, затем повторно после backup. До collection-publication миграции preflight допускает отсутствие её функции; применённая миграция требует наличия функции и права EXECUTE. Затем выполняются one-off migrate с migrator secrets, явные runtime grants, strict verification и запуск app. Proxy/monitoring/другие services сохраняются. Public smoke ожидает readiness до 90 секунд с интервалом 3 секунды, затем проверяет catalogue, четыре языка, static assets и private cache controls.

Ошибки до остановки дают failed и оставляют app. После остановки rollback допустим только при одинаковых schema fingerprint/migration history и successful strict privileges. Возвращается previous image/config; database data сохраняются. Изменение schema/history, неопределённый результат или неуспешный rollback даёт recovery-required и требует оператора. Не восстанавливайте поверх production, не удаляйте database, не выполняйте down/prune/remove-orphans или restart Docker/Traefik.

После потерянного SSH response сначала запросите status. Systemd операция продолжает работать; service interruption отражается в durable record. Failed/rolled-back/recovery-required завершают CI ошибкой. При recovery-required оператор проверяет живую БД/history/grants и согласованный forward recovery; автоматического override нет.

Первый deployment проходит под наблюдением владельца. Настоящие CAPTCHA assessment, password/TOTP login и logout проверяются приватно отдельно. HTTP smoke/synthetic tests этого не подтверждают. После успеха record и `/README.md` обновляются, сохраняя историю.

`make test-ci` проверяет commands, events, digest/platform matching, lock contention, receipts и failure/recovery transitions на controlled external responses. `make test-backup` реально выполняет PostgreSQL 18 dump/encryption/restore synthetic data и отклоняет повреждённый ciphertext. `make test` включает оба набора. Local tests, actual CI, S3 privacy proof, production restore proof и deployment acceptance фиксируются отдельно.

## Локальный validator

Локальная запись v3 подписывается отдельным Ed25519 release key через ssh-agent. Private key остаётся на Mac. В `/etc/want-wallpapers/release-signers` root закрепляет public key, principal `wallpapers-release` и namespace `want-wallpapers-release-v1`. SSH deployment key и backup key остаются отдельными. Для отзыва локального выпуска удалите соответствующий signer контролируемым обновлением; не меняйте защиту tags и не принимайте unsigned evidence.

Установка выполняется владельцем из чистого Git checkout точного проверенного и опубликованного commit. Не используйте operational directory как предположительно актуальный checkout. Передайте на VPS только release-signing.pub. На существующей установке выполните:

```sh
sudo python3 scripts/install-deployment.py \
  --source <exact-reviewed-published-commit> \
  --update-only \
  --release-key /absolute/path/to/release-signing.pub
```

Этот режим не меняет SSH accounts, sudoers, authorized_keys, operational .env/Compose и не перезапускает приложение, Docker или Traefik. Он удерживает серверные locks, отказывает при running/recovery-required requests, сохраняет прежние файлы и trust в закрытом `installations/<id>`, устанавливает фиксированный набор файлов и сверяет bytes, Python syntax, signer и неизменность app identity. Ошибка возвращает прежние файлы. Существующие v1/v2 records продолжают использовать Actions verification; v3 требует локальную подпись и не обращается к Actions API.

После установки сверьте hashes с выбранным commit, root ownership и отсутствие group/world write. Read-only resolver проверяет текущий релиз и тестовую локальную публикацию:

```sh
sudo python3 /usr/local/lib/wallpapers-deploy/scripts/ci-release.py resolve \
  --tag <existing-protected-tag> --digest <exact-index-digest> --timeout 0
```

Для публичных GitHub/GHCR API задайте `WANT_RELEASE_PUBLIC_API=1` только этому read-only процессу. Это не deployment request и не выполняет backup, migrations или переключение app. Для проверки restricted SSH используйте только deploy-status существующего request ID. Не отправляйте deploy с тестовым digest.

Для ручного возврата validator остановитесь при активном deployment, удерживайте те же locks и используйте `manifest.json` из конкретного snapshot. Сверьте hashes сохранённых файлов, восстановите только указанные fixed installation paths и прежние modes; файлы с existed=false удаляются только после проверки их принадлежности этой установке. Operational configuration и БД не входят в этот rollback. После возврата повторите read-only resolver текущего production digest и restricted status. Не понижайте validator ниже версии, необходимой активному приложению/release record.

Новая локальная application release требует отдельного явного запуска `$release-local`. Установка validator и подписи сама такой выпуск не выполняет. Реальные password/TOTP/CAPTCHA проверки остаются отдельной приватной приёмкой владельца.
