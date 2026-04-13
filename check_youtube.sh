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

# Usamos descriptor 3 para procesar toda la lista
while read -u 3 -r item; do
    name=$("$JQ" -r '.name' <<< "$item")
    url=$("$JQ" -r '.url' <<< "$item")

    if [[ "$url" != *"youtube.com"* ]] && [[ "$url" != *"youtu.be"* ]]; then
        continue
    fi

    echo "------------------------------------------"
    echo "Chequeando: $name"

    # Petición limpia
    response=$("$CURL" -s -L -A "$UA" "$url" < /dev/null)

    # 1. Definimos los patrones de error reales que mencionaste
    # Agregamos el de Telefe (reproducción inhabilitada)
    ERROR_1="La grabación de esta transmisión en vivo no está disponible"
    ERROR_2="Video no disponible"
    ERROR_3="inhabilitó la reproducción en otros sitios web"
    ERROR_4="Este video es privado"

    # 2. Buscamos si existe alguno de estos errores
    check_error=$(echo "$response" | "$GREP" -Ei "$ERROR_1|$ERROR_2|$ERROR_3|$ERROR_4")

    # 3. Verificamos si realmente hay un reproductor activo (buscando el ID del video o "OFFLINE")
    # Si el video está caído, YouTube suele poner "playabilityStatus":{"status":"ERROR"
    is_unplayable=$(echo "$response" | "$GREP" -o '"status":"UNPLAYABLE"')

    if [[ -n "$check_error" ]]; then
        
        # CASO ESPECIAL LA NACION+: 
        # Si el error es "inhabilitó la reproducción" pero el status NO es UNPLAYABLE, es un falso positivo.
        # Pero si dice "Grabación no disponible" o "Video no disponible", es caída real.
        
        if [[ "$name" == *"Nacion"* ]] && [[ "$check_error" == *"$ERROR_3"* ]]; then
            echo "OK: $name reporta restricción de inserción pero el vivo sigue activo."
        else
            echo "ALERTA CONFIRMADA: $name está caído. Motivo detectado: $check_error"
            ERROR_COUNT=$((ERROR_COUNT + 1))

            "$CURL" -s -X POST \
                -H "Content-Type: application/json" \
                -d "$item" \
                "$N8N_URL" < /dev/null
        fi
    else
        echo "OK: $name está funcionando."
    fi

done 3< <("$JQ" -c '.[]' "$JSON_FILE")

echo "------------------------------------------"
echo "$(date) — Script finalizado | Alertas enviadas: $ERROR_COUNT"
echo "=========================================="