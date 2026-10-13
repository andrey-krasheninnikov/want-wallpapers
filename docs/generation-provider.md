# Провайдер генерации коллекций

Решение для [#20](https://github.com/andrey-krasheninnikov/want-wallpapers/issues/20) согласовано владельцем 13 октября 2026 года. Выбран Pollinations с бесплатными Quest Pollen. Подключение и реальная генерация относятся к [#26](https://github.com/andrey-krasheninnikov/want-wallpapers/issues/26), публикация к [#29](https://github.com/andrey-krasheninnikov/want-wallpapers/issues/29). При выборе выполнены только чтение публичных источников и расчёт: generation-запросов 0, денежных расходов $0. Credentials не создавались и не проверялись.

## Согласованное решение

| Параметр | Значение |
| --- | --- |
| Сервис | `https://gen.pollinations.ai`, только Quest Pollen |
| Изображения | `openai/gpt-image-2`, `quality=high`, одна картинка на запрос |
| Текст и переводы | `openai/gpt-5.4-nano`, EN/RU/zh-CN/pt-BR |
| Коллекция | Пять разных дизайнов, отдельные desktop/mobile композиции одной сцены |
| Desktop PNG | Нативные 3840×2160, 16:9 |
| Mobile PNG | Нативные 2160×3840, 9:16 |
| Объём | Четыре коллекции за календарный месяц UTC |
| Денежные лимиты | $0 на коллекцию и $0 в месяц |
| Credits | 10 Pollen на коллекцию, 40 в месяц; изображения и текст вместе |
| Image-попытки | Десять исходных и максимум четыре дополнительные на всю коллекцию |
| Регион использования | Нидерланды |
| Принятое ограничение | Experimental 4K с проверкой фактического результата |

Upscale, mobile как crop desktop, снижение качества/разрешения, смена модели и платный fallback не согласованы. Reference image помогает сохранить сцену, но не гарантирует совпадение. Несогласованный результат остаётся черновиком.

[Upstream guide](https://developers.openai.com/api/docs/guides/image-generation#earlier-gpt-image-models) перечисляет обе размерности GPT Image 2; [prompting guide](https://developers.openai.com/cookbook/examples/multimodal/image-gen-models-prompting-guide) отмечает вариативность выше 2K. Размеры кратны 16 и содержат 8 294 400 пикселей. [Список стран upstream API](https://help.openai.com/en/articles/5347006-openai-api-supported-countries-and-territories/) включает Нидерланды. Доступ конкретного аккаунта через посредника ещё не проверен.

## Сравнение API

Проверено 13 октября 2026 года. Бесплатный browser UI, подписка пользовательского приложения и открытые веса не подтверждают бесплатный внешний API. Generation-запросы не выполнялись.

| Кандидат | Размеры, PNG и композиция | Автоматизация, текст и бесплатность | Решение |
| --- | --- | --- | --- |
| Pollinations + GPT Image 2 | Точные размеры через `size`, generation/reference editing; формат bytes проверяется отдельно | HTTPS REST и отдельный vision/text API. Выбранные модели имеют `paid_only=false`; нужен бесплатный баланс | Выбран с ограничениями ниже |
| Cloudflare + FLUX.2 klein 4B | Reference editing, стороны 256-1920 px; нативных выбранных 4K нет. Base64 image требует проверки формата | REST multipart и отдельная text модель; Workers Free даёт 10 000 Neurons в день, затем отказ | Отклонён: увеличение до 4K не согласовано |
| Gemini API image models | 16:9/9:16, 4K, PNG и reference editing; exact pixels проверяются отдельно | REST и отдельные text модели; у image моделей Free Tier отсутствует | Отклонён при $0 |
| Hugging Face Inference Providers | Размеры, PNG и reference editing зависят от routed provider | Image/text API. Free Users не получают включённых credits, требуется покупка | Отклонён; бесплатность весов/Spaces не переносится на routed API |
| Alibaba Model Studio + Wan2.7 image pro | Custom 4K для T2I; reference/image-set сценарии ограничены 2K. Формат bytes проверяется отдельно | REST и отдельные text модели; new-user quota в Singapore действует 90 дней, конкретная модель проверяется в аккаунте | Отклонён: временная квота и 2K reference workflow |

Источники: [Pollinations image](https://gen.pollinations.ai/image/models?community=false), [text](https://gen.pollinations.ai/text/models?community=false), [API spec](https://github.com/pollinations/pollinations/blob/f3ff75164d38b3aaec8ac0f0e3d377101558f541/APIDOCS.md), [Cloudflare параметры](https://developers.cloudflare.com/changelog/post/2026-01-15-flux-2-klein-4b-workers-ai/), [тариф](https://developers.cloudflare.com/workers-ai/platform/pricing/), [Gemini возможности](https://ai.google.dev/gemini-api/docs/image-generation), [тариф](https://ai.google.dev/gemini-api/docs/pricing), [Hugging Face тариф](https://huggingface.co/docs/inference-providers/pricing), [Wan возможности](https://www.alibabacloud.com/help/en/model-studio/text-to-image), [Alibaba free quota](https://www.alibabacloud.com/help/en/model-studio/new-free-quota).

Quest Pollen зарабатываются через задания и вклады. Регулярные начисления и достаточный объём для четырёх коллекций не гарантированы. Покупки, платные задания и чужие кошельки исключены. Повторная регистрация не используется для повторного получения rewards. При недостатке заработанного баланса workflow останавливается. [Pollen FAQ](https://github.com/pollinations/pollinations/blob/f3ff75164d38b3aaec8ac0f0e3d377101558f541/enter.pollinations.ai/POLLEN_FAQ.md), [условия](https://github.com/pollinations/pollinations/blob/f3ff75164d38b3aaec8ac0f0e3d377101558f541/pollinations.ai/public/legal/TERMS_OF_SERVICE.md).

## Расчёт credits

Ставки публичного каталога в Pollen за токен на дату проверки:

| Модель | Text input | Image input | Output |
| --- | --- | --- | --- |
| `openai/gpt-image-2` | 0,00000375 | 0,000006 | 0,0000225 за image token |
| `openai/gpt-5.4-nano` | 0,00000015 за input token, включая vision input | Включён в input | 0,0000009375 за text token |

[Image rates](https://gen.pollinations.ai/image/models?community=false) и [text rates](https://gen.pollinations.ai/text/models?community=false) принадлежат посреднику. Cached discounts не учтены. Перед новым черновиком сверяются тарифы и `paid_only`; изменение останавливает workflow до новой проверки.

[Калькулятор upstream](https://developers.openai.com/api/docs/guides/image-generation#cost-and-latency) для GPT Image 2 `high` использует сетку 96×54 для 16:9 или 54×96 для 9:16:

```text
output tokens = ceil(96 × 54 × (2 000 000 + 3840 × 2160) / 4 000 000) = 13 342
image output = 13 342 × 0.0000225 = 0.300195 Pollen
text reserve = 2 × (16 000 × 0.00000015 + 8192 × 0.0000009375) = 0.02016 Pollen
collection = images × 0.300195
           + images × 500 × 0.00000375
           + references × 10 000 × 0.000006
           + 0.02016
```

Допущения: 500 prompt tokens на image-попытку; до одного reference на запрос, резерв 10 000 image-input tokens. Для пяти mobile нужны пять references; четыре дополнительные попытки могут добавить ещё четыре. Для текста заложены две попытки, каждая до 16 000 суммарных input tokens и 8192 output tokens, включая reasoning. Это расчётные значения, не замеры и не гарантированный предел токенов image API.

| Сценарий | Images | References | Pollen на коллекцию | Четыре коллекции в месяц | Денежные платежи |
| --- | --- | --- | --- | --- | --- |
| Исходные десять вариантов | 10 | 5 | 3,34086 | 13,36344 | $0 при Quest-only |
| Четыре дополнительные попытки | 14 | 9 | 4,78914 | 19,15656 | $0 при Quest-only |

Четыре коллекции означают 40 исходных image-попыток или максимум 56 с правками. Неудачные и неопределённые попытки расходуют локальный потолок попыток; credits учитываются по подтверждённым данным сервиса. Возврат за отклонённую владельцем картинку не предполагается.

Потолки 10/40 Pollen ограничивают выдачу новых запросов. Provider estimate может отличаться от окончательного списания и временно сделать Quest-баланс отрицательным. Key budget и локальная оценка не гарантируют абсолютный предел уже отправленного запроса. Если расход нельзя оценить и зарезервировать, запрос не отправляется. Фактическое превышение фиксируется и блокирует продолжение. Денежный $0 обеспечивается Quest-only без покупки и paid fallback.

## Права и публикация

[Лицензия сайта](../frontend/src/data/legal.ts) разрешает посетителям личное некоммерческое использование и crop; запрещает продажу, распространение пакетов и присвоение авторства. Текст лицензии не меняется. До выпуска требуется подтверждённое право размещать PNG, предоставлять их посетителям и публиковать previews.

[Upstream Services Agreement](https://openai.com/policies/services-agreement/) распределяет права на output между OpenAI и Customer в пределах применимого права. Это не подтверждает передачу прав от посредника клиенту Pollinations, эксклюзивность или отсутствие чужих прав. [Условия Pollinations](https://github.com/pollinations/pollinations/blob/f3ff75164d38b3aaec8ac0f0e3d377101558f541/pollinations.ai/public/legal/TERMS_OF_SERVICE.md) сохраняют права на Customer Data и требуют проверки лицензий моделей; явный grant для выдачи этих PNG посетителям в проверенном тексте не найден. **Публикация новых результатов через #29 заблокирована до документированного подтверждения достаточных прав по договору сервиса.** Частный draft и техническая приёмка #26 не разрешают публикацию.

Чужие защищённые персонажи, логотипы, персональные данные и узнаваемые лица без необходимых прав не используются. Обязательные content credentials, водяные знаки и metadata сохраняются. Требования маркировки не обходятся ложным указанием авторства; конфликт с правилами проекта блокирует соответствующую отправку.

| Канал | Проверенные ограничения |
| --- | --- |
| Telegram, #30 | Собственный канал, права на previews; запрет spam/scam, copyright complaints для публичных каналов. [ToS](https://telegram.org/tos), [FAQ](https://telegram.org/faq#q-a-bot-or-channel-is-infringing-on-my-copyright-what-do-i-do) |
| Pinterest, #31 | Права на контент; анализ IPTC metadata и автоматический Gen AI label. Metadata не удаляются ради обхода label. [Copyright](https://help.pinterest.com/en/article/copyright), [labels](https://help.pinterest.com/en/article/gen-ai-labels) |
| Tumblr, #32 | Copyright и запрет spam; достаточные права для размещения и лицензии платформе проверяются до запуска. [Community Guidelines](https://github.com/tumblr/policy/blob/master/user-guidelines.txt) |
| DeviantArt, #33 | Поле `Created using AI tools` при submission, правила применения и автоматический label по metadata. Ложный ответ запрещён; конфликт с правилами проекта блокирует канал. [Правило](https://www.deviantartsupport.com/kb/en/article/what-does-created-using-ai-tools-mean) |
| Flickr, #34 | Обязательны Safety Level/Content Type; рекомендован Art/Illustration. Free accounts публикуют только Safe content. Commercial promotion регулируется отдельно; применимость к ссылкам на сайт с рекламой не подтверждена. [Filters](https://www.flickrhelp.com/hc/en-us/articles/4404064206996-Flickr-Content-Filters), [Commercial Use](https://www.flickrhelp.com/hc/en-us/articles/4404057965332-Flickr-Commercial-Use-Policy) |

Account approvals, OAuth и текущие upload/API requirements проверяются отдельно в #30-#34. На каналы отправляются faithful previews с canonical ссылками; новые полные оригиналы требуют отдельного разрешения.

## Приватное подключение в #26

Владелец согласовал порядок; provisioning ещё не выполнено:

1. Приватно создать аккаунт Pollinations, проверить условия и получить Quest Pollen допустимым способом. Paid Pollen и платные сервисы не подключать.
2. Создать отдельный Secret Key: `type=secret`, `questPollenOnly=true`, `allowedModels=["openai/gpt-image-2", "openai/gpt-5.4-nano"]`, `pollenBudget=40`. Account permissions оставить пустыми. Категории `image`/`text`, unlimited и разрешение создавать ключи не нужны.
3. Приватно проверить `GET /account/key`: активный secret key, Quest-only, точный allowlist, конечный budget. Собственная история доступна через `GET /account/key/usage`. Key info, account IDs и usage не публиковать.
4. Создать Header Auth в локальных n8n Credentials: `Authorization: Bearer <private key>`. Использовать HTTPS и фиксированный origin сервиса. Key не помещать в query string, workflow JSON, Git, GitHub secrets, shell arguments, отчёты или чат.
5. В #26 исключить secret-bearing headers и полный raw response из execution history. Сохранять приватные checkpoints/receipts и локальный review package; не экспортировать расшифрованные credentials. Проверка соединения не запускает генерацию.

`pollenBudget=40` означает оставшийся бюджет ключа, а не возобновляемый месячный лимит. Счётчик UTC хранится в долговременном journal #26. Замена ключа не обнуляет расход коллекции/месяца. Исчерпание key budget требует явного приватного действия владельца; автоматического пополнения нет. [Key contract](https://github.com/pollinations/pollinations/blob/f3ff75164d38b3aaec8ac0f0e3d377101558f541/APIDOCS.md).

## Контракт workflow #26

- Пять `POST /v1/images/generations` для desktop и пять `POST /v1/images/edits` с reference для mobile. Явные model ID, `n=1`, `size`, `quality=high`, `response_format=b64_json`. Multipart editing передаёт bytes без публичной CDN-публикации reference.
- Text/vision через `POST /v1/chat/completions` с готовыми изображениями и лимитом output. Одна исходная попытка и один text retry/revision расходуют общий budget. Проверить существующий manifest contract, en/ru/zh-cn/pt-br, taxonomy, стабильные ID/filenames и отдельный сюжет по [инструкции каталога](../.agents/skills/release-collection/references/catalogue.md). Текст на самих обоях не нужен.
- Перед запросом проверить key restrictions, бесплатный бюджет, модели и стоимость. Выполнять запросы последовательно; до отправки сохранить attempt identity и резерв коллекции/месяца в долговременном journal. Учитывать actual usage и неопределённые резервы.
- Хранить run/design/variant/attempt IDs, payload hash, receipt/usage и result hash. Restart/sleep не дублирует сохранённый вариант. Одинаковый seed или generic retry не доказывает идемпотентность.
- Подтверждённую ошибку можно повторить при оставшихся attempts/budget. `429`/`503` требуют backoff с `Retry-After`; `401`/`403`/`402`, quota/budget, validation и moderation останавливают workflow до исправления. Prompt не меняется для обхода moderation.
- Timeout оставляет `unknown`: сохраняются резерв и попытка, сверяются provider usage/receipt. Если результат не установлен, остановиться для приватной проверки без новой генерации. Общий cache/retry contract не заменяет подтверждения безопасности конкретного endpoint.
- Отмена прекращает новые запросы; отправленный запрос может завершиться и списать credits. Сверить результат и сохранить расход. Cancellation/rejection/revision/смена ключа не обнуляют лимиты; refund и удалённая отмена не гарантированы.
- Недостаток Quest Pollen, `402`, исчерпание attempts/key budget/10/40 Pollen сохраняют частный draft и останавливают workflow. Продолжение не сбрасывает историю; paid fallback и auto top-up исключены.
- До owner approval декодировать десять PNG, проверить native размеры/ratio, пары, содержание, четыре локали и metadata. Здесь API не документирует отдельный `output_format` selector: его нельзя выдумывать. Неверный формат/размер/композиция останавливает draft; переименование и upscale не считаются исправлением.

## Приёмка и границы доказательств

Для #20 проверены документация, выбор владельца, тарифы и арифметика. Публичные API сайта и runtime не меняются. Документы проходят Standards/Spec review и обычный PR CI.

В #26 нужны deterministic fixtures: десять PNG/пять пар/четыре локали, попытка 15, отказ Quest-only, смена тарифа/`paid_only`, неверный allowlist, budget exhaustion, отмена, timeout/unknown, restart без дублей и invalid bytes/размеры. Реальный draft проверяется после provisioning в пределах бесплатного баланса. Native PNG и качество конкретного аккаунта пока не подтверждены. Выпуск и внешние отправки требуют устранения ограничений прав и каналов выше.
