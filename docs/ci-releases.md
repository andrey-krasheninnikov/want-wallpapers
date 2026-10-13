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

Production deployment отдельно выполняет `.github/workflows/deploy-production.yml`. Workflow использует reusable gate, protected-tag environment и restricted SSH protocol. Manual retry выбирает ref самого release tag и требует исходный digest. [Provisioning, backup gate и recovery](production-deployments.md) описывают operator prerequisites и actual production acceptance.

## Подтверждение #13: 13 октября 2026

Основная реализация вошла в development через [PR #38](https://github.com/andrey-krasheninnikov/want-wallpapers/pull/38), затем в main. GitHub API, существующие CI artifacts и публичный GHCR подтвердили следующие результаты:

| Событие | Run | Результат |
| --- | --- | --- |
| Push feature | [37326131495](https://github.com/andrey-krasheninnikov/want-wallpapers/actions/runs/37326131495) | verify прошёл; Runtime, Full UI и publication пропущены |
| PR feature | [37326137880](https://github.com/andrey-krasheninnikov/want-wallpapers/actions/runs/37326137880) | verify прошёл; тяжёлые jobs пропущены |
| Push development | [38327119128](https://github.com/andrey-krasheninnikov/want-wallpapers/actions/runs/38327119128) | verify прошёл; audit и тяжёлые jobs пропущены |
| Push release/v1.5.0 | [38326146493](https://github.com/andrey-krasheninnikov/want-wallpapers/actions/runs/38326146493) | лёгкий run завершился успешно |
| Main для v1.5.0 | [38321320250](https://github.com/andrey-krasheninnikov/want-wallpapers/actions/runs/38321320250) | verify, Full UI, обе Runtime, обе Publish и publish прошли |
| Protected tag v1.5.0 | [38322934382](https://github.com/andrey-krasheninnikov/want-wallpapers/actions/runs/38322934382) | resolve прошёл; сборочных jobs нет |
| Manual retry production workflow | [38325383839](https://github.com/andrey-krasheninnikov/want-wallpapers/actions/runs/38325383839) | reusable eligibility сохранил исходный release record |

Тег `v1.5.0` является annotated tag object `52b7ea252d037b8c24077c3f11c1d06fb57a7546` и закреплён на source SHA `79db2ff375866e5b7ba4e270ba52bb52e58700f9`. Его main verification run: `38321320250`, attempt `1`. Активный ruleset `24392512` запрещает update/delete для `refs/tags/v*`, bypass list пуст; версия правила соответствует `.github/release-policy.json`.

Исходный index digest: `sha256:4737fa1c5a253cf929de7c3ded3444b601066acfb60e0e9ff9d8c1e55d6e3d6a`. `published-release.json`, tag eligibility и manual retry содержат одинаковые source/run/platform/index значения; eligibility добавляет только `tag`.

| Платформа | Исходный checked image ID и опубликованный config.digest | Platform manifest digest |
| --- | --- | --- |
| linux/amd64 | `sha256:6aa964ac3a10885f11681e8f742485c3cb33dbcbddc00a7c810c1646f94fef7e` | `sha256:9ce9c0b5a94a8c63c66362b2c2c26319613df1e894a6a854ebcd7f5493ed4ac2` |
| linux/arm64 | `sha256:425b6e739330157e4167db4134c6a30a4f1a825a74f03b3158fbf0cb281ebee9` | `sha256:ee9c3e58178517a2d54bec68a5a46bc5cf008a8fb225539befc69cd18d898a14` |

Image IDs прочитаны из исходных `checked-image.json` в runtime artifacts `11778318021` (amd64) и `11778953885` (arm64). Они совпали с config digests опубликованных platform manifests; обе OCI revisions равны source SHA. Read-only resolver повторно проверил GitHub jobs, immutable tag и registry по исходному digest. Эти проверки подтверждают передачу проверенных images в publication без rebuild. Состояние работающего VPS отдельно не проверялось.

У `v1.4.1` [tag gate 37380923001](https://github.com/andrey-krasheninnikov/want-wallpapers/actions/runs/37380923001) начал resolve в `2026-10-05T22:12:15Z`, пока [matching main 37380849814](https://github.com/andrey-krasheninnikov/want-wallpapers/actions/runs/37380849814) ещё выполнялся. Main завершился failure в `22:14:24Z`, gate также завершился failure в `22:14:56Z`. Успешное ожидание раннего тега, timeout, fork и отдельные ручные Checks/Release eligibility события проверены fixtures; отдельные реальные runs для этих сценариев не запускались.

Локально существующий UTC timestamp test воспроизвёл отказ системного Python 3.9.6: `Malformed or unavailable release evidence`. Resolver нормализует завершающий `Z` в `+00:00` перед стандартным ISO parser, сохраняя обязательную timezone и сравнение версии ruleset. UTC и негативные boundary tests прошли на Python 3.9.6 и 3.13; `make test-ci PYTHON=/opt/homebrew/bin/python3.13` завершился с 53 успешными тестами. Исправленный resolver на Python 3.9.6 прочитал существующий v1.5.0 и тот же digest через публичные GitHub/GHCR API.

Новые тяжёлые CI runs, E2E, release tags и deployments для этой проверки не запускались. CI workflows и release-record contract не менялись.
