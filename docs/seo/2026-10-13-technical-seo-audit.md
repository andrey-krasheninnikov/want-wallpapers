# Ссылки и hreflang: проверка #23

Исправления PR #40 уже присутствуют в production v1.5.1. Эта проверка подтверждает текущее HTTP-поведение и дополняет защиту сборки. Основание ветки `fix/23-seo-link-validation`: `1fa7e7890834bbac588640a3f33afa046a25e081` (`development`).

## Production

Read-only SSH до и после HTTP-проверок подтвердил healthy app, revision `a9e21ab361e2c74e272f753360f96004a484d550` и image `ghcr.io/andrey-krasheninnikov/want-wallpapers@sha256:77d8f0915951fbe1e44eec4800ad1f6bdba5f5383e2f992ef6d47de381c3b2d9`. Новый деплой не выполнялся. Изменения #23 относятся к build validation и тестам, а не к runtime-страницам.

[HTTP-отчёт](2026-10-13-technical-seo-crawl.json) сохраняет UTC-время, URL, статусы, безопасные заголовки, checksum тела и SEO metadata. Запросы выполнены с локального IP с `User-Agent: SiteAuditBot`, без JavaScript и авторизации, максимум в два соединения. Redirects не следовали; их статусы считались бы ошибкой для проверяемых нормализованных публичных URL.

| Проверка | Результат |
| --- | --- |
| Sitemap | 192 уникальные индексируемые страницы; HTTP 200, один self-canonical, EN/RU/zh-CN/pt-BR и английский x-default |
| Hreflang | Targets существуют, индексируемы, отвечают 200, согласованы с canonical и взаимными ссылками |
| Исходные URL | Проверены все 95 source URL из [broken-links CSV](2026-10-05-broken-links.csv), включая девять search URL из 27 строк [hreflang CSV](2026-10-05-hreflang.csv) |
| Email | Ни одна проверенная публичная HTML-страница не содержит ссылки на `/cdn-cgi/l/email-protection` |
| Поиск | Все 104 search URL отвечают 200 с `noindex, follow`, canonical без параметров и без hreflang |
| Навигация | 296 уникальных внутренних targets отвечают 200; фрагменты ссылок существуют |
| Статика | Один CSS и восемь JS для Astro islands отвечают 200; JS имеет JavaScript content type |
| Ошибки | Четыре явные 404-страницы и четыре неизвестных локализованных пути отвечают 404 с `noindex`, без hreflang |
| Приватные маршруты | Admin login имеет `noindex` без hreflang; login, session и readiness имеют `no-store`; session без авторизации отвечает 401 |
| PNG | Desktop и mobile для `where-stars-graze-4` сохраняют attachment filename и PNG signature при GET с Range |

Начальный набор содержит 205 публичных HTML URL из sitemap, архива и базовых маршрутов поиска. После обхода навигации проверены 296 публичных HTML URL: 192 индексируемые страницы и 104 search URL. JSON отдельно хранит initialPublicHtmlUrls и publicHtmlUrls. Всего 324 HTTP-запроса к 320 уникальным URL. Четыре повторных HTML-запроса нужны для извлечения component-url/renderer-url Astro islands. Ошибок перечисленных проверок не обнаружено. Этот результат относится к описанному собственному crawl, а не к новой кампании Semrush. Ожидаемые 404 и приватный 401 не относятся к неожиданным ошибкам публичной навигации. Старый `/cdn-cgi/l/email-protection` не превращён в рабочую страницу: удалены ссылки, которые направляли туда посетителей.

## Build validation

Проверка графа теперь отклоняет ссылки обычных публичных страниц на известные 404-маршруты, даже когда HTML ошибок присутствует в сборке. Навигация между локализованными страницами ошибок сохраняется. Проверка отсутствия hreflang у исключённых страниц выполняется также для admin перед пропуском остальных публичных проверок.

Регрессии покрывают эти два пробела, отсутствующий alternate target, нарушенную взаимность, повторные и ненормализованные canonical, неверный x-default и hreflang на search/error/admin. Существующие проверки дубликатов alternates, внутренних URL, фрагментов, sitemap и native PNG actions сохранены. Runtime API, маршруты, UI, Makefile и workflow не изменены: frontend build уже запускает validator.

Локально прошли 19 SEO-тестов, полный frontend run (52 теста и проверка delayed Firebase consent), typecheck и сборка с validation всех 202 HTML-страниц. Typecheck завершился без ошибок и warnings, с шестью существующими hints в media-тестах. Первый полный test run остановился на неисправном Homebrew FFmpeg, который ссылается на отсутствующую `libx265.215.dylib`. Повторный run использовал прежний FFmpeg wrapper с существующим image, без сети и с read-only mount временных fixtures; все тесты прошли. Системный FFmpeg не менялся.

Rust, браузерный E2E и container/runtime suites не запускались; CI не ожидался. Локальная сборка не подтверждает deployment нового commit. Проверки сторонней аналитики и настоящих IP краулеров сюда не входят.

## Закрытие с оговоркой

Владелец выбрал закрытие #23 с оговоркой о недоступном платном Semrush audit. Блокер [#17](https://github.com/andrey-krasheninnikov/want-wallpapers/issues/17) закрыт; его [production baseline](2026-10-13-robots-audit.md) сохранён.

Свежий Semrush crawl, его дата и новые affected URL lists не получены. Критерий нулевых broken links, unexpected 4XX и hreflang conflicts именно в Semrush остаётся неподтверждённым. Закрытие фиксирует принятые изменения и собственные проверки; исходные 95/27/1 не выдаются за новые значения. При возобновлении платного аудита сравнить эти три категории с сохранённым исходным архивом.
