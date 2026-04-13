#!/bin/bash

# =========================
# DEBUG / LOG PARA CRON
# =========================
if [ -t 1 ]; then
  set -x
else
  exec >> /home/cristian/cron_debug.log 2>&1
  set -x
fi

echo "=========================================="
echo "$(date) — Script iniciado"

JQ="/usr/bin/jq"
CURL="/usr/bin/curl"
GREP="/bin/grep"

JSON_FILE="/home/cristian/data.json"
N8N_URL="http://192.168.14.9:5678/webhook/d7ce39a5-71b8-4102-8594-44dfa11f7188"
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

ERROR_COUNT=0

# Usamos descriptor 3 para procesar toda la lista sin saltos
while read -u 3 -r item; do
    name=$("$JQ" -r '.name' <<< "$item")
    url=$("$JQ" -r '.url' <<< "$item")
    type=$("$JQ" -r '.type' <<< "$item")

    # Solo procesar YouTube y que sean tipo 'tv' (vivos)
    if [[ "$url" != *"youtube.com"* ]] && [[ "$url" != *"youtu.be"* ]]; then
        continue
    fi

    echo "------------------------------------------"
    echo "Chequeando: $name"

    # Petición con cabeceras completas
    response=$("$CURL" -s -L -A "$UA" \
        -H "Accept-Language: es-419,es;q=0.9" \
        --compressed "$url" < /dev/null)

    # 1. Verificamos si es un vivo activo (Buscamos la marca de "isLive":true)
    is_live=$(echo "$response" | "$GREP" -o '"isLive":true')
    
    # 2. Verificamos el estado técnico (Playability)
    status=$(echo "$response" | "$GREP" -oP 'playabilityStatus":\{"status":"\K[^"]+')

    echo "DEBUG: $name | Status: $status | Live: $is_live"

    # LÓGICA DE ALERTA:
    # Si el status es claramente un error (UNPLAYABLE, ERROR, LOGIN_REQUIRED)
    # O si es una TV y no encontramos la marca de "isLive":true
    
    ALERTA="NO"
    
    if [[ "$status" == "UNPLAYABLE" ]] || [[ "$status" == "ERROR" ]] || [[ "$status" == "LOGIN_REQUIRED" ]]; then
        # Doble check: Si dice UNPLAYABLE pero tiene "isLive":true, a veces es un falso positivo del bot
        if [[ -z "$is_live" ]]; then
            ALERTA="SI"
        fi
    fi

    if [ "$ALERTA" == "SI" ]; then
        echo "ALERTA CONFIRMADA: $name está caído."
        ERROR_COUNT=$((ERROR_COUNT + 1))

        "$CURL" -s -X POST \
            -H "Content-Type: application/json" \
            -d "$item" \
            "$N8N_URL" < /dev/null
    else
        echo "OK: $name está correcto."
    fi

done 3< <("$JQ" -c '.[]' "$JSON_FILE")

echo "------------------------------------------"
echo "$(date) — Script finalizado | Alertas enviadas: $ERROR_COUNT"
echo "=========================================="