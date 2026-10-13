# Проверка robots от 13 октября 2026

Работа относится к #17. Исправления PR #40 уже присутствуют в production v1.5.0. Эта запись отделяет текущие HTTP-пробы от будущего повторного аудита Semrush.

## Production до изменения

Свежий readback через `wf-landings` подтвердил healthy app, revision `79db2ff375866e5b7ba4e270ba52bb52e58700f9` и image `ghcr.io/andrey-krasheninnikov/want-wallpapers@sha256:4737fa1c5a253cf929de7c3ded3444b601066acfb60e0e9ff9d8c1e55d6e3d6a`. Origin robots содержит sitemap и исключения `/admin/`, `/api/`. Cloudflare добавляет managed groups и `Content-Signal`. Полный публичный [снимок robots](2026-10-13-robots-before.txt) и [HTTP baseline](2026-10-13-crawl-baseline.json) сохраняют дату и checksum.

Локальные запросы с `SiteAuditBot` получили 200 для robots, обеих sitemap, четырёх главных страниц, поиска, llms.txt и пяти CSS/JS ресурсов. Admin login отвечает 200 с `no-store` и `noindex`; admin session без авторизации отвечает 401 с `no-store`. Readiness также имеет `no-store`.

На `/ru/` синтетические `SiteAuditBot`, `SemrushBot` и curl получили 200. `Python-urllib/3.9` получил Cloudflare 403, тогда как тот же User-Agent у origin получил 200. Это подтверждает различие на edge, но не блокировку согласованного краулера Semrush. Настройки WAF по этим пробам не ослабляются. Запросы выполнены с локального IP; подмена User-Agent не подтверждает доступ настоящего краулера.

## Политика robots

Origin сохраняет все 47 запретов из публичного managed-снимка стандартными `User-agent` и `Disallow`. Общая группа разрешает публичные страницы, исключает admin/API и указывает sitemap. `SiteAuditBot`, `SemrushBot`, Googlebot и Bingbot используют общую группу. `SemrushBot-SWA` сохраняет собственный прежний запрет.

Приватные `Disallow` стоят перед `Allow: /` для совместимости с first-match парсерами. Смысл правил по [RFC 9309](https://www.rfc-editor.org/rfc/rfc9309.html#section-2.2.2), который требует наиболее конкретное совпадение, сохраняется. Независимая проверка стандартным Python парсером подтвердила 47 блокировок, доступ четырёх публичных краулеров и приватные исключения.

После подтверждённого деплоя v1.5.1 владелец отключил Bot Preference Sync и выполнил purge robots для всей зоны `want.foundation`, сохранив остальные настройки Cloudflare. [Cloudflare описывает](https://developers.cloudflare.com/bots/additional-configurations/managed-robots-txt/) добавление managed content перед существующим origin robots. Прочие хосты зоны после отключения используют собственные origin robots. Список в этом репозитории фиксирует исходную политику и требует отдельного обновления при изменении предпочтений владельца.

Build validation проверяет допустимые директивы, структуру групп, wildcard private exclusions, единственный sitemap и block-all правила отдельных групп. Тест сравнивает полный набор краулеров с независимым публичным снимком.

## Production после v1.5.1

[Main CI](https://github.com/andrey-krasheninnikov/want-wallpapers/actions/runs/38332718072) прошёл все семь jobs, включая полный UI и runtime amd64/arm64. [Production deployment](https://github.com/andrey-krasheninnikov/want-wallpapers/actions/runs/38335024315) завершился успешно на исходном digest; запрос `26e1448182634f1d8ab251c0e2d6749c` имеет terminal state `succeeded` и `backupVerified: true`. Первый production workflow завершился до VPS deploy из-за недоступности release evidence при `docker buildx`; повторный запуск сохранил тот же тег и digest.

Readback VPS подтвердил `healthy`, revision `a9e21ab361e2c74e272f753360f96004a484d550` и image `ghcr.io/andrey-krasheninnikov/want-wallpapers@sha256:77d8f0915951fbe1e44eec4800ad1f6bdba5f5383e2f992ef6d47de381c3b2d9`. Проверенный [публичный robots](2026-10-13-robots-after.txt) после отключения managed content точно совпадает с origin source; SHA-256 `5dec68ca5deb2f4e6c530d57636bd3ae160e0fee5f311f068f6a9d4559b27282`. `Content-Signal` отсутствует. Независимый Python parser подтвердил 47 блокировок, sitemap, доступ публичных краулеров и исключения admin/API.

[HTTP baseline после изменения](2026-10-13-crawl-after.json) содержит дату и 17 синтетических запросов: robots, обе sitemap, четыре локали, поиск, llms.txt, пять CSS/JS и приватные маршруты. Публичные URL отвечают 200; admin session без авторизации отвечает 401. Admin login сохраняет `noindex`, admin/API/readiness — `no-store`. Эти запросы с локального IP не подтверждают доступ настоящих IP Semrush.

## Повторный Semrush audit

Кампания `31471331`: владелец запускает аудит приватно после production-изменения. Нужны дата, deployed SHA, Desktop/User-Agent, JavaScript rendering, crawl source, лимит страниц, allow/disallow и parameter rules, количества и URL всех десяти исходных категорий. Для сравнения сохранить сопоставимые настройки прежнего аудита: Desktop, JavaScript отключён, 100 страниц. [Исходный архив](2026-10-05-audit.md) сохраняется.

Владелец отложил свежий Semrush audit из-за платного доступа. Экспорт не получен; новые количества и affected URL lists десяти категорий не подтверждены. #17 остаётся открытым до проверки действительного crawl и сохранения свежего Semrush baseline. Effective robots и публичный HTTP baseline уже проверены. Успешные локальные проверки и CI не заменяют результаты Semrush.
