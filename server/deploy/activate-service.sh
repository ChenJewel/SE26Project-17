#!/usr/bin/env bash
set -euo pipefail

cd /opt/ueat/server
npm ci
npm run build

install -d -m 700 /etc/ueat
if [ ! -f /etc/ueat/ueat-server.env ]; then
  umask 077
  printf 'AI_PRIVACY_HASH_SECRET=%s\n' "$(openssl rand -hex 32)" > /etc/ueat/ueat-server.env
fi

cp deploy/ueat-server.service /etc/systemd/system/ueat-server.service
cp deploy/ueat-embedding-backfill.service /etc/systemd/system/ueat-embedding-backfill.service
cp deploy/ueat-embedding-backfill.timer /etc/systemd/system/ueat-embedding-backfill.timer
cp deploy/ueat-recommendation-backfill.service /etc/systemd/system/ueat-recommendation-backfill.service
cp deploy/ueat-recommendation-backfill.timer /etc/systemd/system/ueat-recommendation-backfill.timer
systemctl daemon-reload
systemctl enable --now ueat-server
systemctl enable --now ueat-embedding-backfill.timer
systemctl enable --now ueat-recommendation-backfill.timer
systemctl restart ueat-server

cp deploy/nginx-ueat.conf /etc/nginx/sites-available/ueat
ln -sf /etc/nginx/sites-available/ueat /etc/nginx/sites-enabled/ueat
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

for attempt in $(seq 1 20); do
  if curl -fsS http://127.0.0.1:3000/health && curl -fsS http://127.0.0.1/api/health; then
    exit 0
  fi
  sleep 1
done

curl -fsS http://127.0.0.1:3000/health
curl -fsS http://127.0.0.1/api/health
