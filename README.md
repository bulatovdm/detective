# Detective

MCP-сервер для LLM-driven runtime-дебага PHP-приложений. LLM ставит breakpoints, выполняет запрос, получает полный snapshot переменных/стека/ошибок за один проход.

## Как это работает

```
Claude Code ──stdio──► Detective MCP ──TCP──► Xdebug (PHP)
                            │
                            └──HTTP──► PHP App
```

1. LLM вызывает tool `debug_request` с URL и breakpoints
2. Detective открывает TCP-сервер, отправляет HTTP-запрос к приложению
3. Xdebug подключается, Detective ставит breakpoints и выполняет `run`
4. На каждом breakpoint собирается stack trace + локальные переменные
5. Результат возвращается как текстовый snapshot

## Установка

```bash
cd detective
npm install
npm run build
```

## Подключение к проекту

```bash
./scripts/link.sh link /path/to/project https://myapp.local
```

Скрипт:
- Добавит `detective` в `.mcp.json` проекта
- Создаст `detective.json` с базовой конфигурацией
- Создаст `detective.local.json` (шаблон для кредов) и добавит его в `.gitignore`

Подкоманды:
```bash
./scripts/link.sh link <path> [app-url]   # подключить
./scripts/link.sh unlink <path>           # отключить
./scripts/link.sh status <path>           # проверить статус
```

## Настройка Xdebug

### Локальный PHP

```ini
[xdebug]
xdebug.mode = debug
xdebug.start_with_request = yes
xdebug.client_host = 127.0.0.1
xdebug.client_port = 9003
```

### OrbStack

```ini
[xdebug]
xdebug.mode = debug
xdebug.start_with_request = yes
xdebug.client_host = host.orb.internal
xdebug.client_port = 9003
```

### Docker

```ini
[xdebug]
xdebug.mode = debug
xdebug.start_with_request = yes
xdebug.client_host = host.docker.internal
xdebug.client_port = 9003
```

## detective.json

Создаётся в корне проекта.

### Локальный PHP

```json
{
  "adapter": "php",
  "app": {
    "url": "http://localhost:8000"
  }
}
```

### OrbStack / Docker (пути совпадают)

```json
{
  "adapter": "php",
  "app": {
    "url": "https://myapp.local"
  },
  "php": {
    "xdebug": {
      "host": "0.0.0.0",
      "port": 9003,
      "ideKey": "IDE"
    }
  }
}
```

### OrbStack / Docker (пути отличаются)

```json
{
  "adapter": "php",
  "app": {
    "url": "https://myapp.local"
  },
  "php": {
    "xdebug": {
      "host": "0.0.0.0",
      "port": 9003
    }
  },
  "pathMapping": {
    "/var/www/app": "/Users/dima/projects/myapp"
  }
}
```

### Все параметры

```json
{
  "adapter": "php",
  "app": {
    "url": "https://myapp.local",
    "basePath": ""
  },
  "php": {
    "xdebug": {
      "host": "0.0.0.0",
      "port": 9003,
      "ideKey": "detective"
    },
    "binary": "php",
    "artisanPath": "./artisan",
    "cli": {
      "exec": "{command}"
    }
  },
  "pathMapping": {},
  "defaults": {
    "maxDepth": 3,
    "maxDataSize": 65536,
    "maxChildren": 128,
    "timeout": 30,
    "maxResponseBodyLength": 10000
  },
  "skipTlsVerification": true
}
```

## Авторизация

Если приложение закрыто аутентификацией, защищённые URL вернут 401 и брейкпоинты внутри
контроллера не сработают. Настрой секцию `auth` — Detective сам получит доступ.

Креды кладутся в **`detective.local.json`** — он лежит рядом с `detective.json`, автоматически
подмешивается поверх него и добавляется в `.gitignore` при `link.sh link`.

### Вход по форме

```jsonc
{
  "auth": {
    "type": "form",
    "url": "/api/login",
    "method": "POST",
    "credentials": { "login": "user", "password": "secret" },
    "cookieNames": ["session"]
  }
}
```

Detective логинится один раз, кеширует куку и подставляет её во все последующие запросы.
`cookieNames` — какие куки из ответа оставить (пусто = все).

### API-ключ в заголовке

```jsonc
{
  "auth": {
    "type": "header",
    "header": "X-Auth-Token",
    "valueEnv": "DETECTIVE_TOKEN"
  }
}
```

`valueEnv` читает значение из переменной окружения, `value` задаёт его напрямую.

### Несколько аутентификаторов сразу

Если приложение закрыто двумя механизмами одновременно (типичный случай — nginx basic auth
поверх сессии приложения), `auth` принимает массив. Заголовки всех аутентификаторов
складываются, куки сливаются:

```jsonc
{
  "auth": [
    { "type": "header", "header": "Authorization", "valueEnv": "BASIC_AUTH" },
    {
      "type": "form",
      "url": "/api/login",
      "credentials": { "login": "user", "password": "secret" },
      "cookieNames": ["session"]
    }
  ]
}
```

Каждый `form`-вход кешируется отдельно (по своему `url`), так что логин выполняется один раз
на аутентификатор.

