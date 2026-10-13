# Проверка robots от 13 октября 2026

Работа относится к #17. Исправления PR #40 уже присутствуют в production v1.5.0. Эта запись отделяет текущие HTTP-пробы от будущего повторного аудита Semrush.

## Production до изменения

Свежий readback через `wf-landings` подтвердил healthy app, revision `79db2ff375866e5b7ba4e270ba52bb52e58700f9` и image `ghcr.io/andrey-krasheninnikov/want-wallpapers@sha256:4737fa1c5a253cf929de7c3ded3444b601066acfb60e0e9ff9d8c1e55d6e3d6a`. Origin robots содержит sitemap и исключения `/admin/`, `/api/`. Cloudflare добавляет managed groups и `Content-Signal`. Полный публичный [снимок robots](2026-10-13-robots-before.txt) и [HTTP baseline](2026-10-13-crawl-baseline.json) сохраняют дату и checksum.

Локальные запросы с `SiteAuditBot` получили 200 для robots, обеих sitemap, четырёх главных страниц, поиска, llms.txt и пяти CSS/JS ресурсов. Admin login отвечает 200 с `no-store` и `noindex`; admin session без авторизации отвечает 401 с `no-store`. Readiness также имеет `no-store`.

На `/ru/` синтетические `SiteAuditBot`, `SemrushBot` и curl получили 200. `Python-urllib/3.9` получил Cloudflare 403, тогда как тот же User-Agent у origin получил 200. Это подтверждает различие на edge, но не блокировку согласованного краулера Semrush. Настройки WAF по этим пробам не ослабляются. Запросы выполнены с локального IP; подмена User-Agent не подтверждает доступ настоящего краулера.

## Политика robots

Origin сохраняет все 47 запретов из публичного managed-снимка стандартными `User-agent` и `Disallow`. Общая группа разрешает публичные страницы, исключает admin/API и указывает sitemap. `SiteAuditBot`, `SemrushBot`, Googlebot и Bingbot используют общую группу. `SemrushBot-SWA` сохраняет собственный прежний запрет.

Приватные `Disallow` стоят перед `Allow: /` для совместимости с first-match парсерами. Смысл правил по [RFC 9309](https://www.rfc-editor.org/rfc/rfc9309.html#section-2.2.2), который требует наиболее конкретное совпадение, сохраняется. Независимая проверка стандартным Python парсером подтвердила 47 блокировок, доступ четырёх публичных краулеров и приватные исключения.

После деплоя v1.5.1 managed-добавка отключается для всей зоны `want.foundation`; остальные настройки Cloudflare сохраняются. [Cloudflare описывает](https://developers.cloudflare.com/bots/additional-configurations/managed-robots-txt/) добавление managed content перед существующим origin robots. Прочие хосты зоны после отключения используют собственные origin robots. Список в этом репозитории фиксирует исходную политику и требует отдельного обновления при изменении предпочтений владельца.

Build validation проверяет допустимые директивы, структуру групп, wildcard private exclusions, единственный sitemap и block-all правила отдельных групп. Тест сравнивает полный набор краулеров с независимым публичным снимком.

## Повторный Semrush audit

Кампания `31471331`: владелец запускает аудит приватно после production-изменения. Нужны дата, deployed SHA, Desktop/User-Agent, JavaScript rendering, crawl source, лимит страниц, allow/disallow и parameter rules, количества и URL всех десяти исходных категорий. Для сравнения сохранить сопоставимые настройки прежнего аудита: Desktop, JavaScript отключён, 100 страниц. [Исходный архив](2026-10-05-audit.md) сохраняется.

Новый экспорт пока не получен. До подтверждения действительного crawl, effective robots и сохранения свежего baseline #17 остаётся открытым. Остальные категории фиксируются для соответствующих SEO-тикетов; успешные локальные проверки не заменяют результаты Semrush.
