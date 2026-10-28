---
name: release-patch
description: Создавать patch-релиз Want Wallpapers из origin/development с patch-инкрементом и быстрым production pipeline fast через release PR, protected tag и обратный merge main в development.
---

# Patch-релиз с fast pipeline

Используйте для запроса patch/fast выпуска `andrey-krasheninnikov/want-wallpapers`. Для новой коллекции из CDN применяйте `$release-collection`.

Прочитайте и выполните [общую процедуру release-feature](../release-feature/SKILL.md) со следующими параметрами:

- База release-ветки и источник состава выпуска: подтверждённый `origin/development`. Указанную пользователем feature-ветку сначала проведите через feature-этап общей процедуры.
- Версия: patch-инкремент согласованной стабильной версии main и тега, например `1.8.2` становится `1.8.3`. Для возобновления восстановите уже выбранную версию.
- Профиль: `fast`. Пропускается только Full UI/E2E; остальные проверки, protected tag, backup/restore и deployment gates обязательны.

Пройдите весь порядок до подтверждённого deployment, обратного merge и GitHub Release. Разрешения берите из запроса конкретного выпуска; запрос подготовить план или изменить skill не разрешает выполнять релиз.

Удалите remote release-ветку сразу после подтверждённого merge в `main` по разделу 2 общей процедуры. Не откладывайте cleanup до deployment или GitHub Release; сохраняйте теги и ветки с непринятыми коммитами или открытыми зависимыми PR.
