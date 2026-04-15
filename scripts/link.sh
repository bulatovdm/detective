#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "$0" 2>/dev/null || readlink "$0" 2>/dev/null || echo "$0")")" && pwd)"
DETECTIVE_DIR="$(dirname "$SCRIPT_DIR")"
DETECTIVE_ENTRY="$DETECTIVE_DIR/dist/index.js"
PRESETS_DIR="$DETECTIVE_DIR/presets"

CLAUDE_MD_START="<!-- detective:start -->"
CLAUDE_MD_END="<!-- detective:end -->"

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

create_detective_json_from_preset() {
    local preset="$1"

    if [[ -f "$DETECTIVE_JSON" ]]; then
        echo "  detective.json: already exists"
        return
    fi

    local tpl="$PRESETS_DIR/$preset/detective.json.tpl"
    if [[ ! -f "$tpl" ]]; then
        echo "Error: preset '$preset' not found at $tpl"
        exit 1
    fi

    local content
    content=$(cat "$tpl")

    case "$preset" in
        self)
            content="${content//\{\{domain\}\}/$OPT_DOMAIN}"
            content="${content//\{\{user\}\}/$OPT_USER}"
            ;;
        docker)
            content="${content//\{\{app_url\}\}/$OPT_APP_URL}"
            content="${content//\{\{container\}\}/$OPT_CONTAINER}"
            content="${content//\{\{ide_key\}\}/$OPT_IDE_KEY}"
            content="${content//\{\{container_path\}\}/$OPT_CONTAINER_PATH}"
            content="${content//\{\{host_path\}\}/$PROJECT_DIR}"
            ;;
        default)
            content="${content//\{\{app_url\}\}/$OPT_APP_URL}"
            ;;
    esac

    echo "$content" > "$DETECTIVE_JSON"
    echo "  detective.json: created (preset: $preset)"
}

remove_detective_json() {
    if [[ -f "$DETECTIVE_JSON" ]]; then
        rm "$DETECTIVE_JSON"
        echo "  detective.json: removed"
    else
        echo "  detective.json: not found"
    fi
}

find_claude_md() {
    if [[ -f "$PROJECT_DIR/.claude/CLAUDE.md" ]]; then
        echo "$PROJECT_DIR/.claude/CLAUDE.md"
    elif [[ -f "$PROJECT_DIR/CLAUDE.md" ]]; then
        echo "$PROJECT_DIR/CLAUDE.md"
    else
        echo ""
    fi
}

inject_claude_md() {
    local lang="${1:-ru}"
    local tpl="$PRESETS_DIR/claude-md/$lang.md"

    if [[ ! -f "$tpl" ]]; then
        echo "  CLAUDE.md: template '$lang' not found"
        return
    fi

    local claude_md
    claude_md=$(find_claude_md)

    local block
    block=$(printf '%s\n%s\n%s' "$CLAUDE_MD_START" "$(cat "$tpl")" "$CLAUDE_MD_END")

    if [[ -z "$claude_md" ]]; then
        mkdir -p "$PROJECT_DIR/.claude"
        claude_md="$PROJECT_DIR/.claude/CLAUDE.md"
        echo "$block" > "$claude_md"
        echo "  CLAUDE.md: created at .claude/CLAUDE.md"
        return
    fi

    if grep -q "$CLAUDE_MD_START" "$claude_md" 2>/dev/null; then
        replace_claude_md_section "$claude_md" "$tpl"
        echo "  CLAUDE.md: updated detective section"
    else
        printf '\n\n%s' "$block" >> "$claude_md"
        echo "  CLAUDE.md: appended detective section"
    fi
}

replace_claude_md_section() {
    local file="$1"
    local tpl="$2"
    local temp
    temp=$(mktemp)

    node -e "
        const fs = require('fs');
        const content = fs.readFileSync('$file', 'utf-8');
        const tpl = fs.readFileSync('$tpl', 'utf-8');
        const start = '$CLAUDE_MD_START';
        const end = '$CLAUDE_MD_END';
        const regex = new RegExp(
            start.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\\$&') +
            '[\\\\s\\\\S]*?' +
            end.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\\$&')
        );
        const block = start + '\n' + tpl + '\n' + end;
        fs.writeFileSync('$temp', content.replace(regex, block));
    "
    mv "$temp" "$file"
}

