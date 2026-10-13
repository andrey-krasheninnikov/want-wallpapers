# Приёмка llms.txt от 13 октября 2026

Для #18 опубликован [v1.6.0](https://github.com/andrey-krasheninnikov/want-wallpapers/releases/tag/v1.6.0). Изменения [PR #64](https://github.com/andrey-krasheninnikov/want-wallpapers/pull/64) сохраняют действующие условия лицензии, добавляют Terms, discovery metadata и проверки структуры, локалей и актуального каталога. Отдельный [PR #66](https://github.com/andrey-krasheninnikov/want-wallpapers/pull/66) допускает только точное изолированное media-правило Prizmaxis в ответе S3 GetBucketPolicy. Bucket policy не изменялась; анонимные GET/HEAD собственного временного объекта backups получили 403, затем объект удалён.

## Релиз и production

[Release PR #67](https://github.com/andrey-krasheninnikov/want-wallpapers/pull/67) смержен обычным merge в main `e7557b42cc6ad989e7b378645a6bd9ebdd55202c`. Annotated tag `v1.6.0` имеет object `3ff72d3e0729ea7847b55ecd57683c04ea3ae02f` и указывает на этот commit. Ruleset `24392512` запрещает обновление и удаление `refs/tags/v*`, bypass actors отсутствуют. Обратный merge в development `309229bea260889e6a85319527a595b02718107f` сохраняет дерево релиза.

[Main CI](https://github.com/andrey-krasheninnikov/want-wallpapers/actions/runs/38343036704) завершил все семь jobs успешно, включая полный UI и PostgreSQL 18/TLS runtime на amd64/arm64. [Release eligibility](https://github.com/andrey-krasheninnikov/want-wallpapers/actions/runs/38345037226) и [production deployment](https://github.com/andrey-krasheninnikov/want-wallpapers/actions/runs/38345037470) также прошли с первой попытки. Опубликованный multi-platform образ проверен анонимно по index, platform manifests, config digests и revision до создания тега.

Deployment request `89daf487d9ee4b768207c12b20c0195f` завершён: `state=succeeded`, `stage=complete`, `backupVerified=true`. Перед обновлением worker зашифровал backup и проверил восстановление вне VPS. Readback VPS подтвердил healthy amd64 app, revision `e7557b42cc6ad989e7b378645a6bd9ebdd55202c` и image `ghcr.io/andrey-krasheninnikov/want-wallpapers@sha256:0238bf14857d315c7c7758d739c4f0b114fb1a297a61260a8f4d79736119c66f`. Worker остановлен после успешного deployment; для следующего deployment его нужно запустить на Mac.

## Публичный ответ

[HTTP-снимок](2026-10-13-llms-http.json) содержит время проверки, разрешённые deployment metadata и результаты запросов с локального IP. [Снимок llms.txt](2026-10-13-llms-after.txt) точно совпадает с документом release source: 35 079 bytes, SHA-256 `0e5051355208f298dba87968f34d07181611028285c6639e98c875b7b20f1d5b`. GET `/llms.txt` возвращает 200 и `text/plain; charset=utf-8`.

Все 176 уникальных ссылок отвечают 200 с HTML, имеют собственный canonical и единственный `rel="describedby"` на `/llms.txt` с `type="text/plain"`. Документ охватывает `en`, `ru`, `zh-cn`, `pt-br`, пять коллекций и 35 обоев; английские страницы находятся в корне. Приватные маршруты и query/fragment в ссылках отсутствуют. Публичные readiness и admin login отвечают 200 с `no-store`. Вход с credentials/TOTP повторно не проверялся: auth не менялся.

## Проверки и оставшееся ограничение

Локально прошли static checks, production build с HTML-графом, Rust HTTP GET/HEAD и тесты SEO/backup guard. Шесть media tests на Mac не прошли из-за отсутствующего `libx265.215.dylib` у установленного FFmpeg; соответствующий полный набор прошёл в Linux CI. Standards и Spec reviews исходных изменений, worker fix и release metadata не выявили замечаний.

Владелец согласовал закрытие #18 после production-приёмки с отложенным платным Semrush audit. Свежий экспорт не получен; исчезновение missing/malformed в настоящем Semrush crawl не подтверждено. Эти HTTP-проверки и CI не подтверждают изменение поискового ранжирования.
