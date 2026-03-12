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
CUT="/usr/bin/cut"
HEAD="/usr/bin/head"

# =========================
# CONFIG
# =========================
JSON_FILE="/home/cristian/data.json"
N8N_URL="http://192.168.14.9:5678/webhook/d7ce39a5-71b8-4102-8594-44dfa11f7188"

# =========================
# CONTADOR GLOBAL
# =========================
ERROR_COUNT=0

# =========================
# LOOP PRINCIPAL
# =========================
while read -r item; do

    name=$("$JQ" -r '.name' <<< "$item")
    url=$("$JQ" -r '.url' <<< "$item")

    echo "Chequeando: $name"

    response=$("$CURL" -s "$url")

    status=$(echo "$response" \
        | "$GREP" -o '"status":"[^"]*"' \
        | "$HEAD" -1 \
        | "$CUT" -d'"' -f4)

    embed=$(echo "$response" \
        | "$GREP" -o '"playableInEmbed":[^,]*' \
        | "$HEAD" -1 \
        | "$CUT" -d':' -f2)

    echo "Estado detectado: $status | Embed: $embed"

    if [ "$status" != "OK" ] || [ "$embed" = "false" ]; then

        echo "ALERTA: $name"

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