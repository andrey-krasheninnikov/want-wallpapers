# HTTP API

Базовый путь `/api/v1`. JSON; ошибка: `{"error":{"code":"conflict"}}`. Ограничение тела 2 MiB. Внутренние ошибки и секреты не возвращаются. Параметры SQL передаются отдельно от текста запросов. Все приватные ответы имеют `Cache-Control: no-store`.

## Посетители

`POST /session` с точным `Origin` создаёт или возвращает анонимную сессию: `{uid,csrf}`. Cookie `__Host-want-visitor` в production (`want-visitor` в development) — HttpOnly, SameSite=Strict, Secure в production, срок до года. Публичный `GET /wallpapers/{id}/social` возвращает `{counts,ownRating,ownUid,comments}`; последние 50 видимых комментариев, даты в миллисекундах Unix. Региональные ограничения отсутствуют. Страна и настройки optional tracking не дают авторизацию и не блокируют оценки, комментарии или обращения.

Все изменения требуют cookie, `Origin`, `X-CSRF-Token` и свежий `X-ReCAPTCHA-Token`:

- `PUT /wallpapers/{id}/rating`: `{value}`; cringe/minus/plus/imba. Одна текущая оценка.
- `POST /wallpapers/{id}/comments`: `{text}`; 2–1000 символов UTF-16 после trim. Один комментарий на обои в 24 часа. Удаление не снимает cooldown.
- `DELETE /wallpapers/{id}/comments/{uuid}`: только владелец. Чужой ID возвращает 404.
- `POST /wallpapers/{id}/comments/{uuid}/report`: идемпотентная жалоба на чужой видимый комментарий.
- `POST /feedback`: `{topic,message,email}`; 1–100 / 5–2000 / до 254 символов, email необязателен.

## reCAPTCHA Enterprise

`GET /recaptcha/config` возвращает `{enabled,siteKey}` с `Cache-Control: no-store`. Это публичные настройки runtime, без credentials. Frontend загружает Enterprise.js только при защищённом действии; просмотр, поиск, скачивания, создание visitor session и чтение API не вызывают Google.

Action: rating, comment, comment_delete, comment_report, feedback, admin_login — соответственно оценке, комментарию, удалению, жалобе, обращению и входу. Для каждого повторного действия нужен новый токен. Сервер проверяет valid, точные action и hostname из SITE_URL, наличие riskAnalysis и конечный score ≥ RECAPTCHA_MIN_SCORE (по умолчанию 0.5). Google проверяет срок токена и повторное использование. На одну оценку выделено 5 секунд, автоматических повторов нет.

Отсутствующий токен даёт 400 `recaptcha-required`, непрошедшая проверка — 403 `recaptcha-rejected`, ошибка или timeout Google — 503 `recaptcha-unavailable`. Ни один из этих случаев не записывает действие или admin session. Интерфейс сохраняет введённые поля и позволяет повторить запрос с новым токеном. Origin, CSRF, ownership, пароль/TOTP и лимиты действуют дополнительно.

Production требует CAPTCHA и credentials. RECAPTCHA_ENABLED=false разрешён только в development и тестах. Авторизованные действия админки после входа и scoped Bearer каталог не используют CAPTCHA. Google получает токен, action, ключ сайта, User-Agent и IP, вычисленный через доверенную proxy chain; бизнес-данные и секреты в assessment не передаются.

## Администратор

`POST /admin/login`: `{username,password,code}` с Origin и свежим `X-ReCAPTCHA-Token` для action `admin_login`. Шесть цифр TOTP, SHA1, 30 секунд, допуск ±1 интервал. Лимит 5 попыток/IP и 50 попыток/аккаунт за 15 минут. Ошибка входа общая. Cookie `__Host-want-admin` в production (`want-admin` в development) не совпадает с сессией посетителя.

`GET /admin/session`: `{username,csrf}`. `POST /admin/logout` требует CSRF. Срок 8 часов / 30 минут простоя. Авторизация и владение проверяются сервером независимо от URL страницы.

`GET /admin/moderation/{comments|reports|feedback}?offset=0&limit=25&status=open`: `{items,hasMore}`, limit 1–100. Комментарии: статус visible/hidden; жалобы open/resolved/dismissed; обращения open/closed. Пустой status возвращает все записи. UUID, дата и version включены в запись.

`PATCH /admin/moderation/{kind}/{uuid}`: `{version,hidden}` для комментария или `{version,status}` для жалобы/обращения. Устаревшая version даёт 409. Закрытие устанавливает closed_at; открытие удаляет его. Ежедневная очистка удаляет закрытые обращения старше года. Проверка жалобы и скрытие комментария — отдельные осознанные действия.

## Каталог

`GET /catalog` публично возвращает `{collections,wallpapers}` только активных записей; count вычисляется по активным обоям. Порядок: ID коллекции, номер обоев. Экспорт читает согласованный snapshot одной транзакции.

Защищённые операции доступны администратору с cookie/CSRF/Origin или `Authorization: Bearer <token>` без cookie. Токен не даёт доступ к сессиям, модерации и обращениям. Неверный Authorization никогда не заменяется авторизацией cookie.

- `GET /admin/catalog`: `{collections:[{item,version,archived}],wallpapers:[{item,version,archived}],taxonomy}`; включает архив для readback.
- `POST /admin/catalog/import`: прежний manifest `{collection,wallpapers}`; `{result:"created"|"unchanged"}`. Точный повтор — no-op. Частичные, отличающиеся записи, повтор номера папки даже без ведущих нулей дают 409 без записи. Социальные данные сохраняются. После сетевой ошибки сначала выполните readback.
- `PUT /admin/catalog/collections`: `{item,version}`; version=null для создания пустой коллекции, текущая version для изменения переводов. ID/slug/count существующей записи неизменны.
- `PUT /admin/catalog/wallpapers`: `{item,version}`; version=null для создания, текущая version для изменения переводов, категории и тегов. ID/slug/номер/коллекция/CDN неизменны.
- `PATCH /admin/catalog/{collections|wallpapers}/{id}/archive`: `{version,archived}`. Архив не удаляет социальные данные. Восстановление возвращает запись в следующий export.

Каждый перевод содержит ровно en/ru/zh-cn/pt-br, название 1–200 и описание 1–2000 символов. ID коллекции `<положительный номер>-<slug>`, ведущие нули сохраняются. Номер уникален численно. Slug — латинские строчные буквы/цифры, разделённые одиночными дефисами. ID обоев `<slug>-<number>`, s3Folder=ID коллекции, fileStem=slug (сохранённое поле manifest). CDN: `https://want-foundation.s3.twcstorage.ru/wallpapers/assets/collections/{s3Folder}/{number}-{desktop|mobile}.png`. Категории и теги фиксированы в frontend и backend taxonomy. Collection count в защищённом readback хранит общее число дизайнов, публичный export вычисляет число активных. Максимум 1000 дизайнов в одном manifest.

Вход, изменения каталога и модерации записываются в audit_log без текстов сообщений, email, паролей, токенов и TOTP.
