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
