#!/bin/bash

# Configuración de logs para Cron
if [ -t 1 ]; then
  # Si se ejecuta manualmente, mostrar comandos
  set -x
else
  # Si es por Cron, volcar a archivo
  exec >> /home/cristian/cron_debug.log 2>&1
  set -x
fi

echo "=========================================="
echo "$(date) — Script iniciado"

# Rutas de binarios
JQ="/usr/bin/jq"
CURL="/usr/bin/curl"
SED="/bin/sed"

# Archivos y URLs
JSON_FILE="/home/cristian/data.json"
N8N_URL="http://192.168.14.9:5678/webhook/d7ce39a5-71b8-4102-8594-44dfa11f7188"

# User Agent y cabeceras para evitar bloqueos (simula un navegador real)
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

ERROR_COUNT=0

# Procesar el JSON de forma segura
# Usamos el descriptor de archivo 3 para no interferir con el stdin (0) que usan curl/jq
while read -u 3 -r item; do

    name=$(echo "$item" | "$JQ" -r '.name')
    url=$(echo "$item" | "$JQ" -r '.url')

    # Filtrar solo YouTube
    if [[ "$url" != *"youtube.com"* ]] && [[ "$url" != *"youtu.be"* ]]; then
        echo "Saltando (No es YouTube): $name"
        continue
    fi

    echo "------------------------------------------"
    echo "Chequeando: $name"

    # Petición con cabeceras de navegador reales
    # Agregamos --compressed y cabeceras de idioma para parecer un usuario real
    response=$("$CURL" -s -L -A "$UA" \
        -H "Accept-Language: es-419,es;q=0.9" \
        -H "Cache-Control: no-cache" \
        --compressed \
        "$url" < /dev/null)

    # Extracción profesional del JSON de estado usando sed
    player_json=$(echo "$response" | "$SED" -n 's/.*ytInitialPlayerResponse *= *\({.*}\);*.*/\1/p')

    # Validar si YouTube nos bloqueó por bot (falsos negativos)
    if [[ -z "$player_json" ]] || [[ "$player_json" == *"captcha"* ]]; then
        echo "AVISO: YouTube bloqueó la petición para $name. Saltando para evitar alerta falsa."
        continue
    fi

    # Extraer status y motivo
    status=$(echo "$player_json" | "$JQ" -r '.playabilityStatus.status' 2>/dev/null)
    reason=$(echo "$player_json" | "$JQ" -r '.playabilityStatus.reason' 2>/dev/null)

    echo "Resultado: status=$status | motivo=$reason"

    # Lógica de Alerta Refinada
    # Solo disparamos si el status NO es OK, no es nulo y no es vacío.
    if [[ "$status" != "OK" ]] && [[ "$status" != "null" ]] && [[ -n "$status" ]]; then

        echo "ALERTA CONFIRMADA: $name está caído."
        ERROR_COUNT=$((ERROR_COUNT + 1))

        # Notificar a n8n
        "$CURL" -s -X POST \
            -H "Content-Type: application/json" \
            -d "$item" \
            "$N8N_URL" < /dev/null
    else
        echo "Check exitoso: $name está funcionando."
    fi

done 3< <("$JQ" -c '.[]' "$JSON_FILE")

echo "------------------------------------------"
echo "$(date) — Script finalizado | Alertas enviadas: $ERROR_COUNT"
echo "=========================================="