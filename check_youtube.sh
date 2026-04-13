#!/bin/bash

# Configuración de logs
if [ -t 1 ]; then
  set -x
else
  exec >> /home/cristian/cron_debug.log 2>&1
  set -x
fi

echo "$(date) — Script iniciado"

JQ="/usr/bin/jq"
CURL="/usr/bin/curl"
JSON_FILE="/home/cristian/data.json"
N8N_URL="http://192.168.14.9:5678/webhook/d7ce39a5-71b8-4102-8594-44dfa11f7188"
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

ERROR_COUNT=0

# Procesar el JSON línea por línea
while read -r item; do
    # Extraer datos usando strings directamente para no perder el flujo
    name=$(echo "$item" | "$JQ" -r '.name')
    url=$(echo "$item" | "$JQ" -r '.url')

    if [[ "$url" != *"youtube.com"* ]] && [[ "$url" != *"youtu.be"* ]]; then
        echo "Saltando (No es YouTube): $name"
        continue
    fi

    echo "------------------------------------------"
    echo "Chequeando YouTube: $name ($url)"

    # -L sigue redirecciones, -s silencioso, < /dev/null evita que curl consuma el stdin del bucle
    response=$("$CURL" -s -L -A "$UA" "$url" < /dev/null)

    # Extracción más robusta del JSON de YouTube
    player_json=$(echo "$response" | sed -n 's/.*ytInitialPlayerResponse *= *\({.*}\);*.*/\1/p')

    if [ -z "$player_json" ]; then
        echo "Aviso: No se pudo extraer JSON de $name. Posible cambio de formato en YT o bloqueo."
        continue
    fi

    # Extraer status
    status=$(echo "$player_json" | "$JQ" -r '.playabilityStatus.status' 2>/dev/null)
    reason=$(echo "$player_json" | "$JQ" -r '.playabilityStatus.reason' 2>/dev/null)

    echo "Estado para $name: $status"

    # Lógica de Alerta: Si NO es OK, notificamos
    if [ "$status" != "OK" ] && [ -n "$status" ] && [ "$status" != "null" ]; then
        echo "ALERTA: $name está caído. Motivo: $reason"
        ERROR_COUNT=$((ERROR_COUNT + 1))

        # Enviar a n8n (importante el < /dev/null aquí también)
        "$CURL" -s -X POST \
            -H "Content-Type: application/json" \
            -d "$item" \
            "$N8N_URL" < /dev/null
    fi

done < <("$JQ" -c '.[]' "$JSON_FILE")

echo "------------------------------------------"
echo "$(date) — Script finalizado | Alertas enviadas: $ERROR_COUNT"