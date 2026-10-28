---
name: release-feature
description: Выпускать Want Wallpapers по Gitflow из feature-ветки или готового development через release PR в main, protected tag, ручной production workflow и обратный semantic merge. Общая процедура для patch/fast, minor/full и выпуска с явной версией.
---

# Релиз Want Wallpapers по Gitflow

Используйте этот порядок для `andrey-krasheninnikov/want-wallpapers`. Он поддерживает исходную feature-ветку и выпуск уже готового `origin/development`. Выполняйте публикацию веток, PR, merges, тега, GitHub Release и deployment в пределах разрешённого конкретного выпуска. Само наличие skill или protected tag разрешения не даёт. Изменения инфраструктуры и правил защиты требуют отдельного scope.

## Способ выполнения

`execution=github` используется по умолчанию и сохраняет ручной workflow. `$release-local` задаёт `execution=local`: все проверки, публикация и запуск deployment выполняются с MacBook по [локальному контракту](../../../docs/ci-releases.md#локальный-выпуск-с-macbook). Этот режим не вызывает Actions; защищённые refs и Gitflow остаются обязательными.

## Версия и профиль

- `$release-patch` задаёт patch-инкремент и `profile=fast`; `$release-minor` задаёт minor-инкремент и `profile=full`.
- При прямом вызове `$release-feature` получите явную версию `MAJOR.MINOR.PATCH`. Профиль по умолчанию `full`; `fast` используйте по явному запросу. Сохраните поддержку указанной feature-ветки.
- Для нового patch/minor выпуска прочитайте из `origin/main` версию корневого `package.json`, workspace version в `Cargo.toml` и версию workspace-пакета в `Cargo.lock`. Все три должны совпадать с последним по SemVer стабильным `v*` тегом в ancestry main. Patch увеличивает только patch; minor увеличивает minor и сбрасывает patch в `0`. Например, `1.8.2` становится `1.8.3` либо `1.9.0`.
- Несовпадение исходных версий, явно запрошенной версии с инкрементом или занятая другим выпуском версия требуют выяснения. Не выбирайте другую версию молча.
- При возобновлении сначала восстановите версию, профиль и этап из существующих PR, changelog, тега и release evidence. Не рассчитывайте следующий инкремент для уже начатого выпуска.

## Подготовка

- Прочитайте применимые `AGENTS.md`, README, [контракт release gate](../../../docs/ci-releases.md) и [production instructions](../../../docs/production-deployments.md). Используйте `$git-workflow-and-versioning`; для обычных коммитов и публикации используйте `$delivery-commit-publish`.
- Проверьте checkout, ветку, upstream, remotes, divergence, worktrees и отсутствие активной Git-операции. Сохраните посторонние изменения; при необходимости используйте отдельный чистый worktree.
- Выполните `git fetch --all --prune`. При отставании от upstream разрешён только fast-forward. При divergence остановитесь.
- Через `git ls-remote` зафиксируйте точные SHA development, main и указанной feature-ветки. Проверьте существующие PR, release-ветку, тег и GitHub Release, чтобы не создавать дубликаты.
- До каждого merge повторно проверьте исходный и целевой SHA. Изменившийся ref требует пересмотра кандидата и затронутых проверок; не перезаписывайте новые коммиты.

## 1. Feature в development, если указана

Если выпуск начинается с готового `origin/development`, переходите к release-ветке. Не создавайте пустой feature PR.

1. Опубликуйте согласованные изменения feature-ветки и подтвердите серверный HEAD.
2. Выполните `make check`, `make test` и `git diff --check`.
3. Создайте PR в `development` с описанием результата и проверок. Передайте многострочное тело через `--body-file`; проверьте текст и метаданные, сохраняя нейтральное авторство.
4. Для `execution=local` подтвердите локальные проверки текущего дерева и обязательные merge protections, не запуская Actions. Для `execution=github` вручную запустите `Checks` на source-ветке по docs/ci-releases.md. Сверьте `head_sha` с HEAD PR; дождитесь успешных проверок текущего кандидата и обязательных checks. В режиме `execution=github` новый source commit требует нового ручного run.
5. Выполните squash merge с явным Conventional Commit сообщением и `--match-head-commit <verified-feature-sha>`. Не используйте admin bypass.
6. Прочитайте результат PR и обновите refs. У squash-коммита один родитель: проверенный прежний HEAD development. Его дерево сохраняет согласованные изменения обеих веток.

## 2. Release-ветка и main

1. Зафиксируйте актуальный `origin/development` и просмотрите весь diff относительно main. В выпуск входят все изменения выбранного development SHA. Несогласованный состав требует уточнения до публикации.
2. Создайте `release/v<version>` от этого development SHA. Синхронизируйте корневой `package.json`, workspace version в `Cargo.toml` и пакет в `Cargo.lock` с будущим тегом. Добавьте в `CHANGELOG.md` фактическую дату, пользу для посетителей и известные ограничения.
3. Опубликуйте release-коммит `chore(release): prepare v<version>` с собственным upstream release-ветки. Существующую подходящую ветку продолжайте только после проверки точного HEAD и diff.
4. Для `execution=local` на чистом окончательном release-кандидате выполните `make release-local-check TAG=v<version> PROFILE=<full-or-fast>`. Он сохраняет результаты до merge. Для `execution=github` выполните `make check`, `make test` и `git diff --check`: static/type/format, unit и bounded API на PostgreSQL 18. Повторно используйте подтверждённые результаты, если относящиеся к ним входные данные не изменились.
5. Создайте PR в `main`. Для `execution=local` используйте подтверждённые локальные проверки текущего дерева; обязательные protections не обходите. Для `execution=github` вручную запустите `Checks` на release-ветке и подтвердите успешный run на текущем HEAD. Тяжёлый audit/UI/native runtime gate выполнит release chain на protected tag после merge в main.
6. Выполните обычный merge без squash и rebase, с `--match-head-commit <verified-release-sha>` и без bypass. Подтвердите `MERGED` и два родителя: проверенный прежний main и проверенный release HEAD. Зафиксируйте итоговый SHA main.
7. Сразу после подтверждения merge в `main` удалите remote `release/v<version>`: повторно сверьте tip с принятым PR HEAD, отсутствие открытых PR, использующих ветку как source или target, и правила защиты. Удаляйте exact ref с SHA lease, затем подтвердите отсутствие через `git ls-remote`. Не откладывайте удаление до тега, deployment, обратного merge или GitHub Release; продолжайте выпуск по сохранённому main SHA и immutable тегу. Новые непринятые коммиты или зависимый PR требуют сохранить ветку и сообщить причину. Теги не удаляйте.

## 3. Protected tag и production workflow

- Сверьте `.github/release-policy.json` с полным readback активного tag ruleset `Protect release tags` для `refs/tags/v*`: запрет update/delete, пустой bypass list, совпадающие ID и `updatedAt`. Production environment допускает только tags `v*`, без branches. Несовпадение блокирует выпуск; не ослабляйте защиту и не меняйте policy без отдельного согласованного изменения.
- До публикации тега проверьте готовность root-owned validator и приватной конфигурации backup. Для `execution=github` также проверьте production environment и вручную запущенный worker; для `execution=local` проверьте pinned signer и ключ в ssh-agent, worker управляется локальной командой. Отсутствующие prerequisites блокируют тег; остальные согласованные этапы можно подготовить заранее.
- Создайте annotated тег `v<version>` на подтверждённом merge-коммите main с сообщением `Release <version>`. Опубликуйте только этот тег обычным push. Проверьте серверные tag object и peeled SHA; peeled SHA совпадает с зафиксированным main.
- Существующий тег не перемещайте и не удаляйте. Совпадающий тег используйте для оставшихся этапов; другой target блокирует продолжение. Push тега ничего не запускает.
- Для `execution=local` в чистом checkout опубликованного tag выполните `make release-local TAG=v<version> PROFILE=<full-or-fast>`, затем `make deploy-local TAG=v<version> PROFILE=<original-profile>`. Проверьте подписанный record, исходный digest, deployment request, backupVerified, running revision и public smoke; после этого перейдите к разделу 4. Actions и следующие команды workflow в этом режиме не выполняются.
- Для `execution=github` вручную запустите workflow на том же tag ref и с тем же tag input, передав выбранный `fast` или `full`:

```sh
gh workflow run deploy-production.yml --ref v<version> -f tag=v<version> -f profile=<fast-or-full>
```

Цепочка `execution=github` выполняет проверки, публикацию checked images через artifacts без rebuild, один eligibility и deployment. `fast` пропускает только Full UI/E2E. Оба профиля сохраняют static/type/format, unit/API, security audit, collection drafts и native runtime PostgreSQL 18/TLS на linux/amd64 и linux/arm64. Backup, off-VPS restore, migrations, grants, readiness и public smoke обязательны.

Дождитесь результата и сохраните tag, source SHA, профиль, пропущенные проверки, verification run/attempt, оба platform digests, оба config digests, OCI revisions и исходный `APP_IMAGE@sha256`. Отдельно подтвердите deployment request/status, `backupVerified`, running image/revision и public smoke. Успешный eligibility или публикация образа не подтверждают переключение VPS. Ошибка, timeout или `recovery-required` блокируют объявление успешного выпуска.

## 4. Main обратно в development

1. После подтверждённого deployment обновите refs и подготовьте чистый checkout актуального development. Сохраните новые параллельные изменения development.
2. До применения `$delivery-semantic-merge` выберите целевую integration-ветку. Примените skill с явным источником `origin/main`; во время его выполнения не переключайте ветки.
3. Используйте `--no-ff --no-commit`; сохраните подготовленное Git сообщение через `git commit --no-edit`. При конфликтах следуйте этому skill и сохраняйте совместимое поведение обеих сторон.
4. Проверьте двух родителей, ancestry main, diff и необходимые проверки. Используйте обычный non-force push, без `pcoat` для merge-коммита. При изменении remote target пересмотрите кандидат, не перезаписывая новые коммиты.
5. Подтвердите local HEAD, серверный ref и remote-tracking ref, divergence `0/0`. При отсутствии параллельных изменений деревья release, main и development совпадают.

## 5. GitHub Release, cleanup и отчёт

- После подтверждённых deployment и обратного merge создайте стабильный GitHub Release на существующем теге с `--verify-tag --latest --notes-file`. Возьмите описание из changelog, укажите профиль и пропущенный Full UI для fast. Прочитайте сохранённые tag, body, `draft: false` и `prerelease: false`.
- Проверьте, что remote release-ветка удалена сразу после merge в main по разделу 2; уже удалённую ветку не создавайте заново. Удалите оставшиеся disposable remote feature ветки текущего выпуска после readback merges: сверьте tip с принятым PR HEAD, отсутствие открытых зависимых PR и защиты. При новых непринятых коммитах сохраните ветку. Удаляйте exact ref с SHA lease и подтвердите отсутствие через `git ls-remote`. Локальную release-ветку удаляйте через `git branch -d`, когда она больше не нужна, не занята worktree и не содержит непринятых коммитов. Постоянные worktrees сохраняйте; завершите на синхронизированной development.
- Сообщите PR/Release URLs, SHA squash/merge, тег, профиль, ruleset, run/attempt, точный image digest, deployment request и результаты проверок. Разделяйте локальные проверки, CI, registry и фактический production. Настоящие CAPTCHA assessment и password/TOTP login проверяются приватно отдельно.

## Возобновление и runtime

- При неоднозначном результате сначала прочитайте серверные refs, PR, runs и deployment status. Не повторяйте публикацию или deployment вслепую.
- Для `execution=local` после публикации OCI index повторяйте `make deploy-local TAG=v<version> PROFILE=<original-profile>` с сохранённым состоянием: команда использует исходный digest без rebuild и reconciles существующий запрос. Для `execution=github` после публикации OCI index повторяйте deployment с исходным digest и тем же профилем. Новый run пропускает build/publication и валидирует исходные evidence. Не выбирайте более новую публикацию того же SHA:

```sh
gh workflow run deploy-production.yml --ref v<version> -f tag=v<version> -f profile=<original-profile> -f index_digest=sha256:<original-digest>
```

- Если index ещё не опубликован, сначала подтвердите отсутствие принятого deployment и опубликованного record. После исправления причины можно повторить verification/publication на неизменном теге; изменение исходников требует нового выпуска и нового тега.
- Существующий GitHub Release проверяйте и продолжайте оставшиеся этапы без дубликата. Полностью подтверждённый выпуск сообщите как уже завершённый.
- Production reCAPTCHA обязательна для публичных изменений и admin login. Credentials остаются вне checkout и image; migrate их не получает. Сверьте обе платформы, OCI revision, общий GHCR digest и anonymous pull. На домене проверяйте Web Key ID, IAM и action/hostname/score; production bypass запрещён. Git release и synthetic Google tests не доказывают реальный assessment.
