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

# Frases de error específicas
ERROR_PATTERN="\"status\":\"UNPLAYABLE\"|\"status\":\"ERROR\"|video-not-playable-renderer"

ERROR_COUNT=0

# Usamos descriptor 3 para no trabar el loop
while read -u 3 -r item; do
    name=$("$JQ" -r '.name' <<< "$item")
    url=$("$JQ" -r '.url' <<< "$item")

    # Solo procesar YouTube
    if [[ "$url" != *"youtube.com"* ]] && [[ "$url" != *"youtu.be"* ]]; then
        continue
    fi

    echo "------------------------------------------"
    echo "Chequeando: $name"

    # Petición con cabeceras para evitar bloqueos
    response=$("$CURL" -s -L -A "$UA" "$url" < /dev/null)

    # REGLA DE ORO: Buscamos el estado de "playabilityStatus"
    # Esto evita que frases sueltas en el HTML disparen falsas alarmas
    check_error=$(echo "$response" | "$GREP" -oP 'playabilityStatus":\{"status":"\K[^"]+')

    # Si el estado existe y NO es "OK"
    if [[ -n "$check_error" ]] && [[ "$check_error" != "OK" ]]; then
        echo "ALERTA CONFIRMADA: $name está caído. Estado: $check_error"
        ERROR_COUNT=$((ERROR_COUNT + 1))

        "$CURL" -s -X POST \
            -H "Content-Type: application/json" \
            -d "$item" \
            "$N8N_URL" < /dev/null
    else
        # Doble verificación por si el patrón anterior falla (para casos muy específicos)
        if echo "$response" | "$GREP" -q "video-not-playable-renderer"; then
             echo "ALERTA CONFIRMADA: $name no reproducible (renderer)."
             ERROR_COUNT=$((ERROR_COUNT + 1))
             "$CURL" -s -X POST -H "Content-Type: application/json" -d "$item" "$N8N_URL" < /dev/null
        else
             echo "OK: $name está en línea."
        fi
    fi

done 3< <("$JQ" -c '.[]' "$JSON_FILE")

echo "------------------------------------------"
echo "$(date) — Script finalizado | Alertas enviadas: $ERROR_COUNT"
echo "=========================================="