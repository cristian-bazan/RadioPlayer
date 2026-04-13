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

# =========================
# BINARIOS
# =========================
JQ="/usr/bin/jq"
CURL="/usr/bin/curl"
GREP="/bin/grep"

# =========================
# CONFIG
# =========================
JSON_FILE="/home/cristian/data.json"
N8N_URL="http://192.168.14.9:5678/webhook/d7ce39a5-71b8-4102-8594-44dfa11f7188"
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

TARGET_PHRASE1="La grabación de esta transmisión en vivo no está disponible."
TARGET_PHRASE2="Video no disponible"
TARGET_PHRASE3="Este video es privado"

ERROR_COUNT=0

# =========================
# LOOP PRINCIPAL
# =========================
# Usamos el descriptor 3 para que CURL no se robe los datos del loop
while read -u 3 -r item; do
    name=$("$JQ" -r '.name' <<< "$item")
    url=$("$JQ" -r '.url' <<< "$item")

    echo "------------------------------------------"
    echo "Chequeando: $name"

    # Solo procesar YouTube para evitar errores con m3u8 o radios mp3
    if [[ "$url" == *"youtube.com"* ]] || [[ "$url" == *"youtu.be"* ]]; then
        
        # Petición con User Agent para evitar bloqueos básicos
        # IMPORTANTE: redireccionamos stdin de curl a /dev/null
        response=$("$CURL" -s -L -A "$UA" "$url" < /dev/null)

        if echo "$response" | "$GREP" -q -E "$TARGET_PHRASE1|$TARGET_PHRASE2|$TARGET_PHRASE3"; then
            echo "ALERTA: $name parece estar caído (Frase detectada)."
            ERROR_COUNT=$((ERROR_COUNT + 1))

            "$CURL" -s -X POST \
                -H "Content-Type: application/json" \
                -d "$item" \
                "$N8N_URL" < /dev/null
        else
            echo "OK: $name funciona correctamente."
        fi
    else
        echo "Saltando: $name (No es un link de YouTube)"
    fi

done 3< <("$JQ" -c '.[]' "$JSON_FILE")

echo "------------------------------------------"
echo "$(date) — Script finalizado | Errores enviados: $ERROR_COUNT"
echo "=========================================="