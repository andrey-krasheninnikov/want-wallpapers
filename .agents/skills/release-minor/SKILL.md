---
name: release-minor
description: Создавать minor-релиз Want Wallpapers из origin/development с minor-инкрементом, patch 0 и полным production pipeline full через release PR, protected tag и обратный merge main в development.
---

# Minor-релиз с full pipeline

Используйте для запроса minor/full выпуска `andrey-krasheninnikov/want-wallpapers`. Для новой коллекции из CDN применяйте `$release-collection`.

Прочитайте и выполните [общую процедуру release-feature](../release-feature/SKILL.md) со следующими параметрами:

- База release-ветки и источник состава выпуска: подтверждённый `origin/development`. Указанную пользователем feature-ветку сначала проведите через feature-этап общей процедуры.
- Версия: minor-инкремент согласованной стабильной версии main и тега, patch `0`, например `1.8.2` становится `1.9.0`. Для возобновления восстановите уже выбранную версию.
- Профиль: `full`, включая Full UI/E2E. Не заменяйте его на fast ради прохождения проверки; protected tag, backup/restore и deployment gates обязательны.

Пройдите весь порядок до подтверждённого deployment, обратного merge и GitHub Release. Разрешения берите из запроса конкретного выпуска; запрос подготовить план или изменить skill не разрешает выполнять релиз.