### Разовая передача куки

Без секции `auth` куку можно передать в самом вызове:

```
debug_request(url: "/admin/page", headers: {"Cookie": "session=..."}, breakpoints: [...])
```

`XDEBUG_SESSION` и куки приложения **сливаются**, а не перетирают друг друга. Одноимённая
кука из `headers` имеет приоритет — так можно переопределить и сам `XDEBUG_SESSION`.

## MCP Tools

### debug_request — HTTP-запрос с breakpoints

```
debug_request({
  url: "/api/orders",
  method: "POST",
  headers: { "Cookie": "session=abc" },
  body: { product_id: 1 },
  breakpoints: [
    { file: "app/Controllers/OrderController.php", line: 25 },
    { file: "app/Services/OrderService.php", line: 42, condition: "$total > 1000" },
    { type: "exception", exception: "*" }
  ],
  expressions: ["$this->connection->getName()", "count($items)"],
  maxDepth: 3,
  timeout: 30
})
```

### debug_command — CLI-команда с breakpoints

```
debug_command({
  command: "php bin/console db:find pages 1",
  breakpoints: [
    { file: "app/Tasks/FindPageTask.php", line: 15 }
  ],
  timeout: 15
})
```

Команда выполняется через шаблон `php.cli.exec` из `detective.json`. Для OrbStack/Docker — настроить шаблон с wrapper'ом.

### Типы breakpoints

| Тип | Формат | Описание |
|-----|--------|----------|
| Line | `{ file, line }` | Остановка на конкретной строке файла |
| Line с условием | `{ file, line, condition }` | Остановка если PHP-выражение истинно |
| Exception (все) | `{ type: "exception", exception: "*" }` | Ловит все исключения и warnings |
| Exception (класс) | `{ type: "exception", exception: "App\\Exceptions\\NotFound" }` | Ловит конкретный класс |

Exception breakpoints не блокируют line breakpoints — оба типа работают вместе.

### Общие параметры

| Параметр | Тип | Обязательный | Описание |
|----------|-----|:---:|----------|
| breakpoints | array | да | Массив breakpoints (line и/или exception) |
| expressions | array | нет | PHP-выражения для eval в контексте breakpoint |
| maxDepth | number | нет | Глубина сбора переменных (1-10), default 3 |
| timeout | number | нет | Таймаут в секундах (1-120), default 30 |

### Результат

```
## Hit #1: app/Controllers/OrderController.php:25

**Stack trace:**
  #0 OrderController->store at app/Controllers/OrderController.php:25
  #1 Router->dispatch at vendor/framework/routing.php:100

**Local variables:**
  $request: (Request)
    method: (string) "POST"
    uri: (string) "/api/orders"
  $total: (int) 1500
  $items: (array)
    0: (Product) ...

**Expressions:**
  $this->connection->getName(): (string) "mysql"
  count($items): (int) 3

## Session Info
  Adapter: php
  Debugger: 3.2.0
  Breakpoints set: 2
  Hits: 1
  Time: 152ms
```

## Архитектура

```
src/
├── index.ts                          # Точка входа
├── core/
│   ├── DetectiveServer.ts            # MCP Server
│   ├── adapter/
│   │   ├── types.ts                  # Общие типы
│   │   ├── LanguageAdapterInterface.ts
│   │   └── AdapterRegistry.ts
│   ├── tool/
│   │   ├── ToolInterface.ts
│   │   ├── ToolRegistry.ts
│   │   ├── DebugRequestTool.ts
│   │   ├── DebugCommandTool.ts
│   │   └── breakpointSchema.ts
│   ├── snapshot/
│   │   ├── SnapshotFormatter.ts
│   │   └── SnapshotTruncator.ts
│   ├── http/
│   │   ├── RequestBuilder.ts
│   │   └── RequestExecutor.ts
│   ├── cli/
│   │   └── CliExecutor.ts
│   ├── path/
│   │   └── PathMapper.ts
│   ├── config/
│   │   ├── Config.ts
│   │   ├── ConfigSchema.ts
│   │   └── ConfigLoader.ts
│   └── util/
│       ├── Logger.ts
│       └── Timeout.ts
└── adapter/php/
    ├── PhpAdapter.ts
    ├── PhpDebugSession.ts
    ├── config/PhpAdapterConfig.ts
    ├── breakpoint/
    │   ├── BreakpointStrategy.ts
    │   ├── LineBreakpointStrategy.ts
    │   ├── ExceptionBreakpointStrategy.ts
    │   └── BreakpointStrategyFactory.ts
    ├── trigger/
    │   ├── TriggerStrategy.ts
    │   ├── HttpTriggerStrategy.ts
    │   ├── CliTriggerStrategy.ts
    │   └── TriggerStrategyFactory.ts
    └── dbgp/
        ├── DbgpConnection.ts
        ├── DbgpCommandBuilder.ts
        ├── DbgpResponseParser.ts
        └── DbgpProtocol.ts
```

## Разработка

```bash
npm run build        # сборка
npm run dev          # сборка в watch-режиме
npm test             # тесты
npm run typecheck    # проверка типов
```