remove_claude_md_section() {
    local claude_md
    claude_md=$(find_claude_md)

    if [[ -z "$claude_md" ]]; then
        echo "  CLAUDE.md: not found"
        return
    fi

    if ! grep -q "$CLAUDE_MD_START" "$claude_md" 2>/dev/null; then
        echo "  CLAUDE.md: no detective section"
        return
    fi

    local temp
    temp=$(mktemp)

    node -e "
        const fs = require('fs');
        const content = fs.readFileSync('$claude_md', 'utf-8');
        const start = '$CLAUDE_MD_START';
        const end = '$CLAUDE_MD_END';
        const regex = new RegExp(
            '\\\\n*' +
            start.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\\$&') +
            '[\\\\s\\\\S]*?' +
            end.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\\$&') +
            '\\\\n*'
        );
        const result = content.replace(regex, '\\n').trim();
        if (result.length === 0) {
            fs.unlinkSync('$claude_md');
        } else {
            fs.writeFileSync('$temp', result + '\\n');
        }
    "

    if [[ -f "$temp" ]] && [[ -s "$temp" ]]; then
        mv "$temp" "$claude_md"
        echo "  CLAUDE.md: removed detective section"
    elif [[ ! -f "$claude_md" ]]; then
        rm -f "$temp"
        echo "  CLAUDE.md: removed (was empty)"
    else
        rm -f "$temp"
        echo "  CLAUDE.md: removed detective section"
    fi
}

detect_claude_md_lang() {
    local claude_md
    claude_md=$(find_claude_md)

    if [[ -z "$claude_md" ]]; then
        echo "ru"
        return
    fi

    if grep -q "detective:lang:en" "$claude_md" 2>/dev/null; then
        echo "en"
    else
        echo "ru"
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

    local claude_md
    claude_md=$(find_claude_md)
    if [[ -n "$claude_md" ]] && grep -q "$CLAUDE_MD_START" "$claude_md" 2>/dev/null; then
        local lang
        lang=$(detect_claude_md_lang)
        echo "  CLAUDE.md: detective section present (lang: $lang)"
    elif [[ -n "$claude_md" ]]; then
        echo "  CLAUDE.md: exists, no detective section"
    else
        echo "  CLAUDE.md: not found"
    fi
}

parse_flags() {
    OPT_PRESET=""
    OPT_DOMAIN=""
    OPT_USER=""
    OPT_LANG=""
    OPT_APP_URL=""
    OPT_CONTAINER=""
    OPT_IDE_KEY=""
    OPT_CONTAINER_PATH=""
    OPT_PROJECT=""

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --preset)  OPT_PRESET="$2"; shift 2 ;;
            --domain)  OPT_DOMAIN="$2"; shift 2 ;;
            --user)    OPT_USER="$2"; shift 2 ;;
            --lang)    OPT_LANG="$2"; shift 2 ;;
            --url)     OPT_APP_URL="$2"; shift 2 ;;
            --container) OPT_CONTAINER="$2"; shift 2 ;;
            --ide-key) OPT_IDE_KEY="$2"; shift 2 ;;
            --container-path) OPT_CONTAINER_PATH="$2"; shift 2 ;;
            -*)        echo "Unknown flag: $1"; exit 1 ;;
            *)
                if [[ -z "$OPT_PROJECT" ]]; then
                    OPT_PROJECT="$1"
                fi
                shift
                ;;
        esac
    done
}

prompt_preset() {
    if [[ -n "$OPT_PRESET" ]]; then
        return
    fi

    echo ""
    echo "Choose preset:"
    echo "  1) SELF Framework"
    echo "  2) Docker"
    echo "  3) Default (basic PHP/Xdebug)"
    read -rp "Preset [3]: " choice
    case "$choice" in
        1) OPT_PRESET="self" ;;
        2) OPT_PRESET="docker" ;;
        *) OPT_PRESET="default" ;;
    esac
}

prompt_self_options() {
    if [[ -z "$OPT_DOMAIN" ]]; then
        read -rp "Site domain (e.g. logika3d.local): " OPT_DOMAIN
        if [[ -z "$OPT_DOMAIN" ]]; then
            echo "Error: domain is required for SELF preset"
            exit 1
        fi
    fi

    if [[ -z "$OPT_USER" ]]; then
        read -rp "OrbStack user (e.g. scoliologic) [$OPT_DOMAIN]: " OPT_USER
        OPT_USER="${OPT_USER:-$OPT_DOMAIN}"
    fi
}

prompt_default_options() {
    if [[ -z "$OPT_APP_URL" ]]; then
        read -rp "App URL [http://localhost:8000]: " OPT_APP_URL
        OPT_APP_URL="${OPT_APP_URL:-http://localhost:8000}"
    fi
}

