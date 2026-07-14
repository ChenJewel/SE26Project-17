#!/usr/bin/env bash
set -euo pipefail

cd /opt/ueat/server
npm ci
npm run build

cp deploy/ueat-server.service /etc/systemd/system/ueat-server.service
systemctl daemon-reload
systemctl enable --now ueat-server
systemctl restart ueat-server

cp deploy/nginx-ueat.conf /etc/nginx/sites-available/ueat
ln -sf /etc/nginx/sites-available/ueat /etc/nginx/sites-enabled/ueat
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

curl -fsS http://127.0.0.1:3000/health
curl -fsS http://127.0.0.1/api/health
