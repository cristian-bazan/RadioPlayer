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

# User Agent de un iPhone para que YT entregue una versión más simplificada y fácil de leer
UA="Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1"

ERROR_COUNT=0

# Usamos descriptor 3 para procesar toda la lista
while read -u 3 -r item; do
    name=$("$JQ" -r '.name' <<< "$item")
    url=$("$JQ" -r '.url' <<< "$item")

    # Solo procesar YouTube
    if [[ "$url" != *"youtube.com"* ]] && [[ "$url" != *"youtu.be"* ]]; then
        continue
    fi

    echo "------------------------------------------"
    echo "Chequeando: $name"

    # 1. Obtenemos el Código HTTP (200, 404, etc) y el cuerpo por separado
    # Usamos un timeout de 10 segundos para no trabar el script
    response_data=$("$CURL" -s -L -A "$UA" --max-time 10 "$url" < /dev/null)
    
    # 2. Lógica de detección de "Caído":
    # Buscamos patrones que SOLO aparecen cuando el video NO existe o NO es un vivo.
    # Pattern A: El video no existe o es privado
    # Pattern B: La estructura típica de error en la versión móvil
    is_not_available=$(echo "$response_data" | "$GREP" -Ei "video-not-playable-renderer|reason\":\"Video no disponible\"|reason\":\"Este video es privado\"")
    
    # 3. Verificamos si hay rastro de que sea un vivo (para evitar el falso positivo de La Nación+)
    has_live_indicator=$(echo "$response_data" | "$GREP" -Ei "LIVE|en vivo|isLive\":true")

    if [[ -n "$is_not_available" ]]; then
        # Si dice que no está disponible, pero encontramos indicadores de "LIVE", 
        # lo tomamos como un falso positivo de bot y NO alertamos.
        if [[ -n "$has_live_indicator" ]]; then
            echo "OK (Falso positivo evitado): $name parece funcionar pero YT intenta bloquearnos."
        else
            echo "ALERTA CONFIRMADA: $name está caído realmente."
            ERROR_COUNT=$((ERROR_COUNT + 1))

            "$CURL" -s -X POST \
                -H "Content-Type: application/json" \
                -d "$item" \
                "$N8N_URL" < /dev/null
        fi
    else
        echo "OK: $name está correcto."
    fi

done 3< <("$JQ" -c '.[]' "$JSON_FILE")

echo "------------------------------------------"
echo "$(date) — Script finalizado | Alertas enviadas: $ERROR_COUNT"
echo "=========================================="