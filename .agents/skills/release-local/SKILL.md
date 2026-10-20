---
name: release-local
description: Выпускать Want Wallpapers с MacBook без GitHub Actions из origin/development и явной версии через release PR, protected tag, локальные проверки и GHCR, restricted deployment, обратный merge и GitHub Release.
---

# Локальный выпуск с MacBook

Для `andrey-krasheninnikov/want-wallpapers` выполните [общую процедуру release-feature](../release-feature/SKILL.md) с `execution=local`. Требуются явная версия `MAJOR.MINOR.PATCH` и разрешение на выпуск. Профиль по умолчанию `full`; `fast` выбирается только явно и пропускает только Full UI/E2E. Запрос изменить или проверить skill не разрешает выпуск.

## До выпуска

Прочитайте [локальный контракт](../../../docs/ci-releases.md#локальный-выпуск-с-macbook) и [установку и recovery](../../../docs/production-deployments.md#локальный-validator). Сверьте чистый checkout, точные development/main refs, версии, существующие release PR, protected tag и GitHub Release. Продолжайте уже начатую версию, не создавая следующий инкремент.

На Mac должны быть Docker Desktop, Bun 1.3.14, Rust 1.93.0, cargo-audit 0.22.2, ffmpeg, OpenSSH, age, AWS CLI и gh с доступом к репозиторию и GHCR. Для full заранее установите Chromium из зафиксированной версии Playwright по локальному контракту. Проверьте выбранный Docker context, место и ресурсы до сборок и после очистки. Не меняйте context или настройки Docker автоматически.

Приватная конфигурация находится вне checkout: `~/.config/want-wallpapers/local-release/config.json`. Отдельный Ed25519 release key загружен владельцем в ssh-agent. Для подписи передаётся только `.pub`; private key, пароли и tokens не входят в argv, Git, PR, artifacts или образ. На VPS заранее установлен совместимый validator и закреплён публичный ключ. Обычный выпуск не обновляет validator через owner SSH.

## Проверки и публикация

На опубликованном release-кандидате выполните:

```sh
make release-local-check TAG=v<version> PROFILE=<full-or-fast>
```

После обычного merge в main и публикации immutable annotated tag подготовьте чистый checkout этого tag и выполните:

```sh
make release-local TAG=v<version> PROFILE=<full-or-fast>
```

Первая команда выполняет Install, Static, Unit/API, Audit, Collection drafts и, для full, Full UI. Вторая переиспользует эти результаты только при неизменных source tree, инструментах и build configuration, собирает arm64 и amd64, проверяет обе runtime платформы и публикует те же images без rebuild. Arm64 на текущем Mac нативный, amd64 эмулируется. Не называйте эмуляцию нативной проверкой.

Сохраните подписанный v3 record, source SHA, профиль, skipped checks, оба config/platform digests и итоговый index digest. Проверьте anonymous registry readback и серверный допуск. Эта публикация ещё не подтверждает deployment.

## Deployment и завершение

```sh
make deploy-local TAG=v<version> PROFILE=<original-profile>
```

Команда использует исходный digest, restricted SSH и pinned known_hosts. Она переиспользует готовый backup worker либо запускает собственный, ждёт результата и завершает только собственный процесс после обработки. Backup, off-VPS restore PostgreSQL 18, grants/migrations, readiness, шесть языков, private cache controls и compatible-only rollback сохраняются.

После подтверждённого deployment завершите общую процедуру: main обратно в development, GitHub Release и cleanup disposable remote branches. Не запускайте Actions ни на одном этапе. Обязательные merge protections не обходите; несовместимый gate требует остановки.

## Продолжение

`make release-local-status TAG=v<version>` показывает приватное состояние. После обрыва сначала прочитайте remote refs и deployment status. Повтор `deploy-local` использует сохранённый digest и reconciliation существующего запроса, без повторных migrations или rebuild. Терминальные failed/rolled-back/recovery-required и неизвестный status останавливают продолжение; новый deployment требует отдельного решения. При ошибке проверки исправьте причину до продолжения. Изменившиеся входные данные не дают переиспользовать старые результаты; опубликованное намерение не переписывайте.

Не используйте owner alias, общий sudo, root SSH, сборку на VPS, down-migrations, восстановление поверх production, глобальный down/prune или restart Docker/Traefik. Не отключайте CAPTCHA. В результате разделите локальные проверки, registry readback и подтверждённый VPS deployment; отдельно перечислите пропуски fast, cleanup и непроверенные реальные login/CAPTCHA.
