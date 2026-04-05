#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "$0" 2>/dev/null || readlink "$0" 2>/dev/null || echo "$0")")" && pwd)"
DETECTIVE_DIR="$(dirname "$SCRIPT_DIR")"
DETECTIVE_ENTRY="$DETECTIVE_DIR/dist/index.js"

ensure_built() {
    if [[ ! -f "$DETECTIVE_ENTRY" ]]; then
        echo "Error: Detective not built. Run 'npm run build' in $DETECTIVE_DIR"
        exit 1
    fi
}

require_project() {
    local target="${1:-$(pwd)}"
    PROJECT_DIR="$(cd "$target" && pwd)"
    MCP_JSON="$PROJECT_DIR/.mcp.json"
    DETECTIVE_JSON="$PROJECT_DIR/detective.json"
}

add_to_mcp_json() {
    if [[ -f "$MCP_JSON" ]]; then
        if grep -q '"detective"' "$MCP_JSON" 2>/dev/null; then
            echo "  .mcp.json: detective already configured"
            return
        fi

        local temp
        temp=$(mktemp)
        node -e "
            const fs = require('fs');
            const data = JSON.parse(fs.readFileSync('$MCP_JSON', 'utf-8'));
            data.mcpServers = data.mcpServers || {};
            data.mcpServers.detective = {
                type: 'stdio',
                command: 'node',
                args: ['$DETECTIVE_ENTRY', '--config', '$DETECTIVE_JSON']
            };
            fs.writeFileSync('$temp', JSON.stringify(data, null, 2) + '\n');
        "
        mv "$temp" "$MCP_JSON"
        echo "  .mcp.json: added detective"
    else
        cat > "$MCP_JSON" <<EOF
{
  "mcpServers": {
    "detective": {
      "type": "stdio",
      "command": "node",
      "args": [
        "$DETECTIVE_ENTRY",
        "--config",
        "$DETECTIVE_JSON"
      ]
    }
  }
}
EOF
        echo "  .mcp.json: created"
    fi
}

remove_from_mcp_json() {
    if [[ ! -f "$MCP_JSON" ]]; then
        echo "  .mcp.json: not found"
        return
    fi

    if ! grep -q '"detective"' "$MCP_JSON" 2>/dev/null; then
        echo "  .mcp.json: detective not found"
        return
    fi

    local temp
    temp=$(mktemp)
    node -e "
        const fs = require('fs');
        const data = JSON.parse(fs.readFileSync('$MCP_JSON', 'utf-8'));
        if (data.mcpServers) delete data.mcpServers.detective;
        fs.writeFileSync('$temp', JSON.stringify(data, null, 2) + '\n');
    "
    mv "$temp" "$MCP_JSON"
    echo "  .mcp.json: removed detective"
}

create_detective_json() {
    local app_url="${1:-http://localhost:8000}"

    if [[ -f "$DETECTIVE_JSON" ]]; then
        echo "  detective.json: already exists"
        return
    fi

    cat > "$DETECTIVE_JSON" <<EOF
{
  "adapter": "php",
  "app": {
    "url": "$app_url"
  },
  "php": {
    "xdebug": {
      "host": "0.0.0.0",
      "port": 9003,
      "ideKey": "detective"
    }
  }
}
EOF
    echo "  detective.json: created (app: $app_url)"
}

remove_detective_json() {
    if [[ -f "$DETECTIVE_JSON" ]]; then
        rm "$DETECTIVE_JSON"
        echo "  detective.json: removed"
    else
        echo "  detective.json: not found"
    fi
}

check_status() {
    echo "  Project: $PROJECT_DIR"

    if [[ -f "$MCP_JSON" ]] && grep -q '"detective"' "$MCP_JSON" 2>/dev/null; then
        echo "  .mcp.json: detective configured"
    else
        echo "  .mcp.json: detective not configured"
    fi

    if [[ -f "$DETECTIVE_JSON" ]]; then
        local url
        url=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$DETECTIVE_JSON','utf-8')).app.url)" 2>/dev/null || echo "unknown")
        echo "  detective.json: exists (app: $url)"
    else
        echo "  detective.json: not found"
    fi

    if [[ -f "$DETECTIVE_ENTRY" ]]; then
        echo "  Detective build: OK"
    else
        echo "  Detective build: NOT BUILT"
    fi
}

COMMAND="${1:-}"

case "$COMMAND" in
    link)
        shift
        require_project "${1:-}"
        ensure_built
        local_url="${2:-http://localhost:8000}"

        echo "Linking Detective to $PROJECT_DIR..."
        add_to_mcp_json
        create_detective_json "$local_url"
        echo ""
        echo "Done. Restart Claude Code in the project to activate."
        ;;

    unlink)
        shift
        require_project "${1:-}"

        echo "Unlinking Detective from $PROJECT_DIR..."
        remove_from_mcp_json
        remove_detective_json
        echo ""
        echo "Done."
        ;;

    status)
        shift
        require_project "${1:-}"

        echo "Detective status:"
        check_status
        ;;

    *)
        echo "Detective — link/unlink MCP server to projects"
        echo ""
        echo "Usage: $0 <command> [project-path] [options]"
        echo ""
        echo "Commands:"
        echo "  link [path] [app-url]  - Add Detective to project (.mcp.json + detective.json)"
        echo "  unlink [path]          - Remove Detective from project"
        echo "  status [path]          - Check Detective configuration"
        echo ""
        echo "If path is omitted, current directory is used."
        echo ""
        echo "Examples:"
        echo "  $0 link ~/projects/myapp https://myapp.local"
        echo "  $0 link ~/projects/myapp http://localhost:8000"
        echo "  $0 unlink ~/projects/myapp"
        echo "  $0 status ~/projects/myapp"
        exit 1
        ;;
esac
