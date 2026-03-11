#!/bin/bash

if [ -t 1 ]; then
  set -x
else
  exec >> /home/cristian/cron_debug.log 2>&1
  set -x
fi

echo "$(date) — Script radio iniciado"

JQ="/usr/bin/jq"
CURL="/usr/bin/curl"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
JSON_FILE="$SCRIPT_DIR/data.json"

N8N_URL="http://192.168.14.9:5678/webhook/d7ce39a5-71b8-4102-8594-44dfa11f7188"

ERROR_COUNT=0

while IFS= read -r item; do

    url=$("$JQ" -r '.url' <<< "$item")

    code=$("$CURL" \
        --range 0-100 \
        -s -L \
        -o /dev/null \
        -w "%{http_code}" \
        --max-time 5 \
        "$url")

    if [ "$code" != "200" ] && [ "$code" != "206" ]; then

        ERROR_COUNT=$((ERROR_COUNT + 1))

        "$CURL" -s -X POST \
            -H "Content-Type: application/json" \
            -d "$item" \
            "$N8N_URL"

        echo "$(date) — ERROR radio: $url | HTTP $code"

    else
        echo "$(date) — OK radio: $url | HTTP $code"
    fi

done < <("$JQ" -c '.[] | select(.type=="radio")' "$JSON_FILE")

echo "$(date) — Script radio finalizado | Radios con error: $ERROR_COUNT"
