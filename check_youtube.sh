#!/bin/bash

if [ -t 1 ]; then
  set -x
else
  exec >> /home/cristian/cron_debug.log 2>&1
  set -x
fi

echo "$(date) — Script iniciado"

JQ="/usr/bin/jq"
CURL="/usr/bin/curl"
GREP="/bin/grep"
SED="/bin/sed"

JSON_FILE="/home/cristian/data.json"
N8N_URL="http://192.168.14.9:5678/webhook/d7ce39a5-71b8-4102-8594-44dfa11f7188"

UA="Mozilla/5.0"

ERROR_COUNT=0

while read -r item; do

    name=$("$JQ" -r '.name' <<< "$item")
    url=$("$JQ" -r '.url' <<< "$item")

    echo "Chequeando: $name"

    response=$("$CURL" -s -A "$UA" "$url")

    player_json=$(echo "$response" \
        | "$GREP" -o 'ytInitialPlayerResponse = {.*};' \
        | "$SED" 's/^ytInitialPlayerResponse = //' \
        | "$SED" 's/;$//')

    status=$(echo "$player_json" | "$JQ" -r '.playabilityStatus.status')
    embed=$(echo "$player_json" | "$JQ" -r '.playabilityStatus.playableInEmbed')

    echo "Estado detectado: status=$status embed=$embed"

    if [ "$status" != "OK" ] || [ "$embed" = "false" ]; then

        echo "ALERTA: $name"

        ERROR_COUNT=$((ERROR_COUNT + 1))

        "$CURL" -s -X POST \
            -H "Content-Type: application/json" \
            -d "$item" \
            "$N8N_URL"
    fi

done < <("$JQ" -c '.[]' "$JSON_FILE")

echo "$(date) — Script finalizado | Alertas enviadas: $ERROR_COUNT"