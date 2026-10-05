# Локальный n8n на MacBook

n8n работает отдельно от сайта и VPS: Docker Desktop на MacBook, SQLite и постоянный Docker volume. Контейнер слушает только `127.0.0.1:5678`. Публичные webhooks, туннели, Traefik и входящие provider callbacks не используются. Автоматизация обращается к GitHub, API каталога и будущим каналам публикации через исходящие запросы и polling. Настройка этих рабочих workflows относится к отдельным задачам, включая журнал анонсов в #30.

## Запуск и вход

Нужны работающий Docker Desktop с Compose v2 и Python 3. Проверено на macOS arm64 с Docker 29.1.3 / Compose 2.40.3. Образ закреплён версией `2.41.7` и multi-platform digest в `automation/n8n/compose.yaml`; `latest` не используется. Образ поддерживает arm64/amd64. Из корня checkout:

```bash
make n8n-config
make n8n-up
make n8n-status
curl --fail http://127.0.0.1:5678/healthz/readiness
```

Откройте `http://localhost:5678`, создайте owner account приватно в локальном UI и сохраните пароль в password manager. Реальные credentials GitHub, каталога и каналов вводите только в разделе Credentials этого UI. Не отправляйте их в чат, issue, Git, workflow JSON, shell arguments или отчёты. В workflow храните только ссылку на credential. Не экспортируйте расшифрованные credentials. Минимальные права каждого provider token выбираются при подключении соответствующего workflow.

HTTP и `N8N_SECURE_COOKIE=false` допустимы здесь только благодаря loopback binding. Не меняйте bind на `0.0.0.0` и не открывайте Docker port через прокси. Непривилегированный пользователь контейнера — uid/gid 1000; Docker socket и host directories ему не передаются. Community packages и доступ Code node к environment выключены. Диагностика и персонализация выключены. Healthcheck проверяет readiness, включая БД; статус `healthy` не доказывает подключение реальных providers.

`restart: unless-stopped` возобновляет контейнер после старта Docker Desktop. Включите запуск Docker Desktop при входе в macOS в его настройках. Пока MacBook спит/выключен или Docker остановлен, workflows не выполняются; это не круглосуточный сервис. Если контейнер остановлен через `make n8n-stop`, запустите его явно через `make n8n-up`.

## Данные и catch-up

Volume `want-wallpapers-n8n-data` монтируется в `/home/node/.n8n`. Он содержит SQLite, настройки с автоматически созданным случайным encryption key и остальные локальные данные. Настройки имеют 0600. Не задавайте другой `N8N_ENCRYPTION_KEY`: сохранённые credentials требуют исходного ключа. Не публикуйте `docker inspect`, содержимое volume или архивы. Не используйте `down --volumes`, `volume rm` или `system prune --volumes` для этой установки.

Выполнения сохраняются по ходу работы. Wait длительностью не меньше 65 секунд сохраняет ожидание в БД; после возвращения n8n просроченное ожидание может продолжиться. Короткий Wait держится в памяти и не является долговременной контрольной точкой. История выполнений автоматически очищается через 336 часов либо при превышении 10 000 записей. Поэтому история выполнений не подходит для постоянного журнала анонсов.

