#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="${XDG_DATA_HOME:-$HOME/.local/share}"
INSTALL_DIR="$DATA_DIR/kwin/scripts/dalila"
OLD_CONFIG_GROUP="Script-app-placement-rules"
NEW_CONFIG_GROUP="Script-dalila"
MIGRATION_MARKER="legacyAppPlacementRulesMigrated"

for command_name in kreadconfig6 kwriteconfig6 qdbus6; do
    if ! command -v "$command_name" >/dev/null 2>&1; then
        echo "Erro: comando necessário não encontrado: $command_name" >&2
        exit 1
    fi
done

echo "Copiando Dalila para $INSTALL_DIR"
install -d "$INSTALL_DIR/contents"
install -m 644 "$PROJECT_DIR/metadata.json" "$INSTALL_DIR/metadata.json"
cp -a "$PROJECT_DIR/contents/." "$INSTALL_DIR/contents/"

# Transfere as regras personalizadas para o grupo do novo ID, uma única vez.
MIGRATION_DONE="$(kreadconfig6 --file kwinrc --group "$NEW_CONFIG_GROUP" --key "$MIGRATION_MARKER" --default false)"
if [[ "$MIGRATION_DONE" != "true" ]]; then
    for rule_number in {1..10}; do
        for field in Match Monitor Desktop; do
            key="rule${rule_number}${field}"
            value="$(kreadconfig6 --file kwinrc --group "$OLD_CONFIG_GROUP" --key "$key" --default '__DALILA_MISSING__')"
            if [[ "$value" != "__DALILA_MISSING__" ]]; then
                current_value="$(kreadconfig6 --file kwinrc --group "$NEW_CONFIG_GROUP" --key "$key" --default '__DALILA_MISSING__')"
                if [[ "$current_value" == "__DALILA_MISSING__" ]]; then
                    if [[ "$field" == "Match" ]]; then
                        value_type="string"
                    else
                        value_type="int"
                    fi
                    kwriteconfig6 --file kwinrc --group "$NEW_CONFIG_GROUP" --key "$key" --type "$value_type" "$value"
                fi
            fi
        done
    done
    kwriteconfig6 --file kwinrc --group "$NEW_CONFIG_GROUP" --key "$MIGRATION_MARKER" true --type bool
fi

kwriteconfig6 --file kwinrc --group Plugins --key dalilaEnabled true
kwriteconfig6 --file kwinrc --group Plugins --key app-placement-rulesEnabled false
qdbus6 org.kde.KWin /KWin reconfigure

# Força a troca da instância do script para garantir que o código copiado seja usado.
qdbus6 org.kde.KWin /Scripting org.kde.kwin.Scripting.unloadScript app-placement-rules >/dev/null 2>&1 || true
qdbus6 org.kde.KWin /Scripting org.kde.kwin.Scripting.unloadScript dalila >/dev/null 2>&1 || true
qdbus6 org.kde.KWin /Scripting org.kde.kwin.Scripting.loadScript \
    "$INSTALL_DIR/contents/code/main.js" dalila

echo "Dalila instalado e recarregado. O compositor KWin não foi reiniciado."
