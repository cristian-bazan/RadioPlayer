#!/bin/bash

# Configuración de logs para Cron
if [ -t 1 ]; then
  set -x
else
  exec >> /home/cristian/cron_debug.log 2>&1
  set -x
fi

echo "$(date) — Script iniciado"

# Rutas de binarios
JQ="/usr/bin/jq"
CURL="/usr/bin/curl"
GREP="/bin/grep"

# Archivos y URLs
JSON_FILE="/home/cristian/data.json"
N8N_URL="http://192.168.14.9:5678/webhook/d7ce39a5-71b8-4102-8594-44dfa11f7188"

# User Agent real para evitar bloqueos/falsos positivos de YouTube
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

ERROR_COUNT=0

while read -r item; do

    name=$("$JQ" -r '.name' <<< "$item")
    url=$("$JQ" -r '.url' <<< "$item")

    # VALIDACIÓN: Si no es una URL de YouTube, saltar (evita falsos positivos en radios/m3u8)
    if [[ "$url" != *"youtube.com"* ]] && [[ "$url" != *"youtu.be"* ]]; then
        echo "Saltando (No es YouTube): $name"
        continue
    fi

    echo "Chequeando YouTube: $name"

    # Petición con seguimiento de redirecciones (-L)
    response=$("$CURL" -s -L -A "$UA" "$url")

    # Extracción profesional del JSON de estado
    # Buscamos la variable ytInitialPlayerResponse y extraemos solo el objeto JSON { ... }
    player_json=$(echo "$response" | "$GREP" -oP 'ytInitialPlayerResponse\s*=\s*\K({.*?})(?=;)')

    # Si no se pudo extraer el JSON, no disparamos alerta para evitar falso positivo
    if [ -z "$player_json" ]; then
        echo "Aviso: No se pudo obtener metadata de $name. Saltando para evitar error falso."
        continue
    fi

    # Extraer variables con JQ
    status=$(echo "$player_json" | "$JQ" -r '.playabilityStatus.status' 2>/dev/null)
    # Nota: Algunos en vivo no tienen 'playableInEmbed', usamos 'OK' como métrica principal
    
    echo "Estado detectado para $name: status=$status"

    # CONDICIÓN DE ERROR: Solo si el status NO es OK y el status NO es nulo
    if [ "$status" != "OK" ] && [ "$status" != "null" ] && [ -n "$status" ]; then

        echo "ALERTA CONFIRMADA: $name está caído o restringido."

        ERROR_COUNT=$((ERROR_COUNT + 1))

        "$CURL" -s -X POST \
            -H "Content-Type: application/json" \
            -d "$item" \
            "$N8N_URL"
    fi

done < <("$JQ" -c '.[]' "$JSON_FILE")

echo "$(date) — Script finalizado | Alertas enviadas: $ERROR_COUNT"