# Detective — Architecture Plan

## Что это

Detective — MCP-сервер для LLM-driven runtime-дебага приложений. LLM ставит breakpoints, выполняет запрос, получает полный snapshot переменных/стека/ошибок за один проход. Никакого интерактивного step-by-step.

Начальная реализация — PHP (Xdebug). Архитектура закладывает расширение на Python (debugpy), Node.js (V8 Inspector), Go (Delve) и другие языки.

---

## Название

**Detective** — «детектив расследует баг».

- npm: `@detective/core`, `@detective/php`, `@detective/python`...
- GitHub: `detective-debug/detective`
- CLI: `detective`

---

## Архитектура верхнего уровня

```
┌─────────────┐     MCP (stdio)     ┌──────────────────────────────────────────────┐
│ Claude Code │ ◄─────────────────► │              Detective Core                  │
│   (LLM)     │                     │                                              │
└─────────────┘                     │  ┌─────────┐  ┌─────────┐  ┌─────────┐       │
                                    │  │ PHP     │  │ Python  │  │ Node.js │ ...   │
                                    │  │ Adapter │  │ Adapter │  │ Adapter │       │
                                    │  └────┬────┘  └────┬────┘  └────┬────┘       │
                                    └───────┼────────────┼────────────┼────────────┘
                                            │            │            │
                                      DBGp (TCP)    DAP (TCP)   CDP (WS)
                                            │            │            │
                                    ┌───────┴───┐  ┌─────┴─────┐ ┌───┴─────┐
                                    │  Xdebug   │  │  debugpy  │ │V8 Insp. │
                                    │  (PHP)    │  │  (Python) │ │(Node.js)│
                                    └───────────┘  └───────────┘ └─────────┘
```

### Ключевой принцип: Language Adapter

Каждый язык/дебаггер — это **adapter**, реализующий единый интерфейс `LanguageAdapterInterface`. Core ничего не знает про DBGp, DAP или CDP. Core работает с абстракциями: «поставь breakpoint», «выполни запрос», «собери переменные».

```
Detective Core (MCP Tools, Snapshot, Config)
    │
    └── LanguageAdapterInterface
            │
            ├── PhpAdapter (Xdebug / DBGp)
            ├── PythonAdapter (debugpy / DAP)  — будущее
            └── NodeAdapter (V8 Inspector / CDP)  — будущее
```

---

## Модульная структура

