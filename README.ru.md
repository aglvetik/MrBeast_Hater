# PingGuard

PingGuard - это Discord-бот для сдерживания визуальных mass-ping атак. Он рассчитан на ситуацию, когда легитимный анонс и первое сообщение атаки выглядят почти одинаково:

```text
@everyone или @here
+ картинка / GIF / видео / стикер / embed image
+ мало или совсем нет осмысленного текста
```

Главное изменение:

- первое подозрительное сообщение обычно удаляется без долгого наказания;
- повторное коррелированное сообщение быстро подтверждает атаку;
- разрешенные издатели задаются по области действия, а не глобально;
- явные исключения всегда имеют приоритет.

## Поведение по умолчанию

Preset `BALANCED`:

- первое подозрительное сообщение обычного участника: `DELETE_ONLY`
- первое сообщение разрешенного издателя в нужном месте: `ALLOW` + краткоживущий candidate
- второе коррелированное сообщение: `ENFORCE`
- при активной raid session похожие сообщения усиливаются, но `IGNORE_ALL`, `MONITOR_ONLY`, `NO_PUNISH` и `FULL_BYPASS` продолжают ограничивать действия

## Основные команды

- `/guard setup`
- `/guard status`
- `/guard publishers add|remove|list`
- `/guard exceptions add|remove|list`
- `/guard channels set|remove|list`
- `/guard roles add|remove|list|mode|risk`
- `/guard detection preset|first-strike|thresholds`
- `/guard raid status|stop`
- `/guard incidents recent|user|explain|stats`

## Конфиденциальность

PingGuard не хранит:

- исходный текст сообщений
- normalized text
- URL вложений
- скачанные изображения и видео

PingGuard хранит:

- Discord ID
- классы упоминаний
- hashes / fingerprints
- результаты действий модерации
- временные correlation / raid записи
- агрегированные activity buckets

Подробности: [PRIVACY.md](PRIVACY.md)