Храните checkpoint polling и журнал завершённых/неопределённых публикаций в Data Tables. Эти строки живут в той же БД и не зависят от очистки execution history. Используйте устойчивые идентификаторы источника/канала и upsert, сохраняйте checkpoint после подтверждённого результата. После старта делайте новый polling с последнего checkpoint и сверяйте уже выполненные действия. Schedule Trigger не воспроизводит каждый пропущенный запуск; saved Wait не делает внешний POST атомарным с SQLite. После неоднозначного сетевого сбоя сначала сверяйте состояние провайдера. В закреплённом upstream есть ограничение старта: tracker запускает просроченный Wait до инициализации module context, поэтому Data Table node прямо в этом continuation может завершиться ошибкой «module is disabled». Используйте свежий polling execution с сохранённого checkpoint для операций журнала, а не Data Table node сразу после просроченного Wait. [Порядок startup в закреплённой версии](https://github.com/n8n-io/n8n/blob/n8n%402.41.7/packages/cli/src/commands/start.ts#L288). Точная схема и дедупликация анонсов реализуются в #30; здесь подготовлено и проверяется их долговременное хранилище.

## Backup

```bash
make n8n-backup
```

Команда проверяет выбранный volume, отказывается копировать его при другом работающем контейнере, останавливает n8n, копирует всю `.n8n`, проверяет gzip/tar, SQLite header и наличие исходного ключа, затем возобновляет ранее работающий сервис. Уже остановленный сервис остаётся остановленным. Остановка имеет 90 секунд grace period; делайте snapshot при отсутствии активной внешней публикации. Это snapshot согласованного локального состояния, а не гарантия результата незавершённого запроса провайдеру.

Архив создаётся вне всех Git checkouts: `~/.local/share/want-wallpapers/n8n/backups/n8n-<UTC>-<suffix>.tar.gz`, directory 0700, archive 0600. Вывод содержит только путь. Архив включает credentials и ключ их расшифровки: это приватный **незашифрованный** backup. Защиту диска и безопасное внешнее копирование обеспечивает владелец. FileVault этой инструкцией не включается и не подтверждается. Не добавляйте backup в Git или публичное облако.

При ошибке проверьте `make n8n-status` и приватную директорию: archive может уже существовать, даже если возобновление контейнера не удалось. Запустите `make n8n-up` после устранения причины. Файл `.partial` не считается готовым backup. Не удаляйте исходный volume и не повторяйте restore поверх него. Вместе с архивом сохраните вне checkout commit этой инструкции и закреплённый image digest. Retention и внешняя копия выполняются владельцем; автоматического удаления архивов нет.

## Recovery без перезаписи

Сначала восстановите архив в новый, ранее не существовавший volume. Имя обязано начинаться с `want-wallpapers-n8n-`. Пример:

```bash
make n8n-restore ARCHIVE=/absolute/private/path/n8n-snapshot.tar.gz VOLUME=want-wallpapers-n8n-recovery-20261005
```

Команда проверяет приватные права, целостность, безопасные tar paths, uid/gid 1000, БД и ключ **до** создания volume. Существующий volume никогда не заменяется. При ошибке копирования новый volume может остаться неполным; не используйте его и повторите с другим новым именем. Исходный архив и рабочий volume сохраняются. Восстанавливайте на закреплённой версии образа, которой создан backup; не открывайте старую БД новой версией до согласованного обновления.

Перед первым запуском restored instance остановите исходную: активные Schedule/Wait могут выполнить внешние действия. Для проверки после аварии при ещё работающем оригинале используйте отдельную среду с ограниченным исходящим доступом и не запускайте рабочие активные workflows параллельно. Выберите восстановленный volume только для одной команды, не помещая секреты в environment:

```bash
make n8n-stop
N8N_DATA_VOLUME=want-wallpapers-n8n-recovery-20261005 make n8n-up
N8N_DATA_VOLUME=want-wallpapers-n8n-recovery-20261005 make n8n-status
```

Проверьте в локальном UI workflows, journal/checkpoints, executions и авторизованную безопасную операцию чтения provider credential. Для последующих команд сохраняйте выбранное **несекретное** имя volume в локальной конфигурации shell. Чтобы вернуться к исходному volume, остановите restored instance с тем же `N8N_DATA_VOLUME`, уберите override и выполните `make n8n-up`. Не удаляйте ни один volume до подтверждённого восстановления и отдельного решения владельца.

## Проверка восстановления

```bash
make test-n8n
```

Сценарий создаёт отдельный Compose project, случайный loopback port и два новых volume. Через n8n CLI импортирует и публикует явно синтетические workflows/HTTP credential; Data Table и Wait 90 секунд выполняются временными loopback endpoints изолированного экземпляра. CLI execute не загружает модуль Data Tables в закреплённой версии. Останавливает экземпляр до deadline, создаёт snapshot и восстанавливает новый volume. После deadline проверяет продолжение Wait ровно один раз через локальный HTTP stub и сохранение строк журнала отдельным свежим workflow: сначала в оригинале, затем в восстановленном экземпляре. Отдельный HTTP workflow подтверждает расшифровку восстановленного credential. Проверка не выполняет Data Table node в startup-continuation просроченного Wait из-за ограничения upstream выше. Реальные credentials и provider APIs не используются; внешних публикаций нет. Тест останавливает свой контейнер и сохраняет volumes, имена выводит в результате. Их удаление не автоматизировано.

`make test-ci` включает быстрые контрактные проверки backup/restore с подменой Docker CLI. `make test-n8n` требует Docker Desktop и занимает несколько минут; быстрый набор тестов его не запускает.

## Обновление

Сначала сделайте backup и проверьте recovery. Выберите поддерживаемый stable release, сверяйте multi-platform digest официального образа, совместимость SQLite и release notes. Меняйте version и digest вместе в Compose, выполняйте `make n8n-config`, `make n8n-up`, readiness и `make test-n8n`. Не используйте floating tags. Если новая версия мигрировала БД, rollback образа может быть несовместим: восстановите **backup до обновления** в новый volume с прежним образом. Не заменяйте ключ и не перезаписывайте исходный volume.

Источники: [закреплённый release](https://github.com/n8n-io/n8n/releases/tag/n8n%402.41.7), [encryption key](https://docs.n8n.io/deploy/host-n8n/configure-n8n/basic-configuration/configuration-examples/set-a-custom-encryption-key.md), [execution settings](https://docs.n8n.io/deploy/host-n8n/configure-n8n/basic-configuration/use-environment-variables/executions.md), [Wait](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.wait.md), [Data Tables](https://github.com/n8n-io/n8n-docs/blob/main/docs/build/work-with-data/data-tables.md).
