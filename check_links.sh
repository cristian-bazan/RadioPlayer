#!/bin/bash

# Configuración de logs para Cron
if [ -t 1 ]; then
  set -x
else
  exec >> /home/cristian/cron_debug.log 2>&1
  set -x
fi

echo "$(date) — Iniciando chequeo global (YouTube + Radios)"

# Rutas de binarios
JQ="/usr/bin/jq"
CURL="/usr/bin/curl"
GREP="/bin/grep"

# Archivos y URLs
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
JSON_FILE="$SCRIPT_DIR/data.json"
N8N_URL="http://192.168.14.9:5678/webhook/d7ce39a5-71b8-4102-8594-44dfa11f7188"

# User Agent real para evitar bloqueos en YouTube
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

ERROR_COUNT=0

while IFS= read -r item; do

    name=$("$JQ" -r '.name' <<< "$item")
    url=$("$JQ" -r '.url' <<< "$item")
    type=$("$JQ" -r '.type' <<< "$item")

    echo "Procesando: $name ($type)"

    # --- LÓGICA 1: YOUTUBE ---
    if [[ "$url" == *"youtube.com"* ]] || [[ "$url" == *"youtu.be"* ]]; then
        
        response=$("$CURL" -s -L -A "$UA" "$url")
        player_json=$(echo "$response" | "$GREP" -oP 'ytInitialPlayerResponse\s*=\s*\K({.*?})(?=;)')

        if [ -z "$player_json" ]; then
            echo "Aviso: No se pudo obtener metadata de YT para $name. Saltando para evitar falso positivo."
            continue
        fi

        status=$(echo "$player_json" | "$JQ" -r '.playabilityStatus.status' 2>/dev/null)
        
        if [ "$status" != "OK" ] && [ "$status" != "null" ] && [ -n "$status" ]; then
            echo "ERROR YouTube: $name está caído (Status: $status)"
            IS_DOWN=true
        else
            echo "OK YouTube: $name está online"
            IS_DOWN=false
        fi

    # --- LÓGICA 2: RADIOS Y OTROS (HTTP CHECK) ---
    else
        code=$("$CURL" \
            --range 0-100 \
            -s -L -A "$UA" \
            -o /dev/null \
            -w "%{http_code}" \
            --max-time 5 \
            "$url")

        if [ "$code" != "200" ] && [ "$code" != "206" ]; then
            echo "ERROR HTTP: $name está caído (Código: $code)"
            IS_DOWN=true
        else
            echo "OK HTTP: $name está online (Código: $code)"
            IS_DOWN=false
        fi
    fi

    # --- ACCIÓN SI ESTÁ CAÍDO ---
    if [ "$IS_DOWN" = true ]; then
        ERROR_COUNT=$((ERROR_COUNT + 1))
        "$CURL" -s -X POST \
            -H "Content-Type: application/json" \
            -d "$item" \
            "$N8N_URL"
    fi

done < <("$JQ" -c '.[]' "$JSON_FILE")

echo "$(date) — Fin del chequeo. Total de errores enviados: $ERROR_COUNT"