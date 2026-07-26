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
- **verbose**: `true` — includes session log in the response (timestamps for each stage: TCP listen, Xdebug connect, breakpoint hit). Use when debugging connection or timeout issues. On errors, session log is included automatically
- Multiple breakpoints in one request — see state "before" and "after"

### Examples

```
# HTTP request with breakpoint
debug_request(url: "/api/endpoint", breakpoints: [{type: "line", file: "app/.../Controller.php", line: 38}], expressions: ["$request", "$result"])

# Console command
debug_command(command: "php bin/console some:command", breakpoints: [{type: "exception", exception: "*"}])
```

### Protected pages (authentication)

If the application requires a login, requesting a protected URL returns 401 or a redirect and
breakpoints inside the controller never fire. Do not work around this by disabling the guard —
configure authentication in `detective.local.json` (git-ignored, created by `link`):

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

Detective logs in on its own, caches the cookie and attaches it to every request.
For an API key instead of a login form:

```jsonc
{
  "auth": { "type": "header", "header": "X-Auth-Token", "valueEnv": "DETECTIVE_TOKEN" }
}
```

**Cookies do not clash**: `XDEBUG_SESSION` and the application session are sent together.
A cookie can also be passed per call — `headers: {"Cookie": "session=..."}` — and it is merged
with `XDEBUG_SESSION` rather than replacing it.

**Keep secrets in `detective.local.json` only**, never in `detective.json` (that one is committed).
