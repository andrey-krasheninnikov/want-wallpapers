# CI и допуск релиза

## События и проверки

| Событие | Проверки | Публикация |
| --- | --- | --- |
| Push feature/development/release и других веток | Static/type/format, unit, API, CI contract | Нет |
| PR, включая PR в main и fork | Тот же лёгкий набор | Нет |
| Push main в исходном репозитории | Лёгкий набор, audit, полный UI, native amd64/arm64 runtime с PostgreSQL 18/TLS | Проверенные images и OCI index |
| Ручной Checks на main | Тот же полный набор | Проверенные images и OCI index |
| Ручной Checks на другой ветке или fork main | Лёгкий набор | Нет |
| Push защищённого v* | Release eligibility: только чтение метаданных | Нет сборки и публикации images |
| Ручной Release eligibility на main | Тег и исходный digest | Нет сборки и публикации images |

Лёгкий job имеет общий timeout 20 минут; `make test` ограничен 10 минутами. Его unit/API-набор включает `make test-ci`. Main UI выполняется после лёгких проверок; native runtime проверяется параллельно на Ubuntu 24.04 amd64/arm64. Audit, UI и обе платформы должны пройти до публикации. Main-прогон не отменяет активный предыдущий main-прогон. Fork никогда не получает разрешение публикации.

## Проверка и передача образа

До runtime-теста CI сохраняет Docker image ID, архитектуру и OCI revision. После PostgreSQL 18/TLS теста тот же image сохраняется через `docker save`. Publication job загружает artifact через `docker load`, сверяет image ID/platform/revision и публикует его без rebuild. У опубликованного platform manifest `config.digest` должен совпасть с проверенным image ID.

Registry tags содержат source SHA, GitHub run ID и attempt: `<sha>-<run>-<attempt>-amd64`, `<sha>-<run>-<attempt>-arm64` и общий `<sha>-<run>-<attempt>`. OCI index содержит ровно linux/amd64 и linux/arm64 и собирается из их точных digests. Buildx dry-run предоставляет descriptors; CLI явно задаёт OCI media type и record annotations и публикует index через Registry HTTP API. Обычные Docker platform manifests сохраняют прежние digests; их формат не может молча удалить index annotations. Readback сверяет digest отправленных bytes, record и обе платформы. Consumers используют `ghcr.io/andrey-krasheninnikov/want-wallpapers@sha256:<digest>`, без `latest` и без выбора по одному изменяемому registry tag.

## Долговечный release record

Авторитетная запись находится в GHCR, внутри аннотации OCI index `foundation.want.wallpapers.release.v1`. Она хранится вместе с самим image index; политику очистки GHCR нельзя применять к используемым release digests. Platform images также должны оставаться доступными. CI artifact `published-release.json` хранится 90 дней и служит копией.

Контракт JSON версии 1:

- `schemaVersion`: 1; `repository`: исходный репозиторий; `sourceSha`: полный commit SHA.
- `platforms`: ровно `linux/amd64` и `linux/arm64`; для каждой `digest`, `configDigest`, `revision`.
- `verificationRun`: `id`, `attempt`, `workflow` (`.github/workflows/checks.yml`).
- После чтения index resolver добавляет `indexDigest`, `image`; после допуска тега также `tag`.

Record публикуется после успеха verification jobs. Пока весь соответствующий main run/attempt не завершился успешно, запись не даёт допуска к релизу. Resolver отдельно проверяет GitHub API и успех jobs `verify`, `Full UI`, обеих Runtime, обеих Publish и `publish`. Доступность record сама по себе не доказывает успех CI.

## Защищённый тег

Release eligibility запускается на push `v*`, через workflow_dispatch на main или как reusable workflow. Он читает CLI и политику из main, требует annotated tag с прямой ссылкой на commit в истории main и проверяет действующий tag ruleset, запрещающий update/delete без bypass.

GitHub скрывает `bypass_actors` от клиента без права изменения ruleset. Поэтому `.github/release-policy.json` закрепляет ID и `updated_at` версии правила, проверенной с полным readback и пустым bypass list. Клиент с правами чтения сверяет эту версию и публичные правила. Изменение ruleset блокирует gate. Для обновления политики владелец должен приватно проверить свежий полный ruleset, подтвердить отсутствие bypass и запреты update/delete, затем включить новое `updatedAt` в проверенный PR. Обычный GITHUB_TOKEN остаётся read-only; токен администратора в CI не нужен. Не трактуйте отсутствующий bypass list как пустой.

Для tagged SHA выбирается последний соответствующий main Checks run. Pending/missing result ожидается до 90 минут, с опросом каждые 30 секунд. Failed/cancelled verification, неверный run/attempt, изменённые правила, отсутствующая запись, неполные platforms или несовпадения digest/config/revision блокируют допуск. Старые images без record не допускаются. Тег не запускает повторно audit, UI или image build.

При первом чтении можно выполнить:

```bash
python3 scripts/ci-release.py resolve --tag v1.4.0 --timeout 5400 > /absolute/path/outside-repository/release.json
```

Нужны настроенный приватно GitHub CLI и pull-доступ к GHCR; команда не меняет GitHub или registry. Для повторения используйте исходный digest из сохранённого record:

```bash
python3 scripts/ci-release.py resolve --tag v1.4.0 --digest sha256:<original-digest> --timeout 5400
```

Workflow_dispatch требует `tag` и `index_digest`. Reusable workflow принимает `tag` и необязательный `index_digest`; outputs: `source_sha`, `image`, `index_digest`, `release_record`. Первый consumer сохраняет полученный record и передаёт его исходный digest при повторении. Более новая публикация того же SHA не должна молча заменять digest прежнего deployment intent.

Release gate не выполняет SSH, migration, deployment или внешнее объявление. Эти этапы должны использовать точный record и отдельное подтверждение фактически работающего revision/digest. CI и registry не доказывают production.

## Локальная проверка изменения CI

```bash
make test-ci
make check
make test
```

Проверьте workflows через actionlint. CLI-тесты выполняются через публичные команды `plan`, `image`, `record`, `publish-index`, `resolve` с fixtures внешних GitHub/registry ответов. Они проверяют event matrix, защиту тега, отсутствие full jobs, failed/pending verification, source/run/platform/digest и повтор с исходным digest. Они не подтверждают реальную доставку Docker artifacts или native CI. После выпуска изменения в main отдельно сохраните реальные run IDs, оба image IDs/platform digests, общий index digest и результат раннего тега/manual retry.
