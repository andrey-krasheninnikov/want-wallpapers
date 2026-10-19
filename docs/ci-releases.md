# CI и ручной допуск релиза

## Запуск

Все workflows запускаются явно через `workflow_dispatch`. Push ветки, открытие PR, публикация тега и завершение другого workflow не запускают Actions. `workflow_call` используется только внутри вручную начатой цепочки.

Перед merge вручную запустите `Checks` на source-ветке PR:

```sh
gh workflow run checks.yml --ref feature/example
```

Сверьте `head_sha` завершённого run с текущим HEAD PR. Новый commit требует нового ручного запуска. Если protection требует status checks, дождитесь этих checks на текущем SHA; не снимайте protection и не используйте bypass. Checks на ветках выполняет static/type/format, unit/API и collection drafts. Ручной Checks на canonical main также выполняет audit, UI и native runtime, но не публикует images и не обращается к production.

## Один ручной выпуск

Создайте immutable protected annotated `v*` tag на commit в истории main. Сам push тега ничего не запускает. После проверки server validator, production environment и Mac backup worker выполните:

```sh
gh workflow run deploy-production.yml --ref v1.8.1 -f tag=v1.8.1 -f profile=full
```

Workflow ref обязан совпадать с tag input. Guard проверяет исходный repository, annotated tag с прямой ссылкой на commit, main ancestry и pinned immutable ruleset без bypass. Feature/development/main branch refs, PR, forks и незащищённые теги не допускают production deployment.

Цепочка вызывает Checks, публикует проверенные native images и OCI index, затем вызывает один Release eligibility и restricted production deployment. Static/unit/API, audit, collection drafts, полный UI и обе native runtime платформы должны пройти до публикации. Проверенный image сохраняется через `docker save`, загружается через `docker load` и публикуется без rebuild. Его config digest совпадает с проверенным image ID; OCI revision совпадает с source SHA. Index содержит ровно linux/amd64 и linux/arm64.

Publication получает `packages: write`; eligibility использует read-only permissions. Только deployment job получает production environment и SSH secret. Concurrency не отменяет активный tag release или migration; серверный lock сохраняет сериализацию при потере SSH.

## Профили full и fast

`full` выбран по умолчанию и выполняет все проверки. `fast` явно пропускает только полный browser UI/E2E suite:

```sh
gh workflow run deploy-production.yml --ref v1.8.1 -f tag=v1.8.1 -f profile=fast
```

Оба профиля выполняют static/type/format, unit/API, security audit, collection drafts и native runtime PostgreSQL 18/TLS на amd64/arm64. Любая ошибка блокирует публикацию или deployment. Fast может построить и опубликовать новый image выбранного eligible commit; заранее опубликованный full image не требуется. Backup, off-VPS restore и production gates остаются обязательными и могут занимать время.

Профиль и пропущенные проверки видны перед launch в input description и затем в release/eligibility/deployment evidence. До изменения последний полный run 39325173737 занял около 28 минут; Full UI выполнялся около 20 минут. Это историческая точка сравнения, не гарантия длительности нового release или контролируемое сравнение одинакового source SHA.

## Evidence и совместимость

Авторитетный release record находится в аннотации OCI index `foundation.want.wallpapers.release.v1`. Суффикс имени аннотации сохраняется для совместимости; JSON `schemaVersion` задаёт формат записи. Копия artifact хранится 90 дней. Используемые index/platform digests нельзя удалять из GHCR.

Новая запись `schemaVersion: 2` содержит:

- `repository`, полный `sourceSha` и ровно две `platforms` с `digest`, `configDigest`, `revision`;
- `verificationRun`: положительные целые `id`, `attempt`, `workflow: .github/workflows/deploy-production.yml`;
- `verificationProfile: full` с `skippedChecks: []` либо `verificationProfile: fast` с `skippedChecks: ["Full UI"]`.

Resolver сверяет canonical manual tag run и точный attempt через GitHub API. Успешные jobs имеют фиксированные имена с префиксом `checks / `, включая `Release profile (<profile>)`, `verify`, `Collection drafts`, обе Runtime, обе Publish и `publish`. Full требует успешный `Full UI`; fast требует ровно один явно skipped `Full UI` и успешные остальные jobs. Нельзя изменить профиль записи, сохранив marker другого профиля. Общий run ещё выполняется во время deployment; допуск требует завершённых успешных verification/publication jobs, а не завершения собственного deployment. Cancelled run и любой отсутствующий, повторяющийся или неуспешный обязательный job отклоняются.

Исторический `schemaVersion: 1` сохраняет прежнее значение: только полностью завершённый успешный main Checks run/attempt с прежним набором jobs. Он не может содержать новые поля профиля. Неизвестные версии, изменённые profile data и несовпадения source/run/attempt/config/platform/index/revision отклоняются. VPS независимо выполняет тот же resolver при принятии запроса и повторно перед остановкой app.

Tag protection проверяется по `.github/release-policy.json`: закреплённые ID и `updatedAt` соответствуют полному readback ruleset с пустым bypass list и запретом update/delete. Изменение ruleset требует проверенного обновления policy; read-only GITHUB_TOKEN не получает административных прав.

## Повтор и эксплуатация

Первый запуск передаёт digest прямо из publication в eligibility и deployment. Не выбирайте более новую публикацию того же SHA. Для повтора передайте исходный digest и тот же профиль:

```sh
gh workflow run deploy-production.yml --ref v1.8.1 -f tag=v1.8.1 -f profile=full -f index_digest=sha256:<original-digest>
```

Повтор пропускает build/publication и проверяет исходный record/run/attempt. Принятый сервером tag сохраняет исходный source/digest. Standalone Release eligibility остаётся ручным read-only инструментом с обязательными tag, profile и исходным digest; он не запускает deployment.

Backup/restore, migrations, TLS/grants, readiness, public smoke и compatible-only rollback обязательны. [Production instructions](production-deployments.md) описывают установку validator и recovery. Результаты CI/registry не подтверждают работающий VPS или приватный CAPTCHA/login assessment.

## Проверки изменений

Запустите `make test-ci`, actionlint, `make check` и `make test`. Contract tests проверяют события, DAG, canonical sources, profile/run/digest identity, сохранение checked images и серверные переходы. После релиза сохраните реальный run/attempt, оба config/platform digests, index digest, deployment request и running revision.

Ниже приведены исторические результаты прежнего автоматического процесса; они не описывают текущие entry points.

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
