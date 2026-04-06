<!-- detective:lang:en -->
## Debugging with Detective MCP

When facing issues, use `mcp__detective__debug_request` and `mcp__detective__debug_command` instead of adding logs, var_dump, or guessing from code.

### When to use

1. **API returns unexpected response** — set a breakpoint on the controller/action, inspect runtime data
2. **First 1-2 hypotheses from reading code didn't confirm** — stop guessing, debug
3. **Runtime data issues** — wrong values in entities, unexpected DB results, casting/transformer problems
4. **Console command fails or returns wrong result** — `debug_command` with breakpoints
5. **Unknown exception** — exception breakpoint with `"*"` or a specific class

### Capabilities

- **Line breakpoints**: `{"type": "line", "file": "app/...", "line": 42}` — stop at a line
- **Exception breakpoints**: `{"type": "exception", "exception": "*"}` — catch all exceptions, or a specific class
- **Expressions**: `["$page->toArray()", "$this->data"]` — evaluate expressions in breakpoint context
- **maxDepth**: 1-10, object expansion depth (default to 2-3)
- **HTTP Response**: status and body in `debug_request`
- **Command Output**: stdout/stderr and exit code in `debug_command`
- Multiple breakpoints in one request — see state "before" and "after"

### Examples

```
# HTTP request with breakpoint
debug_request(url: "/api/endpoint", breakpoints: [{type: "line", file: "app/.../Controller.php", line: 38}], expressions: ["$request", "$result"])

# Console command
debug_command(command: "php bin/console some:command", breakpoints: [{type: "exception", exception: "*"}])
```
