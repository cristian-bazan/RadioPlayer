#!/bin/bash

# =========================
# DEBUG / LOG PARA CRON
# =========================
if [ -t 1 ]; then
  # Ejecución manual
  set -x
else
  # Ejecución por cron
  exec >> /home/cristian/cron_debug.log 2>&1
  set -x
fi

echo "$(date) — Script iniciado"

# =========================
# BINARIOS (RUTAS ABSOLUTAS)
# =========================
JQ="/usr/bin/jq"
CURL="/usr/bin/curl"
GREP="/bin/grep"

# =========================
# CONFIG
# =========================
JSON_FILE="/home/cristian/data.json"
N8N_URL="http://192.168.14.9:5678/webhook/d7ce39a5-71b8-4102-8594-44dfa11f7188"

TARGET_PHRASE1="La grabación de esta transmisión en vivo no está disponible."
TARGET_PHRASE2="Video no disponible"
TARGET_PHRASE3="Este video es privado"

# =========================
# CONTADOR GLOBAL
# =========================
ERROR_COUNT=0

# =========================
# LOOP PRINCIPAL
# (process substitution para que el contador funcione)
# =========================
while read -r item; do
    url=$("$JQ" -r '.url' <<< "$item")

    response=$("$CURL" -s "$url")

    if echo "$response" | "$GREP" -q -E "$TARGET_PHRASE1|$TARGET_PHRASE2|$TARGET_PHRASE3"; then
        ERROR_COUNT=$((ERROR_COUNT + 1))

        "$CURL" -s -X POST \
            -H "Content-Type: application/json" \
            -d "$item" \
            "$N8N_URL"
    fi
done < <("$JQ" -c '.[]' "$JSON_FILE")

# =========================
# RESULTADO FINAL
# =========================
echo "$(date) — Script finalizado | Páginas con error enviadas a n8n: $ERROR_COUNT"