```
detective/
├── src/
│   ├── index.ts                           # Точка входа
│   │
│   ├── core/                              # Ядро — не зависит от языка
│   │   ├── DetectiveServer.ts             # MCP Server, регистрация tools
│   │   │
│   │   ├── adapter/                       # Абстракция языкового адаптера
│   │   │   ├── LanguageAdapterInterface.ts    # Главный интерфейс адаптера
│   │   │   ├── AdapterRegistry.ts             # Реестр адаптеров, выбор по конфигу
│   │   │   ├── BreakpointInterface.ts         # Описание breakpoint (файл, строка, условие)
│   │   │   ├── DebugSessionInterface.ts       # Абстракция debug-сессии
│   │   │   └── types.ts                       # Общие типы: VariableValue, StackFrame и т.д.
│   │   │
│   │   ├── tool/                          # MCP Tools
│   │   │   ├── ToolInterface.ts               # Интерфейс tool
│   │   │   ├── ToolRegistry.ts                # Автообнаружение и регистрация tools
│   │   │   ├── DebugRequestTool.ts            # Основной: запрос + breakpoints → snapshot
│   │   │   ├── SetWatchpointsTool.ts          # Persistent watchpoints
│   │   │   ├── EvalTool.ts                    # eval выражения в контексте debug-сессии
│   │   │   ├── ProfileRequestTool.ts          # Profiling
│   │   │   └── InspectTool.ts                 # Инспекция приложения (роуты, контейнер и т.д.)
│   │   │
│   │   ├── snapshot/                      # Формирование результата
│   │   │   ├── Snapshot.ts                    # Структура: response + hits + errors + meta
│   │   │   ├── BreakpointHit.ts               # Данные одного breakpoint
│   │   │   ├── SnapshotFormatter.ts           # Форматирование для LLM
│   │   │   └── SnapshotTruncator.ts           # Обрезка больших данных
│   │   │
│   │   ├── http/                          # HTTP-клиент для запросов к приложению
│   │   │   ├── RequestBuilder.ts              # Построение запроса
│   │   │   └── RequestExecutor.ts             # Выполнение (fetch / curl)
│   │   │
│   │   ├── config/                        # Конфигурация
│   │   │   ├── Config.ts                      # Типизированный конфиг
│   │   │   ├── ConfigSchema.ts                # JSON Schema для валидации
│   │   │   └── ConfigLoader.ts                # Загрузка: файл → env → defaults
│   │   │
│   │   └── util/
│   │       ├── Logger.ts                      # Логирование (stderr)
│   │       └── Timeout.ts                     # Таймауты с AbortController
│   │
│   └── adapter/                           # Языковые адаптеры
│       │
│       └── php/                           # PHP Adapter (Xdebug / DBGp)
│           ├── PhpAdapter.ts                  # Реализация LanguageAdapterInterface
│           ├── PhpDebugSession.ts             # Управление одной debug-сессией
│           │
│           ├── dbgp/                      # DBGp-протокол
│           │   ├── DbgpConnection.ts          # TCP-соединение с Xdebug
│           │   ├── DbgpCommandBuilder.ts      # Построитель команд
│           │   ├── DbgpResponseParser.ts      # XML-парсер ответов
│           │   └── DbgpProtocol.ts            # Типы протокола (команды, ответы)
│           │
│           ├── collector/                 # PHP-специфичные сборщики (без Xdebug)
│           │   ├── PhpCollectorInterface.ts    # Интерфейс PHP-сборщика
│           │   └── PhpCollectorPipeline.ts     # Цепочка сборщиков
│           │
│           ├── inspector/                 # PHP-специфичная инспекция
│           │   ├── PhpInspectorInterface.ts    # Интерфейс инспектора
│           │   ├── ArtisanInspector.ts         # Инспекция через artisan (Laravel)
│           │   └── GenericPhpInspector.ts      # Инспекция через PHP CLI
│           │
│           └── config/
│               └── PhpAdapterConfig.ts        # PHP-специфичная конфигурация
│
├── package.json
├── tsconfig.json
├── detective.schema.json                  # JSON Schema для конфиг-файла
└── README.md
```

---

## Интерфейс языкового адаптера

Это центральная абстракция. Каждый новый язык реализует только этот интерфейс.

