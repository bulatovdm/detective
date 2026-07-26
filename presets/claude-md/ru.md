<!-- detective:lang:ru -->
## Отладка с Detective MCP

При возникновении проблем используй `mcp__detective__debug_request` и `mcp__detective__debug_command` вместо добавления логов, var_dump или чтения кода наугад.

### Когда использовать

1. **API возвращает неожиданный ответ** — поставь брейкпоинт на контроллер/action, проверь данные в рантайме
2. **Первые 1-2 гипотезы из чтения кода не подтвердились** — не гадай дальше, дебажь
3. **Проблема с рантайм-данными** — неправильные значения в entity, неожиданный результат из БД, проблемы в кастах/трансформерах
4. **Консольная команда падает или возвращает неверный результат** — `debug_command` с брейкпоинтами
5. **Неизвестное исключение** — exception breakpoint с `"*"` или конкретным классом

### Возможности

- **Line breakpoints**: `{"type": "line", "file": "app/...", "line": 42}` — остановка на строке
- **Exception breakpoints**: `{"type": "exception", "exception": "*"}` — ловить все исключения, или конкретный класс
- **Expressions**: `["$page->toArray()", "$this->data"]` — вычислить выражения в контексте брейкпоинта
- **maxDepth**: 1-10, глубина раскрытия объектов (по умолчанию ставь 2-3)
- **HTTP Response**: статус и body ответа в `debug_request`
- **Command Output**: stdout/stderr и exit code в `debug_command`
- **verbose**: `true` — включает session log в ответ (таймстампы каждого этапа: TCP listen, Xdebug connect, breakpoint hit). Используй при проблемах с подключением или таймаутах. При ошибке session log включается автоматически
- Несколько брейкпоинтов в одном запросе — видишь состояние "до" и "после"

### Примеры

```
# HTTP запрос с брейкпоинтом
debug_request(url: "/api/endpoint", breakpoints: [{type: "line", file: "app/.../Controller.php", line: 38}], expressions: ["$request", "$result"])

# Консольная команда
debug_command(command: "php bin/console some:command", breakpoints: [{type: "exception", exception: "*"}])
```

### Защищённые страницы (авторизация)

Если приложение закрыто аутентификацией, запрос к защищённому URL вернёт 401/редирект,
и брейкпоинты внутри контроллера не сработают. Не обходи это отключением защиты — настрой
авторизацию в `detective.local.json` (git-ignored, создаётся при `link`):

```jsonc
{
  "auth": {
    "type": "form",
    "url": "/api/login",
    "credentials": { "login": "...", "password": "..." },
    "cookieNames": ["session_cookie_name"]
  }
}
```

Detective сам залогинится, закеширует куку и подставит её во все запросы.
Для API-ключа вместо формы:

```jsonc
{
  "auth": { "type": "header", "header": "X-Auth-Token", "valueEnv": "DETECTIVE_TOKEN" }
}
```

**Куки не конфликтуют**: `XDEBUG_SESSION` и сессия приложения отправляются вместе.
Можно передать куку и разово — `headers: {"Cookie": "session=..."}` в вызове инструмента;
она будет слита с `XDEBUG_SESSION`, а не заменит её.

**Секреты — только в `detective.local.json`**, никогда в `detective.json` (тот в git).
