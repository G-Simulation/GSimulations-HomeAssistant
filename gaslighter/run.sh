#!/usr/bin/with-contenv bashio
if bashio::services.available "mqtt"; then
  export MQTT_HOST="$(bashio::services mqtt host)"
  export MQTT_PORT="$(bashio::services mqtt port)"
  export MQTT_USER="$(bashio::services mqtt username)"
  export MQTT_PASS="$(bashio::services mqtt password)"
else
  bashio::log.warning "Kein MQTT-Broker gefunden (Mosquitto installieren) - laeuft ohne Sensoren."
fi
export MALLOC_ARENA_MAX=2   # weniger Speicher-Verschnitt bei vielen Threads (ab 1.85.39)
exec python3 -u /app/aufnahme.py
