# Discord Image-Ping Guard

Русская версия README есть ниже: [🇷🇺 Русский, человеческий](#-русский-человеческий)

## What it does

`discord-image-ping-guard` is a small Discord moderation bot for image-based mass-ping spam from compromised accounts.

It does not ban users. It deletes matching messages, applies a Discord timeout of up to 28 days, stores incidents in SQLite, and sends a compact moderation log embed to a configured mod-log channel.

Normal user mentions are ignored.

System requirement: Node.js 22+

## Detection rule

The bot triggers only when all of these are true:

- The message contains `@everyone`, `@here`, or a mass role mention.
- The message contains at least one image attachment.
- The message has little or no real text after mentions and whitespace are removed.

Mass roles are detected by coverage ratio or by explicit `FORCED_MASS_ROLE_IDS`.

## Installation

```bash
npm install
cp .env.example .env
nano .env
npm start
```

## Tests

```bash
npm test
```

The test suite uses the built-in Node.js test runner only. It does not connect to Discord and does not need a bot token.

## Discord permissions

The bot needs:

- View Channels
- Read Message History
- Send Messages in the moderation log channel
- Embed Links
- Manage Messages
- Moderate Members

Enable these privileged intents in the Discord Developer Portal:

- Message Content Intent
- Server Members Intent

## Configuration

```env
DISCORD_TOKEN=
MOD_LOG_CHANNEL_ID=

TIMEOUT_DAYS=28
MASS_ROLE_THRESHOLD=0.30
MAX_CLEAN_TEXT_LENGTH=20

FORCED_MASS_ROLE_IDS=
BYPASS_ROLE_IDS=
IGNORED_CHANNEL_IDS=
SAFE_CHANNEL_IDS=

AUTO_SAFE_CHANNELS=false
AUTO_SAFE_MAX_WRITERS_RATIO=0.10
AUTO_SAFE_MIN_MEMBERS_TO_CHECK=50
AUTO_SAFE_CACHE_TTL_SECONDS=300
DEBUG_SAFE_CHANNELS=false

DEBUG_ROLE_COVERAGE=false
DEBUG_LOG_DETAILS=false

MEMBER_FETCH_TTL_SECONDS=300
MEMBER_FETCH_CACHE_FULL_RATIO=0.90

DATABASE_PATH=./data/bot.sqlite
```

Key notes:

- `TIMEOUT_DAYS` is clamped to Discord's 28-day maximum.
- `FORCED_MASS_ROLE_IDS`, `BYPASS_ROLE_IDS`, `IGNORED_CHANNEL_IDS`, and `SAFE_CHANNEL_IDS` are comma-separated channel or role ID lists.
- `DEBUG_LOG_DETAILS=false` keeps the moderation embed compact by hiding filename samples and other debug-only details.
- `FORCED_MASS_ROLE_IDS` is the most reliable override for important announcement roles and small servers.

## Safe channels

Manual `SAFE_CHANNEL_IDS` is recommended for announcement and news channels. That is the safest production default.

`AUTO_SAFE_CHANNELS` is optional. When enabled, the bot estimates how many real non-bot members can send messages in a channel:

- If the writer ratio is low enough, the channel is treated as safe.
- Example: `1` writer out of `5` real members is `0.20`.
- With `AUTO_SAFE_MAX_WRITERS_RATIO=0.30`, that channel is considered safe.

Small-server testing tips:

- Use `AUTO_SAFE_MIN_MEMBERS_TO_CHECK=1` for testing.
- Use `AUTO_SAFE_MAX_WRITERS_RATIO=0.30` only when you intentionally want a looser threshold.
- Enable `DEBUG_SAFE_CHANNELS=true` and `DEBUG_ROLE_COVERAGE=true` while tuning.

Production tips:

- Keep `AUTO_SAFE_CHANNELS=false` unless you want permission-based detection.
- Use `AUTO_SAFE_MIN_MEMBERS_TO_CHECK=10` or `50` in real servers.
- Do not set `AUTO_SAFE_MAX_WRITERS_RATIO` too high.

## Running on a VPS

Basic VPS flow:

```bash
npm install
cp .env.example .env
nano .env
npm start
```

PM2 example:

```bash
npm install -g pm2
pm2 start src/index.js --name discord-image-ping-guard
pm2 save
pm2 startup
```

The repo also includes `.nvmrc` with Node `22`.

## Troubleshooting

Message deleted but no timeout:

- The bot role must be above the target member's roles.
- The bot needs `Moderate Members`.

Bot does nothing:

- Check that Message Content Intent is enabled.
- Check that Server Members Intent is enabled.
- Check that the bot token is correct.
- Check that the bot has the required guild permissions.

Safe channel not working:

- Add the channel ID to `SAFE_CHANNEL_IDS`.
- Restart the bot after changing `.env`.
- If using automatic safe channels, enable `DEBUG_SAFE_CHANNELS=true` and verify the writer ratio.

Role not considered mass:

- Add the role ID to `FORCED_MASS_ROLE_IDS`.
- Or enable `DEBUG_ROLE_COVERAGE=true` and inspect the coverage line.

Member fetch and rate limits:

- The bot uses a shared guild-member fetch cache to avoid repeated fetches.
- If your server is small or unusual, `FORCED_MASS_ROLE_IDS` is often the simplest reliable option.

---

# 🇷🇺 Русский, (человеческий)

## Зачем это нужно

Вам прилетает пинг с вложенной картинкой, текста почти нет, и вы уже знаете: это не админ, не мем, а очередной угнанный аккаунт, который раздаёт подарки от мистера Биста, которого никто не звал.

Этот бот не предупреждает и не банит. Он просто вытирает это дерьмо, отправляет юзера в таймаут на срок до 28 дней и аккуратно записывает инцидент в SQLite и мод лог. На обычные упоминания людей он не реагирует.

## Как работает это 8 чудо света

Сообщение удаляется, а юзер получает таймаут только если выполнены все условия:

- В сообщении есть `@everyone`, `@here` или пинг массовой роли .
- В сообщении есть хотя бы одна картинка.
- После вырезания упоминаний и пробелов остаётся пустота или почти пустота.

Массовые роли определяются либо по проценту покрытия сервера, либо вручную через список `FORCED_MASS_ROLE_IDS`.

## Установка и запуск

```bash
npm install
cp .env.example .env
nano .env
npm start
```

## Права бота в Discord

Боту нужны права:

- Читать каналы и историю сообщений
- Отправлять сообщения в мод-лог
- Embed Links
- Управлять сообщениями
- Модерировать участников, то есть выдавать таймауты

Обязательно включите Privileged Intents в Discord Developer Portal:

- Message Content Intent
- Server Members Intent

## Конфиг: коротко о важном

```env
DISCORD_TOKEN=
MOD_LOG_CHANNEL_ID=

TIMEOUT_DAYS=28
MASS_ROLE_THRESHOLD=0.30
MAX_CLEAN_TEXT_LENGTH=20

FORCED_MASS_ROLE_IDS=
BYPASS_ROLE_IDS=
IGNORED_CHANNEL_IDS=
SAFE_CHANNEL_IDS=
```

`TIMEOUT_DAYS` — сколько дней пользователь будет сидеть в таймауте. Максимум Discord — 28 дней.

`FORCED_MASS_ROLE_IDS` — сюда заносятся роли, которые вы считаете массовыми. Например: `@all`, `@members`, `@announcements`. Это самый надёжный способ на небольших серверах.

`SAFE_CHANNEL_IDS` — каналы, в которых бот ничего не трогает. Например: новости и анонсы.

`BYPASS_ROLE_IDS` — роли, которые могут отправлять такие сообщения без последствий.

`IGNORED_CHANNEL_IDS` — каналы, в которых бот полностью молчит.

## Безопасные каналы

Лучше всего вручную занести ID новостных и анонсных каналов в `SAFE_CHANNEL_IDS`.

Автоматический режим `AUTO_SAFE_CHANNELS` умеет считать соотношение людей, которые могут писать в канал, к общему числу участников. Если канал выглядит как «один админ постит, остальные читают», он считается безопасным.

Но для продакшена самый спокойный вариант — держать:

```env
AUTO_SAFE_CHANNELS=false
```

и вручную указывать безопасные каналы через:

```env
SAFE_CHANNEL_IDS=
```

## Запуск на VPS

```bash
npm install
cp .env.example .env
nano .env
npm start
```

PM2:

```bash
npm install -g pm2
pm2 start src/index.js --name discord-image-ping-guard
pm2 save
pm2 startup
```

## Частые проблемы

Сообщение удалилось, а таймаута нет:

- Роль бота должна быть выше роли нарушителя.
- У бота должно быть право `Moderate Members`.

Бот вообще молчит:

- Проверьте, что Message Content Intent включён в панели разработчика.
- Проверьте, что Server Members Intent включён в панели разработчика.
- Проверьте токен бота.
- Проверьте права бота на сервере.

Безопасный канал не работает:

- Добавьте ID канала в `SAFE_CHANNEL_IDS`.
- Перезапустите бота после изменения `.env`.

Роль не считается массовой:

- Добавьте ID роли в `FORCED_MASS_ROLE_IDS`.
- Или включите `DEBUG_ROLE_COVERAGE=true` и посмотрите строку покрытия роли в консоли.

## Лицензия

Делайте что хотите, только не продавайте мне обратно мой же код.
