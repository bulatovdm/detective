#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DETECTIVE_DIR="$(dirname "$SCRIPT_DIR")"
LINK_SCRIPT="$SCRIPT_DIR/link.sh"
SYMLINK_PATH="$HOME/.local/bin/detective"

install_detective() {
    npm --prefix "$DETECTIVE_DIR" run build --silent 2>/dev/null || {
        echo "Building Detective..."
        npm --prefix "$DETECTIVE_DIR" run build
    }

    chmod +x "$LINK_SCRIPT"
    mkdir -p "$(dirname "$SYMLINK_PATH")"

    if [[ -L "$SYMLINK_PATH" ]]; then
        rm "$SYMLINK_PATH"
    fi

    ln -s "$LINK_SCRIPT" "$SYMLINK_PATH"
    echo "  Linked: $SYMLINK_PATH -> $LINK_SCRIPT"

    remove_alias "$HOME/.zshrc"
    remove_alias "$HOME/.bashrc"
}

uninstall_detective() {
    if [[ -L "$SYMLINK_PATH" ]]; then
        rm "$SYMLINK_PATH"
        echo "  Removed: $SYMLINK_PATH"
    else
        echo "  Not installed: $SYMLINK_PATH"
    fi

    remove_alias "$HOME/.zshrc"
    remove_alias "$HOME/.bashrc"
}

remove_alias() {
    local rc_file="$1"
    [[ ! -f "$rc_file" ]] && return
    if grep -q "alias detective=" "$rc_file" 2>/dev/null; then
        sed -i '' '/alias detective=/d' "$rc_file"
        echo "  Cleaned up old alias from $rc_file"
    fi
}

case "${1:-}" in
    install)
        echo "Installing detective..."
        install_detective
        echo ""
        echo "Done. Usage:"
        echo "  cd /path/to/project"
        echo "  detective link . https://myapp.local"
        echo "  detective status"
        ;;

    uninstall)
        echo "Uninstalling detective..."
        uninstall_detective
        echo ""
        echo "Done."
        ;;

    *)
        echo "Usage: $0 <install|uninstall>"
        echo ""
        echo "  install    - Build and install 'detective' to /usr/local/bin"
        echo "  uninstall  - Remove 'detective' from /usr/local/bin"
        exit 1
        ;;
esac
