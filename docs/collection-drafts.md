# Приватные черновики коллекций

[Задача #26](https://github.com/andrey-krasheninnikov/want-wallpapers/issues/26) использует локальный n8n и отдельный Bun/SQLite сервис. Десять оригинальных PNG, previews, manifest и журнал находятся в `generation/` существующего n8n volume. Helper получает только этот подкаталог и не имеет опубликованного порта. n8n ограничен 1 CPU/1 GiB, helper 1 CPU/768 MiB. Оригиналы не масштабируются и сохраняют исходные bytes; уменьшенные WebP нужны для просмотра. Бинарные HTTP-ответы n8n передаются через файловое хранилище в его volume, чтобы большой пакет не превращался в base64 в памяти. Backup включает эти файлы; следите за свободным местом.

## Регистрация и бесплатный баланс

1. Откройте [Pollinations dashboard](https://enter.pollinations.ai/), создайте аккаунт или войдите предложенным сервисом способом. Проверьте действующие условия в своём аккаунте.
2. Откройте [Quests](https://enter.pollinations.ai/quests), выберите доступное бесплатное задание, выполните требования и получите reward через Claim. Доступность заданий, проверка вклада и награды зависят от сервиса. Регистрация сама по себе не подтверждает достаточный баланс. [Официальный FAQ](https://github.com/pollinations/pollinations/blob/f3ff75164d38b3aaec8ac0f0e3d377101558f541/enter.pollinations.ai/POLLEN_FAQ.md).
3. В [Pollen](https://enter.pollinations.ai/pollen) проверьте именно Quest Pollen. Нужен запас на запросы; расчёт исходных десяти вариантов около 3,34 Pollen, с четырьмя дополнительными около 4,79. Фактический расход отличается. Покупки, подписки, paid fallback и платные задания не входят в согласованный запуск. Если бесплатного баланса нет, остановитесь на этом шаге.
4. В разделе API keys создайте отдельный Personal Secret Key для коллекций. Настройки: Quest-only (`questPollenOnly=true`), два разрешённых model ID `openai/gpt-image-2` и `openai/gpt-5.4-nano`, budget 40 Pollen, account permissions пустые. Unlimited и категории image/text не подходят. Если UI не позволяет выставить эти ограничения, не запускайте генерацию.
5. Сохраните ключ приватно в password manager. Передайте его только в Header Auth credential локального n8n, как описано ниже. Не отправляйте ключ в чат, Git, workflow JSON или shell arguments.

Лимиты и ограничения прав описаны в [решении по провайдеру](generation-provider.md). Результаты остаются приватными. Одобрение содержания не разрешает публичную публикацию: подтверждение достаточных прав сервиса остаётся отдельным условием #29.

## Подготовка локального n8n

Нужны Bun 1.3.14, Docker Desktop и уже созданный owner account по [инструкции n8n](local-n8n.md). Перед Docker проверьте `docker context show`, `docker system df` и свободное место. Не удаляйте рабочий volume.

Из корня checkout:

```bash
make n8n-backup
make generation-config
make generation-init
make generation-up
```

`generation-init` создаёт приватный подкаталог и случайный локальный access token, сохраняя существующие данные. `generation-up` включает оба сервиса с лимитами ресурсов. Backup содержит секреты и остаётся вне Git.

В Credentials на `http://localhost:5678` создайте три записи:

- Header Auth, имя `Collection draft store`: header `Authorization`. Значение получите только в своём приватном терминале следующей командой, которая копирует его в clipboard без вывода. Вставьте в credential value.
- Header Auth, имя `Collection draft provider`: header `Authorization`, value `Bearer ` и ваш Secret Key Pollinations. Не используйте publishable key.
- Basic Auth, имя `Collection draft owner`: отдельные username и сильный password для форм и оригиналов. Это отдельная пара от owner account редактора n8n.

```bash
docker compose -f automation/n8n/compose.yaml -f automation/n8n/generation.compose.yaml exec -T draft-store bun -e 'process.stdout.write("Bearer " + require("fs").readFileSync("/state/access-token", "utf8").trim())' | pbcopy
```

После вставки очистите clipboard: `printf '' | pbcopy`. Не запускайте clipboard-команду в общей терминальной сессии или при записи экрана. Не экспортируйте расшифрованные Credentials.

Откройте каждую credential в UI и возьмите её ID из адреса `/home/credentials/<ID>`. ID не является значением ключа. Подставьте три ID в команду экспорта в порядке store/provider/owner:

```bash
bun frontend/scripts/generation-workflows.ts /private/tmp/collection-drafts.json STORE_ID PROVIDER_ID OWNER_ID
```

Файл содержит четыре неактивных workflow и ссылки на Credentials. Если в n8n уже есть `CollectionDraftStart`, `CollectionDraftReview`, `CollectionDraftAdvance` или `CollectionDraftMedia`, сначала сравните их и сохраните backup: импорт с одинаковыми ID заменяет workflow. Не импортируйте поверх чужих изменений.

Остановите оба сервиса, импортируйте файл и опубликуйте каждый workflow через CLI:

```bash
make generation-stop
docker compose -f automation/n8n/compose.yaml -f automation/n8n/generation.compose.yaml run --rm --no-deps -T --volume /private/tmp/collection-drafts.json:/setup/workflows.json:ro --entrypoint n8n n8n import:workflow --input=/setup/workflows.json
for id in CollectionDraftStart CollectionDraftReview CollectionDraftAdvance CollectionDraftMedia; do
  docker compose -f automation/n8n/compose.yaml -f automation/n8n/generation.compose.yaml run --rm --no-deps -T --entrypoint n8n n8n publish:workflow --id="$id"
done
make generation-up
```

CLI публикация включает локальные triggers и требует перезапуска n8n; она не публикует коллекцию. [Документация CLI](https://docs.n8n.io/hosting/cli-commands/). После импорта удалите свой временный JSON. Workflow generation builder остаётся источником экспорта в Git.

## Запрос и проверка

Откройте `http://localhost:5678/form/collection-draft-start`, введите отдельный Basic Auth, затем ID `0006-something` и тему `Черный фон, абстракция по центру`. ID остаётся приватным и не резервируется в каталоге.

`http://localhost:5678/form/collection-draft-review` принимает ID коллекции. Страница показывает состояние, расход/резерв, попытки, все переводы и доступные пары. Polling раз в минуту отправляет один запрос. Сначала готовится план пяти сцен и тексты, затем пять desktop и пять mobile с desktop reference. Композицию и переводы проверяет владелец. После изменения desktop нужно снова проверить всю пару.

Доступны одобрение, правки выбранных вариантов/текстов, отклонение, отмена и возобновление. Для одобрения требуется отметка проверки содержания и точные version/packageHash. Правка увеличивает version и снимает одобрение; старая форма получает 409. Скачать tar можно только для текущего одобренного пакета. Он содержит manifest, десять PNG, checksums и approval с `publicationAllowed=false`. Импорт в каталог, CDN и внешние отправки здесь отсутствуют.

Две text-попытки и четырнадцать image-попыток включают ошибки; дополнительные изображения ограничены четырьмя на коллекцию. Четыре начатые коллекции за месяц UTC учитывают отменённые. Бюджеты 10/40 Pollen включают подтверждённые списания и неопределённые резервы. Новые ключи не сбрасывают журнал. Используйте ключ только для этого workflow: посторонняя активность блокирует сверку расходов.

## Остановки и восстановление

`make generation-stop` останавливает оба сервиса. Во время внешнего запроса отмена не отменяет уже отправленную работу провайдера; ответ и расход сохраняются, продолжение требует решения владельца.

Подтверждённые 429/503 повторяются после bounded Retry-After в пределах attempts/budget. Другие provider, contract, validation и budget ошибки показываются как blocked. Возобновите только после устранения причины. Sleep/restart сохраняет журнал. Pending после перезапуска и timeout становятся unknown; workflow не отправляет запрос повторно. Если ответ уже сохранён, polling сверяет собственную usage history и применяет его без новой генерации. Если ответ потерян, нужен разбор с провайдером; кнопка «Возобновить» не снимает unknown. Не удаляйте journal, не подделывайте receipts и не обнуляйте резерв.

`make n8n-backup` останавливает только ранее работавшие n8n/draft-store, сохраняет весь volume и возобновляет те же сервисы. Recovery выполняется в новый volume по [инструкции](local-n8n.md). Остановите исходную установку до запуска восстановленной и используйте `generation-up` с выбранным `N8N_DATA_VOLUME`, чтобы включить helper. Две установки не должны использовать один provider key одновременно.

## Проверки

`make test-generation` проверяет private API, approval/revisions/отмену, лимиты, invalid output и восстановление. Изолированный n8n использует синтетические Credentials и provider без внешней сети; контейнеры ограничены по CPU/RAM. Тест удаляет свои контейнеры, тома и временные файлы после успеха, ошибки или SIGTERM/SIGINT. При жёстком завершении сначала проверьте остатки проекта `want-wallpapers-n8n-generation-*`; удаляйте только подтверждённые тестовые ресурсы. Рабочий n8n, чужие тома, images и build cache сохраняются.

Fixtures не доказывают нативный PNG, доступность моделей, списание или визуальное качество реального аккаунта. Реальный draft требует приватного provisioning и отдельной проверки владельцем; до неё приёмка #26 остаётся неполной.
