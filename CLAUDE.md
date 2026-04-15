# CLAUDE.md

Руководство для Claude Code (claude.ai/code) при работе с кодом в этом репозитории.

## Сборка и тесты

```bash
npm run build        # TypeScript → dist/
npm test             # vitest run
npm run typecheck    # tsc --noEmit
```

Тесты в `tests/` (зеркалят структуру `src/`). Запуск одного теста:
```bash
npx vitest run tests/core/path/PathMapper.test.ts
```

## Что это

Detective — MCP-сервер для LLM-driven runtime-дебага PHP-приложений. Подключается к Xdebug по протоколу DBGp, ставит breakpoints, выполняет HTTP-запрос или CLI-команду и возвращает snapshot переменных/стека/ошибок за один проход. Без интерактивного step-by-step — один запрос, полный результат.

## Архитектура

```
LLM → MCP (stdio) → DetectiveServer → PhpAdapter → DbgpConnection → Xdebug
                                          ↓
                                   TriggerStrategy
                                    ├── HTTP fetch → PHP App
                                    └── CLI exec  → PHP Console
```

**Core** (`src/core/`) — языконезависимое ядро: MCP-сервер, tools, форматирование snapshot, конфиг, path mapping.

**Adapters** (`src/adapter/`) — реализуют `LanguageAdapterInterface` для конкретных дебагеров. Сейчас только PHP/Xdebug (DBGp). Core никогда не импортирует из адаптеров напрямую — `AdapterRegistry` резолвит по имени.

**Ключевой flow** в `PhpAdapter.executeDebugSession()`:
1. `session.listen()` — открыть TCP-сервер
2. `fireTrigger()` — запустить trigger (HTTP fetch или CLI exec) через `TriggerStrategy`
3. `session.startAccepting()` — порядок определяется `TriggerStrategy.acceptBeforeTrigger`
4. `waitForConnectionAndConfigure()` — дождаться Xdebug, настроить features
5. `runWithBreakpoints()` — установить breakpoints через `BreakpointStrategy`, run, собрать данные
6. `session.detach()` — отсоединиться от Xdebug (PHP продолжает работу, HTTP-ответ приходит)

**Полиморфизм через Strategy Pattern:**
- `BreakpointStrategy` — `LineBreakpointStrategy` (consumesRun=true), `ExceptionBreakpointStrategy` (consumesRun=false)
- `TriggerStrategy` — `HttpTriggerStrategy` (acceptBeforeTrigger=false), `CliTriggerStrategy` (acceptBeforeTrigger=true)
- Фабрики создают стратегии через registry по типу, без if/switch

**DBGp протокол** (`src/adapter/php/dbgp/`): TCP-соединение, XML-ответы, сообщения разделены null-байтами. `DbgpConnection` — фрейминг, `DbgpCommandBuilder` — построение команд, `DbgpResponseParser` — парсинг XML через fast-xml-parser.

**PathMapper** (`src/core/path/`) — трансляция между хостовыми путями (где LLM видит файлы) и путями дебагера (внутри Docker/OrbStack). Когда пути совпадают (OrbStack с маунтом FS), маппинг не нужен.

## Правила кода

- **Без комментариев.** Никаких комментариев в коде — ни inline, ни JSDoc, ни блочных. Код самодокументируемый: имена переменных, методов и классов должны полностью объяснять логику.
- **Самодокументируемый bash.** Shell-скрипты в `scripts/` следуют тому же принципу: понятные имена функций (`add_to_mcp_json`, `ensure_built`, `require_project`), структура через `case`-блоки, без поясняющих комментариев.
- **OOP, interface-driven.** Вся функциональность за интерфейсами: `LanguageAdapterInterface`, `ToolInterface`, `BreakpointStrategy`, `TriggerStrategy`. Новый тип breakpoint, trigger или язык = новый класс, реализующий интерфейс. Core работает только с абстракциями.
- **Полиморфизм, не if/switch.** Поведение определяется стратегиями через factory registry. Фабрики резолвят по типу (`breakpoint.type`, `trigger.type`), не через условия.
- **TypeScript strict**, без `any`. Zod-валидация конфига. `LanguageAdapterInterface.initialize()` принимает `unknown` — каждый адаптер валидирует/кастит сам.
- `skipTlsVerification` в конфиге управляет `NODE_TLS_REJECT_UNAUTHORIZED` (по умолчанию `true` — dev-инструмент).
- **Описание MCP tools актуально.** При изменении поведения или параметров tool — обновлять `description` в `definition()`. LLM читает это описание для понимания возможностей инструмента.
- **Пресеты актуальны.** При добавлении/изменении MCP tools или параметров — обновлять шаблоны в `presets/claude-md/ru.md` и `presets/claude-md/en.md`. Эти шаблоны инжектятся в CLAUDE.md целевых проектов через `detective link/update`.

## Подключение к проектам

```bash
./scripts/setup.sh install                          # симлинк 'detective' в ~/.local/bin
detective link [path] [--preset self|docker|default] [--lang ru|en]  # интерактивная линковка
detective update [path] [--lang ru|en]               # обновить секцию в CLAUDE.md
detective status [path]                              # проверить конфигурацию
detective unlink [path]                              # отключить от проекта
```

Без аргумента path берётся текущая директория.

### Пресеты

`presets/` — шаблоны конфигов и CLAUDE.md секций. Пресеты: `self` (SELF Framework + OrbStack), `docker` (Docker-контейнеры), `default` (базовый PHP/Xdebug).

- `presets/self/detective.json.tpl` — шаблон detective.json для SELF (плейсхолдеры `{{domain}}`, `{{user}}`)
- `presets/docker/detective.json.tpl` — шаблон detective.json для Docker (плейсхолдеры `{{app_url}}`, `{{container}}`, `{{ide_key}}`, `{{container_path}}`, `{{host_path}}`)
- `presets/default/detective.json.tpl` — шаблон detective.json по умолчанию (плейсхолдер `{{app_url}}`)
- `presets/claude-md/ru.md`, `presets/claude-md/en.md` — шаблоны секции для CLAUDE.md

`detective link` инжектит секцию в CLAUDE.md проекта между маркерами `<!-- detective:start -->` / `<!-- detective:end -->`. `detective update` обновляет её на актуальную версию.

## Конфиг

`detective.json` в корне проекта. Валидация через Zod в `ConfigSchema.ts`. Ключевые поля: `app.url`, `php.xdebug.host/port/ideKey`, `php.cli.exec`, `pathMapping`, `defaults.*`.

`php.cli.exec` — шаблон для запуска CLI-команд. `{command}` заменяется на команду с env-переменными. Примеры:
- Локальный PHP: `"{command}"` (по умолчанию)
- OrbStack: `"orb -m self -u user -s \"cd ~/sites/app && {command}\""`
- Docker: `"docker exec container {command}"`

## Тестирование на реальном приложении

```bash
(echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"0.1.0"}}}'; sleep 0.5; echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"debug_request","arguments":{"url":"/api/endpoint","breakpoints":[{"file":"public/index.php","line":5}],"timeout":10}}}'; sleep 10) | node dist/index.js --config /path/to/detective.json
```

Требуется Xdebug в целевом PHP-приложении с `start_with_request=yes` и `client_host`, указывающим на хост где работает Detective.