```typescript
/**
 * Языковой адаптер. Абстрагирует конкретный debug-протокол
 * (DBGp для PHP, DAP для Python, CDP для Node.js).
 */
interface LanguageAdapterInterface {
  /** Уникальный идентификатор адаптера */
  readonly name: string;  // 'php', 'python', 'nodejs'

  /** Инициализация адаптера (поднятие TCP-сервера и т.д.) */
  initialize(config: AdapterConfig): Promise<void>;

  /** Завершение работы */
  shutdown(): Promise<void>;

  /**
   * Основной метод: выполнить debug-сессию.
   *
   * 1. Подготовить debug-сервер (слушать порт)
   * 2. Выполнить trigger (HTTP-запрос, CLI-команду и т.д.)
   * 3. Перехватить подключение дебаггера
   * 4. Установить breakpoints
   * 5. Собрать данные в каждом breakpoint
   * 6. Вернуть результат
   */
  executeDebugSession(params: DebugSessionParams): Promise<DebugSessionResult>;

  /**
   * Выполнить eval-выражение на языке адаптера.
   * Может использовать debug-сессию или отдельный механизм (tinker, REPL).
   */
  evaluate(expression: string, context: EvalContext): Promise<EvalResult>;

  /**
   * Инспекция приложения (роуты, DI-контейнер, конфиг и т.д.).
   * Возвращает структурированные данные. Каждый адаптер определяет
   * свой набор доступных инспекций.
   */
  inspect(what: string, params?: Record<string, unknown>): Promise<InspectionResult>;

  /** Список доступных инспекций для этого адаптера */
  availableInspections(): InspectionDescriptor[];

  /** Profiling запроса */
  profile(params: ProfileParams): Promise<ProfileResult>;
}

// --- Входные типы ---

interface DebugSessionParams {
  /** Что триггерит выполнение кода */
  trigger: RequestTrigger | CliTrigger;

  /** Breakpoints */
  breakpoints: BreakpointDefinition[];

  /** Выражения для eval в каждом breakpoint */
  expressions?: string[];

  /** Глубина сбора переменных */
  maxDepth?: number;

  /** Таймаут сессии в секундах */
  timeout?: number;
}

interface RequestTrigger {
  type: 'http';
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: unknown;
}

interface CliTrigger {
  type: 'cli';
  command: string;
  args?: string[];
}

interface BreakpointDefinition {
  type?: 'line' | 'exception';  // default: 'line'
  file?: string;                // обязательно для type='line'
  line?: number;                // обязательно для type='line'
  exception?: string;           // для type='exception', '*' = все исключения
  condition?: string;
  hitCount?: number;
}

// --- Выходные типы (общие для всех адаптеров) ---

interface DebugSessionResult {
  /** HTTP-ответ (если trigger = http) */
  response?: HttpResponse;

  /** Stdout/stderr (если trigger = cli) */
  output?: CommandOutput;

  /** Данные каждого сработавшего breakpoint */
  hits: BreakpointHit[];

  /** Ошибки/исключения */
  errors: ErrorInfo[];

  /** Метаданные */
  meta: SessionMeta;
}

interface BreakpointHit {
  file: string;
  line: number;
  hitNumber: number;
  stackTrace: StackFrame[];
  locals: Record<string, VariableValue>;
  expressions?: Record<string, VariableValue>;
}

interface StackFrame {
  level: number;
  file: string;
  line: number;
  function: string;
  class?: string;
}

interface VariableValue {
  type: string;
  value: unknown;
  className?: string;
  size?: number;
  truncated?: boolean;
  children?: Record<string, VariableValue>;
}

interface ErrorInfo {
  type: string;      // 'exception', 'error', 'warning'
  message: string;
  file?: string;
  line?: number;
  trace?: StackFrame[];
}

interface SessionMeta {
  adapterName: string;
  debuggerVersion: string;
  languageVersion: string;
  totalBreakpointsSet: number;
  totalHits: number;
  executionTimeMs: number;
}
```

---

## Конфигурация

Файл `detective.json` в корне проекта:

```json
{
  "$schema": "./node_modules/@detective/core/detective.schema.json",

  "adapter": "php",

  "app": {
    "url": "http://localhost:8000",
    "basePath": "/var/www/app"
  },

  "php": {
    "xdebug": {
      "host": "127.0.0.1",
      "port": 9003,
      "ideKey": "detective"
    },
    "binary": "php",
    "artisanPath": "./artisan"
  },

  "defaults": {
    "maxDepth": 3,
    "maxDataSize": 65536,
    "maxChildren": 128,
    "timeout": 30,
    "maxResponseBodyLength": 10000
  }
}
```

### Docker / OrbStack — конфигурация

Когда приложение работает в контейнере (OrbStack, Docker Desktop, Colima), а Claude Code — на хосте, возникает сетевая задача: Xdebug внутри контейнера должен подключиться к MCP-серверу на хосте.

