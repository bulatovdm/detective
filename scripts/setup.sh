#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DETECTIVE_DIR="$(dirname "$SCRIPT_DIR")"
LINK_SCRIPT="$SCRIPT_DIR/link.sh"
ALIAS_LINE="alias detective='$LINK_SCRIPT'"

add_alias() {
    local rc_file="$1"

    if [[ ! -f "$rc_file" ]]; then
        return 1
    fi

    if grep -q "alias detective=" "$rc_file" 2>/dev/null; then
        sed -i '' "s|alias detective=.*|$ALIAS_LINE|" "$rc_file"
        echo "  Updated alias in $rc_file"
    else
        printf '\n%s\n' "$ALIAS_LINE" >> "$rc_file"
        echo "  Added alias to $rc_file"
    fi
    return 0
}

remove_alias() {
    local rc_file="$1"

    if [[ ! -f "$rc_file" ]]; then
        return 1
    fi

    if grep -q "alias detective=" "$rc_file" 2>/dev/null; then
        sed -i '' '/alias detective=/d' "$rc_file"
        echo "  Removed alias from $rc_file"
    else
        echo "  No alias found in $rc_file"
    fi
    return 0
}

case "${1:-}" in
    install)
        echo "Installing detective alias..."

        npm --prefix "$DETECTIVE_DIR" run build --silent 2>/dev/null || {
            echo "Building Detective..."
            npm --prefix "$DETECTIVE_DIR" run build
        }

        chmod +x "$LINK_SCRIPT"

        added=false
        for rc in "$HOME/.zshrc" "$HOME/.bashrc"; do
            if add_alias "$rc"; then
                added=true
            fi
        done

        if [[ "$added" == false ]]; then
            echo "  No .zshrc or .bashrc found. Add manually:"
            echo "  $ALIAS_LINE"
        fi

        echo ""
        echo "Done. Run 'source ~/.zshrc' or restart terminal, then:"
        echo "  cd /path/to/project"
        echo "  detective link . https://myapp.local"
        echo "  detective status"
        ;;

    uninstall)
        echo "Removing detective alias..."

        for rc in "$HOME/.zshrc" "$HOME/.bashrc"; do
            remove_alias "$rc"
        done

        echo ""
        echo "Done."
        ;;

    *)
        echo "Usage: $0 <install|uninstall>"
        echo ""
        echo "  install    - Add 'detective' alias to shell config"
        echo "  uninstall  - Remove 'detective' alias"
        exit 1
        ;;
esac
