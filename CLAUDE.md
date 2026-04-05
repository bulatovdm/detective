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

Detective — MCP-сервер для LLM-driven runtime-дебага PHP-приложений. Подключается к Xdebug по протоколу DBGp, ставит breakpoints, выполняет HTTP-запрос и возвращает snapshot переменных/стека/ошибок за один проход. Без интерактивного step-by-step — один запрос, полный результат.

## Архитектура

```
LLM → MCP (stdio) → DetectiveServer → PhpAdapter → DbgpConnection → Xdebug
                                          ↓
                                     HTTP fetch → PHP App
```

**Core** (`src/core/`) — языконезависимое ядро: MCP-сервер, tools, форматирование snapshot, конфиг, path mapping.

**Adapters** (`src/adapter/`) — реализуют `LanguageAdapterInterface` для конкретных дебагеров. Сейчас только PHP/Xdebug (DBGp). Core никогда не импортирует из адаптеров напрямую — `AdapterRegistry` резолвит по имени.

**Ключевой flow** в `PhpAdapter.executeDebugSession()`:
1. `session.listen()` — открыть TCP-сервер
2. `executeTrigger()` — отправить HTTP-запрос (async, не ждём)
3. `session.startAccepting()` — начать принимать соединения Xdebug (отклоняет ранние/чужие)
4. `waitForConnectionAndConfigure()` — дождаться Xdebug, настроить features
5. `runWithBreakpoints()` — установить breakpoints, run, собрать данные на каждом хите
6. Вернуть snapshot (не ждать завершения PHP-скрипта)

**DBGp протокол** (`src/adapter/php/dbgp/`): TCP-соединение, XML-ответы, сообщения разделены null-байтами. `DbgpConnection` — фрейминг, `DbgpCommandBuilder` — построение команд, `DbgpResponseParser` — парсинг XML через fast-xml-parser.

**PathMapper** (`src/core/path/`) — трансляция между хостовыми путями (где LLM видит файлы) и путями дебагера (внутри Docker/OrbStack). Когда пути совпадают (OrbStack с маунтом FS), маппинг не нужен.

## Правила кода

- **Без комментариев.** Никаких комментариев в коде — ни inline, ни JSDoc, ни блочных. Код самодокументируемый: имена переменных, методов и классов должны полностью объяснять логику.
- **Самодокументируемый bash.** Shell-скрипты в `scripts/` следуют тому же принципу: понятные имена функций (`add_to_mcp_json`, `ensure_built`, `require_project`), структура через `case`-блоки, без поясняющих комментариев.
- **OOP, interface-driven.** Вся функциональность за интерфейсами: `LanguageAdapterInterface`, `ToolInterface`. Новый язык или tool = новый класс, реализующий интерфейс. Core работает только с абстракциями.
- **TypeScript strict**, без `any`. Zod-валидация конфига. `LanguageAdapterInterface.initialize()` принимает `unknown` — каждый адаптер валидирует/кастит сам.
- `skipTlsVerification` в конфиге управляет `NODE_TLS_REJECT_UNAUTHORIZED` (по умолчанию `true` — dev-инструмент).

## Подключение к проектам

```bash
./scripts/setup.sh install              # алиас 'detective' в shell
detective link [path] [app-url]         # добавить в .mcp.json проекта + создать detective.json
detective status [path]                 # проверить конфигурацию
detective unlink [path]                 # отключить от проекта
```

Без аргумента path берётся текущая директория.

## Конфиг

`detective.json` в корне проекта. Валидация через Zod в `ConfigSchema.ts`. Ключевые поля: `app.url`, `php.xdebug.host/port/ideKey`, `pathMapping`, `defaults.*`.

## Тестирование на реальном приложении

```bash
(echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"0.1.0"}}}'; sleep 0.5; echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"debug_request","arguments":{"url":"/api/endpoint","breakpoints":[{"file":"public/index.php","line":5}],"timeout":10}}}'; sleep 10) | node dist/index.js --config /path/to/detective.json
```

Требуется Xdebug в целевом PHP-приложении с `start_with_request=yes` и `client_host`, указывающим на хост где работает Detective.