prompt_docker_options() {
    if [[ -z "$OPT_APP_URL" ]]; then
        read -rp "App URL [https://localhost]: " OPT_APP_URL
        OPT_APP_URL="${OPT_APP_URL:-https://localhost}"
    fi

    if [[ -z "$OPT_CONTAINER" ]]; then
        read -rp "Docker container name: " OPT_CONTAINER
        if [[ -z "$OPT_CONTAINER" ]]; then
            echo "Error: container name is required for Docker preset"
            exit 1
        fi
    fi

    if [[ -z "$OPT_IDE_KEY" ]]; then
        read -rp "Xdebug ideKey [VSCODE]: " OPT_IDE_KEY
        OPT_IDE_KEY="${OPT_IDE_KEY:-VSCODE}"
    fi

    if [[ -z "$OPT_CONTAINER_PATH" ]]; then
        read -rp "Project path inside container [/var/www/app]: " OPT_CONTAINER_PATH
        OPT_CONTAINER_PATH="${OPT_CONTAINER_PATH:-/var/www/app}"
    fi
}

prompt_lang() {
    if [[ -n "$OPT_LANG" ]]; then
        return
    fi

    echo ""
    echo "CLAUDE.md language:"
    echo "  1) Русский"
    echo "  2) English"
    read -rp "Language [1]: " choice
    case "$choice" in
        2) OPT_LANG="en" ;;
        *) OPT_LANG="ru" ;;
    esac
}

COMMAND="${1:-}"

case "$COMMAND" in
    link)
        shift
        parse_flags "$@"
        require_project "${OPT_PROJECT:-}"
        ensure_built

        is_already_linked() {
            local claude_md
            claude_md=$(find_claude_md)
            [[ -f "$MCP_JSON" ]] && grep -q '"detective"' "$MCP_JSON" 2>/dev/null \
                && [[ -f "$DETECTIVE_JSON" ]] \
                && [[ -n "$claude_md" ]] && grep -q "$CLAUDE_MD_START" "$claude_md" 2>/dev/null
        }

        if is_already_linked; then
            echo "Detective is already linked to $PROJECT_DIR."
            echo "Use 'detective update' to refresh CLAUDE.md section, or 'detective unlink' first."
            exit 0
        fi

        prompt_preset

        case "$OPT_PRESET" in
            self)    prompt_self_options ;;
            docker)  prompt_docker_options ;;
            default) prompt_default_options ;;
        esac

        prompt_lang

        echo ""
        echo "Linking Detective to $PROJECT_DIR..."
        add_to_mcp_json
        create_detective_json_from_preset "$OPT_PRESET"
        inject_claude_md "$OPT_LANG"
        echo ""
        echo "Done. Restart Claude Code in the project to activate."
        ;;

    unlink)
        shift
        parse_flags "$@"
        require_project "${OPT_PROJECT:-}"

        echo "Unlinking Detective from $PROJECT_DIR..."
        remove_from_mcp_json
        remove_detective_json
        remove_claude_md_section
        echo ""
        echo "Done."
        ;;

    update)
        shift
        parse_flags "$@"
        require_project "${OPT_PROJECT:-}"

        local_lang="${OPT_LANG:-$(detect_claude_md_lang)}"

        echo "Updating Detective CLAUDE.md section in $PROJECT_DIR..."
        inject_claude_md "$local_lang"
        echo ""
        echo "Done."
        ;;

    status)
        shift
        parse_flags "$@"
        require_project "${OPT_PROJECT:-}"

        echo "Detective status:"
        check_status
        ;;

    *)
        echo "Detective — link/unlink MCP server to projects"
        echo ""
        echo "Usage: $0 <command> [project-path] [options]"
        echo ""
        echo "Commands:"
        echo "  link [path] [flags]    - Add Detective to project"
        echo "  unlink [path]          - Remove Detective from project"
        echo "  update [path] [--lang] - Update CLAUDE.md detective section"
        echo "  status [path]          - Check Detective configuration"
        echo ""
        echo "Flags (for link):"
        echo "  --preset self|docker|default  - Environment preset"
        echo "  --domain <name>               - Site domain (SELF preset)"
        echo "  --user <name>                 - OrbStack user (SELF preset)"
        echo "  --url <url>                   - App URL (default/docker preset)"
        echo "  --container <name>            - Docker container name (docker preset)"
        echo "  --ide-key <key>               - Xdebug ideKey (docker preset)"
        echo "  --container-path <path>       - Project path inside container (docker preset)"
        echo "  --lang ru|en                  - CLAUDE.md language"
        echo ""
        echo "If path is omitted, current directory is used."
        echo ""
        echo "Examples:"
        echo "  $0 link ~/projects/myapp --preset self --domain multimedica --lang ru"
        echo "  $0 link ~/projects/myapp --preset docker --url https://app.local --container app-php"
        echo "  $0 link ~/projects/myapp --preset default --url http://localhost:8000"
        echo "  $0 link                  # interactive mode in current directory"
        echo "  $0 update ~/projects/myapp"
        echo "  $0 unlink ~/projects/myapp"
        exit 1
        ;;
esac
