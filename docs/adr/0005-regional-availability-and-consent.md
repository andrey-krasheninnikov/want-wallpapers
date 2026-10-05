# 0005: Separate regional ad selection from feature availability

Status: accepted; availability and consent implemented in #10. Advertising provider integration remains pending. Replaces the availability and consent decisions in [0002](0002-region-and-consent.md) and the regional-policy paragraph of [0004](0004-rust-monorepo.md).

Ratings, comments, feedback and analytics are no longer disabled solely because a visitor is in Russia or a country lookup fails; analytics remains subject to consent and configuration, and authentication, CSRF, ownership, rate limits and production reCAPTCHA remain independent. Optional analytics and advertising default to enabled for new visitors outside the EEA, while EEA visitors and unknown-country results require an explicit choice; stored refusals are preserved and advertising consent is independent of an earlier analytics choice. Country selection uses Yandex for RU/KZ/BY and Adsterra elsewhere, including unknown-country results after consent, while downloads stay available when advertising is declined, dismissed or unavailable.


## Реализация #10

Страна определяет defaults, а не доступ к функциям. Ответ IP lookup проверяется и приводится к ISO-коду; RU, KZ, BY, EEA, остальные страны и unknown различаются отдельно. Для EEA учитываются страны ЕС, Исландия, Лихтенштейн и Норвегия. Timeout составляет 6 секунд; неизвестный результат не сохраняется между загрузками. Клиентские заголовки и результат lookup не дают авторизацию API.

Явные настройки имеют приоритет над defaults. `want-cookie-preferences-v2` хранит независимые boolean analytics/advertising. Старое essential переносится в false/false, analytics в true/false; повреждённая запись не разрешает сбор. Необходимое хранение и CAPTCHA сохраняются при отказе от optional tracking. Настройки доступны в footer; отзыв отключает дальнейший сбор, включая другую открытую вкладку и незавершённый запуск SDK.

Firebase Analytics требует полной публичной конфигурации и разрешения аналитики. До инициализации применяются analytics_storage и отдельные ad_storage/ad_user_data/ad_personalization. Админка не выполняет lookup и не загружает optional tracking. Рекламные сети пока не подключены; выбранные провайдеры остаются отдельной реализацией с актуальными сведениями и согласием.

Политика согласия опирается на [рекомендации EDPB](https://www.edpb.europa.eu/sme/be-compliant/process-personal-data-lawfully_en); это не общее юридическое одобрение рекламных конфигураций. API consent и отключения сбора описан в [Firebase Analytics](https://firebase.google.com/docs/reference/js/analytics).