```json
{
  "adapter": "php",

  "app": {
    "url": "http://myapp.orb.local",
    "basePath": "/var/www/app"
  },

  "php": {
    "xdebug": {
      "host": "0.0.0.0",
      "port": 9003,
      "ideKey": "detective"
    }
  },

  "pathMapping": {
    "/var/www/app": "/Users/dima/projects/myapp"
  }
}
```

---

## Подключение: пошаговая инструкция

### Сценарий 1: Локальный PHP (без Docker)

PHP работает прямо на macOS (через Homebrew или встроенный сервер).

**1. Установить Xdebug**

```bash
pecl install xdebug
```

**2. Настроить xdebug.ini**

```ini
[xdebug]
xdebug.mode = debug
xdebug.start_with_request = trigger
xdebug.client_host = 127.0.0.1
xdebug.client_port = 9003
xdebug.idekey = detective
```

**3. Проверить**

```bash
php -m | grep xdebug        # должно вывести "xdebug"
php -i | grep xdebug.mode   # должно вывести "debug"
```

**4. Создать `detective.json`**

```json
{
  "adapter": "php",
  "app": { "url": "http://localhost:8000" },
  "php": {
    "xdebug": { "host": "127.0.0.1", "port": 9003 }
  }
}
```

**5. Запустить Detective**

Detective стартует автоматически как MCP-сервер при запуске Claude Code (через `.claude/settings.json`).

Схема соединения:

```
┌─────────────────── macOS ───────────────────┐
│                                             │
│  Claude Code ──stdio──► Detective MCP       │
│                          (слушает :9003)     │
│                               ▲              │
│                               │ TCP          │
│                               │              │
│  php artisan serve ──────► Xdebug            │
│  (localhost:8000)        (коннектится к 9003) │
│                                             │
└─────────────────────────────────────────────┘
```

### Сценарий 2: OrbStack (основной для Димы)

PHP работает в OrbStack-контейнере. Claude Code и Detective — на хосте.

**Особенность OrbStack:** каждый контейнер доступен по `<container>.orb.local` с хоста, а хост доступен изнутри контейнера по `host.orb.local`. Это проще, чем в обычном Docker.

**1. Xdebug в контейнере** (в Dockerfile или конфиге контейнера)

```ini
[xdebug]
xdebug.mode = debug
xdebug.start_with_request = trigger
xdebug.client_host = host.orb.local
xdebug.client_port = 9003
xdebug.idekey = detective
```

`client_host = host.orb.local` — Xdebug будет подключаться к хосту, где слушает Detective.

**2. Проверить, что Xdebug видит хост**

```bash
# Внутри контейнера:
php -r "echo gethostbyname('host.orb.local');"
# Должен вывести IP хоста (обычно 198.19.x.x для OrbStack)
```

**3. Проверить, что порт 9003 доступен изнутри контейнера**

```bash
# На хосте запустить временный TCP-слушатель:
nc -l 9003

# Внутри контейнера проверить подключение:
nc -z host.orb.local 9003 && echo "OK" || echo "FAIL"
```

**4. `detective.json`**

```json
{
  "adapter": "php",

  "app": {
    "url": "http://myapp.orb.local",
    "basePath": "/var/www/app"
  },

  "php": {
    "xdebug": {
      "host": "0.0.0.0",
      "port": 9003,
      "ideKey": "detective"
    }
  },

  "pathMapping": {
    "/var/www/app": "/Users/dima/projects/myapp"
  }
}
```

**`pathMapping`** — критически важная настройка. Xdebug оперирует путями внутри контейнера (`/var/www/app/app/Http/Controllers/OrderController.php`). Claude Code видит файлы на хосте (`/Users/dima/projects/myapp/app/Http/Controllers/OrderController.php`). Detective автоматически транслирует пути в обе стороны:

- LLM задаёт breakpoint по хостовому пути → Detective конвертит в контейнерный путь для Xdebug
- Xdebug возвращает стек с контейнерными путями → Detective конвертит обратно в хостовые

