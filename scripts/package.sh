#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_DIR="$PROJECT_DIR/dist"
OUTPUT_FILE="$OUTPUT_DIR/Dalila.kwinscript"

if ! command -v zip >/dev/null 2>&1; then
    echo "Erro: instale o comando 'zip' para gerar o pacote .kwinscript." >&2
    exit 1
fi

mkdir -p "$OUTPUT_DIR"
TEMP_DIR="$(mktemp -d "$OUTPUT_DIR/.Dalila.XXXXXX")"
TEMP_FILE="$TEMP_DIR/Dalila.kwinscript"
trap 'rm -f "$TEMP_FILE"; rmdir "$TEMP_DIR"' EXIT

(
    cd "$PROJECT_DIR"
    zip -q -r "$TEMP_FILE" metadata.json contents
)

mv -f "$TEMP_FILE" "$OUTPUT_FILE"
echo "Pacote criado: $OUTPUT_FILE"
