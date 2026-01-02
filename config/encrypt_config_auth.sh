#!/bin/sh

if [ -f "config/config_auth.yaml" ] && \
   [ -n "${CONFIG_AUTH_ENCRYPTION_KEY}" ] && \
   [ -n "${CONFIG_AUTH_ENCRYPTION_IV}" ]; then
  openssl enc \
    -in config/config_auth.yaml \
    -out config/config_auth.yaml.enc \
    -aes-256-cbc \
    -K "${CONFIG_AUTH_ENCRYPTION_KEY}" \
    -iv "${CONFIG_AUTH_ENCRYPTION_IV}" || exit 1
fi