**5. Если уже настроен Xdebug для PhpStorm**

Скорее всего, Xdebug уже сконфигурирован с `client_host` и `client_port` для PhpStorm. Варианты:

**Вариант A — Разные IDE keys (рекомендуется)**

PhpStorm использует свой idekey (обычно `PHPSTORM`), Detective — свой (`detective`). Оба слушают порт 9003, но Xdebug подключается к тому, чей idekey указан в trigger-запросе.

Проблема: Xdebug коннектится к **одному** хосту/порту, он не знает какой именно IDE слушает. Поэтому работает только один за раз.

**Вариант B — Разные порты (самый надёжный)**

```ini
# Для PhpStorm — порт 9003 (как было)
xdebug.client_port = 9003

# Для Detective — переключить на порт 9004
```

В `detective.json`:
```json
{
  "php": {
    "xdebug": { "port": 9004 }
  }
}
```

И переключать `xdebug.client_port` в php.ini (или через env: `XDEBUG_CONFIG="client_port=9004"`).

**Вариант C — DBGp Proxy (самый правильный, но сложнее)**

Xdebug подключается к DBGp proxy (например, [Xdebug Helper Proxy](https://xdebug.org/docs/dbgpProxy)), который маршрутизирует сессии по idekey:

```
Xdebug → DBGp Proxy (:9003) → idekey=PHPSTORM → PhpStorm (:9001)
                              → idekey=detective → Detective (:9004)
```

Настройка proxy:
```bash
# Установить proxy
pip install dbgp-client  # или скачать бинарник

# Запустить
dbgpProxy -i 0.0.0.0:9001 -s 0.0.0.0:9003
# -s 9003 — порт, к которому подключается Xdebug
# -i 9001 — порт для регистрации IDE/Detective
```

Detective при старте регистрируется в proxy:
```
proxyinit -p 9004 -k detective -m 1
```

Для Фазы 1 рекомендую **Вариант B** (разные порты) — простой, надёжный, не требует дополнительного ПО.

Схема для OrbStack:

```
┌──────────── macOS (хост) ─────────────┐
│                                       │
│  Claude Code ──stdio──► Detective MCP │
│                          (0.0.0.0:9003)│
│                               ▲       │
│                               │ TCP   │
└───────────────────────────────┼───────┘
                                │
          host.orb.local:9003   │
                                │
┌───────── OrbStack контейнер ──┼───────┐
│                               │       │
│  PHP App ──────────────► Xdebug       │
│  (myapp.orb.local:80)   client_host=  │
│                         host.orb.local│
│                                       │
│  Пути: /var/www/app/...              │
└───────────────────────────────────────┘

pathMapping: /var/www/app → /Users/dima/projects/myapp
```

### Сценарий 3: Docker Compose (generic)

Для обычного Docker Desktop / Colima (без OrbStack).

**1. Xdebug в контейнере**

```ini
[xdebug]
xdebug.mode = debug
xdebug.start_with_request = trigger
xdebug.client_host = host.docker.internal
xdebug.client_port = 9003
xdebug.idekey = detective
```

`host.docker.internal` — Docker Desktop автоматически резолвит в IP хоста. На Linux может потребоваться `--add-host=host.docker.internal:host-gateway` в docker-compose.

**2. `detective.json`**

```json
{
  "adapter": "php",
  "app": {
    "url": "http://localhost:8080",
    "basePath": "/app"
  },
  "php": {
    "xdebug": {
      "host": "0.0.0.0",
      "port": 9003
    }
  },
  "pathMapping": {
    "/app": "./src"
  }
}
```

**3. docker-compose.yml** — убедиться, что порт приложения проброшен:

```yaml
services:
  app:
    build: .
    ports:
      - "8080:80"
    environment:
      XDEBUG_MODE: debug
      XDEBUG_CONFIG: "client_host=host.docker.internal client_port=9003 idekey=detective"
```

### Сценарий 4: Удалённый сервер (SSH tunnel)

PHP на удалённом dev-сервере. Detective на локальной машине.

```bash
# SSH-туннель: пробросить порт 9003 с сервера на локал
ssh -R 9003:127.0.0.1:9003 user@dev-server.com

# На сервере Xdebug конфигурирован с client_host=127.0.0.1, client_port=9003
# Xdebug подключается к localhost:9003 → через туннель попадает на локальный Detective
```

`detective.json`:

```json
{
  "adapter": "php",
  "app": {
    "url": "http://dev-server.com",
    "basePath": "/var/www/app"
  },
  "php": {
    "xdebug": {
      "host": "127.0.0.1",
      "port": 9003
    }
  },
  "pathMapping": {
    "/var/www/app": "/Users/dima/projects/myapp"
  }
}
```

---

## Интеграция с Claude Code

### `.claude/settings.json`

```json
{
  "mcpServers": {
    "detective": {
      "command": "npx",
      "args": ["@detective/core", "--config", "./detective.json"]
    }
  }
}
```

### Или глобально (`~/.claude/settings.json`)

```json
{
  "mcpServers": {
    "detective": {
      "command": "npx",
      "args": ["@detective/core"]
    }
  }
}
```

При глобальной установке Detective ищет `detective.json` в текущей рабочей директории.

---

## MCP Tools

### 1. `debug_request` — основной

```
debug_request({
  url: "/api/orders",
  method: "POST",
  body: { product_id: 1, qty: 2 },
  breakpoints: [
    { file: "app/Http/Controllers/OrderController.php", line: 25 },
    { file: "app/Services/OrderService.php", line: 42 }
  ],
  expressions: ["$this->connection->getName()", "count($items)"],
  maxDepth: 3,
  timeout: 30
})
```

Возвращает `DebugSessionResult` (snapshot).

Пути в breakpoints — **относительные от корня проекта**. Detective конвертит их в абсолютные хостовые пути, затем через pathMapping — в контейнерные пути для Xdebug.

### 2. `set_watchpoints` — persistent breakpoints

```
set_watchpoints({
  action: "add",
  watchpoints: [
    { file: "app/Services/OrderService.php", line: 42, condition: "$total > 1000" }
  ]
})
```

Watchpoints сохраняются между вызовами `debug_request` и автоматически добавляются к каждому запросу.

### 3. `eval` — выполнение выражения

```
eval({
  expression: "App\\Models\\Product::count()",
  context: "runtime"
})
```

Контексты:
- `runtime` — через CLI (artisan tinker или php -r)
- `breakpoint` — через Xdebug eval (на последнем активном breakpoint)

### 4. `inspect` — инспекция приложения

```
inspect({
  what: "routes",
  params: { filter: "api/*" }
})
```

Доступные инспекции зависят от адаптера. Для PHP/Laravel:
- `routes` — список роутов
- `container` — DI-контейнер
- `config` — конфигурация
- `middleware` — стек middleware
- `migrations` — статус миграций

### 5. `profile_request` — profiling

```
profile_request({
  url: "/api/heavy-endpoint",
  method: "GET",
  topN: 20
})
```

Включает Xdebug profiler, парсит cachegrind, возвращает top-N самых тяжёлых вызовов.

---

## Path Mapping — детали реализации

Это критический компонент для Docker/OrbStack-сценариев.

```typescript
interface PathMapper {
  /**
   * Конвертирует путь из пространства LLM (хост) в пространство дебаггера (контейнер).
   *
   * "app/Controllers/OrderController.php"
   *   → resolve to host: "/Users/dima/projects/myapp/app/Controllers/OrderController.php"
   *   → map to container: "/var/www/app/app/Controllers/OrderController.php"
   */
  toDebugger(hostPath: string): string;

  /**
   * Конвертирует путь из пространства дебаггера (контейнер) в пространство LLM (хост).
   *
   * "/var/www/app/app/Controllers/OrderController.php"
   *   → map to host: "/Users/dima/projects/myapp/app/Controllers/OrderController.php"
   *   → relative: "app/Controllers/OrderController.php"
   */
  toHost(debuggerPath: string): string;
}
```

Маппинг задаётся в конфиге:

```json
{
  "pathMapping": {
    "/var/www/app": "/Users/dima/projects/myapp",
    "/vendor":      "/Users/dima/projects/myapp/vendor"
  }
}
```

Если pathMapping пустой — считаем, что приложение локальное, пути совпадают.

---

## Расширяемость: добавление нового языка

Для добавления Python-адаптера:

1. Создать `src/adapter/python/PythonAdapter.ts`, реализующий `LanguageAdapterInterface`
2. Реализовать DAP-клиент (Debug Adapter Protocol) вместо DBGp
3. Добавить `python` в `AdapterRegistry`
4. Добавить секцию `"python"` в JSON Schema конфига

Core, MCP tools, snapshot — всё остаётся без изменений. Tools вызывают методы `LanguageAdapterInterface`, не зная, DBGp это или DAP под капотом.

```json
{
  "adapter": "python",
  "app": { "url": "http://localhost:5000" },
  "python": {
    "debugpy": { "host": "127.0.0.1", "port": 5678 }
  }
}
```

---

## Расширяемость: Framework Collectors (PHP-пакет)

Опциональный Composer-пакет для сбора данных, недоступных через Xdebug (SQL, логи, events). Не привязан к конкретному фреймворку — interface-driven.

```php
<?php

declare(strict_types=1);

namespace Detective\Php\Collector;

/**
 * Интерфейс сборщика framework-специфичных данных.
 * Реализации: LaravelQueryCollector, SymfonyEventCollector и т.д.
 */
interface CollectorInterface
{
    public function getName(): string;

    /** Подписка на события фреймворка */
    public function register(): void;

    /** @return array<string, mixed> */
    public function collect(): array;

    public function reset(): void;
}

/**
 * Интерфейс для framework-адаптера (не путать с Language Adapter).
 * Связывает collectors с конкретным фреймворком.
 */
interface FrameworkBridgeInterface
{
    public function getName(): string;

    /** @return list<CollectorInterface> */
    public function collectors(): array;

    /** Регистрация в DI/middleware фреймворка */
    public function boot(): void;
}
```

Структура PHP-пакета:

```
detective-php/
├── composer.json
├── src/
│   ├── Collector/
│   │   ├── CollectorInterface.php
│   │   ├── CollectorPipeline.php
│   │   └── AbstractCollector.php
│   │
│   ├── Bridge/
│   │   ├── FrameworkBridgeInterface.php
│   │   ├── Laravel/
│   │   │   ├── LaravelBridge.php
│   │   │   ├── DetectiveServiceProvider.php
│   │   │   ├── CollectDebugDataMiddleware.php
│   │   │   ├── QueryCollector.php
│   │   │   ├── LogCollector.php
│   │   │   ├── EventCollector.php
│   │   │   └── CacheCollector.php
│   │   ├── Symfony/
│   │   │   └── ...
│   │   └── Yii/
│   │       └── ...
│   │
│   └── Storage/
│       ├── StorageInterface.php
│       └── FileStorage.php
```

Это Фаза 2+. На Фазе 1 работаем только через Xdebug.

---

## Фазы реализации

### Фаза 1 — MVP ✅

Минимальный рабочий продукт: Claude Code может выполнить HTTP-запрос к PHP-приложению с breakpoints и получить snapshot.

- [x] Структура проекта, TypeScript strict, ESLint, Vitest
- [x] `LanguageAdapterInterface` + `PhpAdapter`
- [x] DBGp-клиент: TCP connection, breakpoint_set, run, stack_get, context_get
- [x] `DebugRequestTool` (MCP tool)
- [x] `PathMapper` (path mapping для Docker)
- [x] `SnapshotFormatter` (компактный вывод для LLM)
- [x] `ConfigLoader` (detective.json)
- [x] MCP Server (stdio transport)
- [x] README: установка, настройка Xdebug, подключение к Claude Code
- [x] `scripts/link.sh` — подключение/отключение MCP-сервера к проектам
- [x] Поддержка OrbStack: gating соединений (`start_with_request=yes`), self-signed TLS
- [x] Conditional breakpoints
- [x] Expressions (eval в контексте breakpoint)

### Фаза 2 — Exception Breakpoints + HTTP Response ✅

Обратная связь от первого использования.

- [x] **Exception breakpoints** — `breakpoint_set -t exception`. Strategy pattern: `LineBreakpointStrategy` (consumesRun=true), `ExceptionBreakpointStrategy` (consumesRun=false). Wildcard `"*"` или конкретный класс. Auto-normalize double-escaped backslashes.
- [x] **HTTP response body в snapshot** — `detach` вместо `stop` после сбора данных. PHP завершает обработку, HTTP-ответ приходит.
- [x] **Multi-step snapshot** — несколько line breakpoints + exception breakpoints в одном запросе, каждый хит собирается отдельно.

### Фаза 3 — SnapshotTruncator + CLI Trigger ✅

- [x] `SnapshotTruncator` — умная обрезка: лимит глубины, детей, строк. Фильтрация DI-шума по классу (`NOISE_CLASS_PATTERNS`) и размеру (50+ children). Без хардкода имён свойств.
- [x] **CLI trigger** — `debug_command` MCP tool. Дебаг artisan/console/любых PHP-команд. `TriggerStrategy` pattern: `HttpTriggerStrategy` (acceptBeforeTrigger=false), `CliTriggerStrategy` (acceptBeforeTrigger=true). Configurable `php.cli.exec` template для OrbStack/Docker/локального запуска.
- [x] **Breakpoint schema** вынесена в общий модуль `breakpointSchema.ts`, переиспользуется обоими tools.

### Фаза 4 — Watchpoints + Inspect + Profile

- [ ] `SetWatchpointsTool` (persistent breakpoints между вызовами)
- [ ] `InspectTool` (роуты, контейнер, миграции)
- [ ] `ProfileRequestTool` (cachegrind parsing)
- [ ] DBGp Proxy support (сосуществование с PhpStorm)
- [ ] PHP Composer-пакет с `CollectorInterface`

### Фаза 5 — Мультиязычность (по необходимости)

- [ ] Python adapter (debugpy / DAP)
- [ ] Node.js adapter (V8 Inspector / CDP)
- [ ] Отдельные npm-пакеты: `@detective/python`, `@detective/nodejs`

---

## Принципы

1. **Строгая типизация** — TypeScript strict, никаких `any`. PHP — `declare(strict_types=1)`, PHPStan level 10.

2. **Interface-driven** — всё за интерфейсами. `LanguageAdapterInterface`, `ToolInterface`, `CollectorInterface`, `PathMapper`. Новая функциональность = новый класс, реализующий интерфейс.

3. **Batch, не interactive** — один запрос → полный snapshot. LLM не ходит по шагам.

4. **Язык — деталь реализации** — Core не знает про DBGp/DAP/CDP. Core работает с `LanguageAdapterInterface`.

5. **Framework — деталь реализации** — PHP adapter не знает про Laravel/Symfony. Для framework-специфичного сбора — отдельный Composer-пакет с `FrameworkBridgeInterface`.

6. **Path mapping — first-class citizen** — Docker/OrbStack/remote — норма, не edge case. Маппинг путей встроен в core.

7. **Минимальное вмешательство** — базовый дебаг работает с одним лишь Xdebug, без изменений в приложении. PHP-пакет опционален.

8. **Dev-only** — всё ставится через `--dev`, активируется по trigger (заголовок/cookie), не работает в production.
