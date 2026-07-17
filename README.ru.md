# PingGuard

PingGuard — бесплатный Discord-бот для защиты серверов от визуального спама с массовыми пингами. Он ищет сообщения, где `@everyone`, `@here` или защищенная роль сочетаются с картинками, GIF, видео, стикерами или embed-изображениями и почти без осмысленного текста.

Пример угрозы: взломанный аккаунт отправляет массовый пинг с картинкой про розыгрыш и без нормального объяснения. PingGuard может удалить сообщение, применить настроенное наказание, сохранить инцидент и отправить безопасный модераторский лог.

## Возможности

- Один публичный Discord-бот для многих серверов.
- Настройка через `/guard` и компоненты Discord.
- Отдельные настройки, роли, политики каналов, доверенные акторы, инциденты и аудит для каждого сервера.
- PostgreSQL и Drizzle ORM.
- Проверка обычных пользователей, других ботов и вебхуков; игнорируются только собственные сообщения PingGuard.
- Нет автоматического обхода для владельца сервера или администраторов.
- Нет AI, OCR, скачивания вложений и хранения текста сообщений.
- Развертывание через Docker Compose.

## Что не входит в v2

- Веб-панель.
- Redis и преждевременный шард manager.
- Автоматическое определение безопасных анонс-каналов.
- SQLite в production.

## Права и intents

PingGuard не требует Administrator.

Минимальные intents:

- Guilds
- Guild Messages
- Message Content

В Discord Developer Portal включите Message Content Intent. Server Members Intent не нужен.

Права бота зависят от политики:

- View Channels
- Read Message History
- Send Messages и Embed Links в канале мод-лога
- Manage Messages
- Moderate Members для таймаутов
- Kick Members или Ban Members только если вы явно включили такие наказания

## Локальный запуск

Нужен Node.js 24 LTS.

```bash
npm ci
cp .env.example .env
npm run db:migrate
npm run commands:dev
npm run dev
```

## Тесты

```bash
npm test
npm run test:coverage
```

Тесты используют моки и фейковые адаптеры. Они не заходят в Discord и не требуют настоящего токена.

## Docker

```bash
cp .env.example .env
docker compose up -d --build
```

PostgreSQL находится только во внутренней сети Compose. Caddy отдает статический сайт и проксирует health endpoints.

## Конфиденциальность

PingGuard хранит только Discord ID и метаданные инцидентов. Он не хранит текст сообщений, нормализованный текст, имена пользователей, аватары, URL вложений, URL embed, изображения, видео, GIF, стикеры или списки участников.

Владелец сервера может выполнить `/guard data export` или `/guard data delete`.

## Поддержка

- Сервер поддержки: `https://discord.gg/your-support-server`
- GitHub: `https://github.com/aglvetik/MrBeast_Hater`

## Лицензия

MIT. См. [LICENSE](LICENSE).
