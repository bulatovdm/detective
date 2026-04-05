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
    "artisanPath": "./artisan"
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

## MCP Tool: debug_request

```
debug_request({
  url: "/api/orders",
  method: "POST",
  headers: { "Cookie": "session=abc" },
  body: { product_id: 1 },
  breakpoints: [
    { file: "app/Controllers/OrderController.php", line: 25 },
    { file: "app/Services/OrderService.php", line: 42, condition: "$total > 1000" }
  ],
  expressions: ["$this->connection->getName()", "count($items)"],
  maxDepth: 3,
  timeout: 30
})
```

### Параметры

| Параметр | Тип | Обязательный | Описание |
|----------|-----|:---:|----------|
| url | string | да | URL path (e.g. `/api/orders`) |
| method | string | нет | HTTP method, default `GET` |
| headers | object | нет | HTTP заголовки |
| body | any | нет | Тело запроса |
| breakpoints | array | да | Массив breakpoints |
| breakpoints[].file | string | да | Путь относительно корня проекта |
| breakpoints[].line | number | да | Номер строки |
| breakpoints[].condition | string | нет | PHP-выражение для conditional breakpoint |
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
│   │   └── DebugRequestTool.ts
│   ├── snapshot/
│   │   └── SnapshotFormatter.ts
│   ├── http/
│   │   ├── RequestBuilder.ts
│   │   └── RequestExecutor.ts
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
