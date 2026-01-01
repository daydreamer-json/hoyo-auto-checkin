#!/bin/sh

mkdir -p config

if [ -f "config/config_auth.yaml.enc" ] && \
   [ -n "${CONFIG_AUTH_ENCRYPTION_KEY}" ] && \
   [ -n "${CONFIG_AUTH_ENCRYPTION_IV}" ]; then
  openssl enc -d \
    -in config/config_auth.yaml.enc \
    -out config/config_auth.yaml \
    -aes-256-cbc \
    -K "${CONFIG_AUTH_ENCRYPTION_KEY}" \
    -iv "${CONFIG_AUTH_ENCRYPTION_IV}" || exit 1
else
  printf "%s" "${CONFIG_AUTH_YAML}" > config/config_auth.yaml
fi
