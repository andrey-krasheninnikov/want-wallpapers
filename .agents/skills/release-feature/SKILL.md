---
name: release-feature
description: Выпускать фичи Want Wallpapers по Gitflow через squash PR в development, release PR в main, защищённый тег и обратный semantic merge. Использовать при запросе конкретного релиза; деплой Docker/Traefik выполняется отдельно.
---

# Релиз фичи Want Wallpapers

Используйте этот порядок для репозитория `andrey-krasheninnikov/want-wallpapers`. Получите из запроса исходную feature-ветку и версию `MAJOR.MINOR.PATCH`. Публикация веток, PR, правил защиты, тега и GitHub Release требует разрешения на конкретный выпуск. Само наличие skill такого разрешения не даёт.

## Подготовка

- Прочитайте применимые `AGENTS.md` и README. Используйте `$git-workflow-and-versioning`; для обычных коммитов и их публикации — `$delivery-commit-publish`.
- Проверьте чистый checkout, текущую ветку, upstream, remotes, divergence, worktrees и отсутствие активной Git-операции. Не прячьте и не удаляйте чужие изменения.
- Выполните `git fetch --all --prune`. При отставании от upstream разрешён только fast-forward. При divergence остановитесь.
- Через `git ls-remote` зафиксируйте точные SHA feature, development и main. Проверьте существующие PR, release-ветку, тег и GitHub Release, чтобы не создавать дубликаты.
- Перед каждым merge повторно проверьте исходный и целевой SHA. Изменившийся ref требует повторной проверки кандидата; не перезаписывайте новые коммиты.

## 1. Feature в development

1. Опубликуйте все согласованные изменения feature-ветки и подтвердите серверный HEAD.
2. Выполните `make check` и `make test`.
3. Создайте PR из feature-ветки в `development` с описанием результата и проверок. Перед публикацией проверьте текст и метаданные; сохраните нейтральное авторство.
4. Выполните squash merge с явным Conventional Commit сообщением и `--match-head-commit` для проверенного HEAD. Не используйте admin bypass.
5. Прочитайте результат PR и обновите refs. У squash-коммита должен быть один родитель — проверенный прежний HEAD development. Его дерево должно сохранять согласованные изменения обеих веток.

## 2. Release-ветка и main

1. Создайте `release/vMAJOR.MINOR.PATCH` от подтверждённого `origin/development` и опубликуйте её с собственным upstream.
2. Отдельным release-коммитом синхронизируйте версию корневого `package.json`, workspace version в `Cargo.toml` и пакета в `Cargo.lock` с будущим тегом и добавьте запись в `CHANGELOG.md`. Укажите фактическую дату выпуска, пользу для посетителей и известные ограничения.
3. На кандидате выполните make check, make test и git diff --check: static/type/format, unit и bounded API на PostgreSQL 18. Полный audit/UI/native runtime gate выполняет main после merge.
4. Создайте PR release-ветки в `main`. Используйте обычный merge без squash и rebase, с `--match-head-commit` проверенного release HEAD.
5. После merge подтвердите два родителя: проверенный прежний main и проверенный release HEAD. Зафиксируйте итоговый SHA main.

## 3. Защищённый тег

- До публикации тега прочитайте [контракт release gate](../../../docs/ci-releases.md). Сверьте `.github/release-policy.json` с текущим ruleset; обновлённые правила требуют полного readback без bypass и отдельного проверенного изменения policy. Проверьте или создайте активный tag ruleset `Protect release tags` для `refs/tags/v*`: запрет обновления и удаления, без bypass actors. Создание новых тегов разрешено. Прочитайте сохранённое правило через GitHub API.
- Создайте annotated тег `vMAJOR.MINOR.PATCH` на подтверждённом merge-коммите main с сообщением `Release MAJOR.MINOR.PATCH`.
- Опубликуйте только нужный тег обычным push. Проверьте серверный tag object и peeled SHA; peeled SHA должен совпасть с зафиксированным main.
- Существующий тег не перемещайте и не удаляйте. Push тега запускает только Release eligibility, без тяжёлых проверок. Ранний тег ожидает успешный main run/attempt и matching publication до 90 минут; ошибка или timeout блокирует дальнейший выпуск. Сохраните outputs tag/SHA/run/attempt/APP_IMAGE@digest и обе platform revisions. Для повторного допуска передавайте исходный digest; не подменяйте его новой публикацией того же SHA. При неоднозначном результате сначала прочитайте серверное состояние.

## 4. Main обратно в development

1. В чистом checkout переключитесь на `development` до применения `$delivery-semantic-merge`.
2. Примените этот skill с явным источником `origin/main`. Во время его выполнения не переключайте ветки.
3. Используйте `--no-ff --no-commit`; сохраните подготовленное Git сообщение через `git commit --no-edit`. При конфликтах следуйте reference skill и сохраняйте совместимое поведение обеих сторон.
4. Проверьте два родителя merge-коммита, ancestry main, diff и необходимые проверки. Для двухродительского merge используйте обычный non-force push, без `pcoat`.
5. Подтвердите local HEAD, серверный ref и remote-tracking ref, divergence `0/0`. При отсутствии других изменений деревья release, main и development должны совпасть.

## 5. GitHub Release и отчёт

- После проверки Gitflow и успешного Release eligibility создайте стабильный GitHub Release на существующем теге с `--verify-tag` и `--latest`. Передайте описание из changelog через `--notes-file`; проверьте фактическую страницу релиза.
- Сохраните feature- и release-ветки. Завершите на синхронизированной development.
- В отчёте укажите ссылки на PR и Release, SHA squash и merge-коммитов, тег, ruleset, main/gate run IDs, точный image digest и результаты проверок. Локальные проверки и серверное состояние подтверждайте отдельно.
- Релиз Git не развёртывает контейнер на VPS. Деплой выполняется только по отдельному запросу.

## Runtime и публикация образа

Production reCAPTCHA обязательна для публичных изменений и admin login. Credentials находятся вне checkout и образа; migrate их не получает. На feature/release выполняйте make check, make test и git diff --check. Используйте полный main Checks run: audit, UI и native linux/amd64 и linux/arm64 PostgreSQL 18/TLS; затем он публикует те же образы через artifacts без rebuild. Подтвердите обе платформы, OCI revision, общий GHCR digest и anonymous pull по свежему readback. Передайте на VPS record успешного Release eligibility с точными tag, main SHA, run/attempt и APP_IMAGE@sha256. Git release и synthetic Google tests не доказывают деплой или реальный assessment. На домене проверьте Web Key ID, IAM, action/hostname/score и вход; production bypass запрещён.
