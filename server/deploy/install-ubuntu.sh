#!/usr/bin/env bash
set -euo pipefail

apt update
apt install -y curl ffmpeg git nginx unzip postgresql postgresql-contrib

if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt install -y nodejs
fi

node -v
npm -v

mkdir -p /opt/ueat

bash /opt/ueat/server/deploy/setup-postgres.sh

if [ -f /opt/ueat/server/package-lock.json ]; then
  cd /opt/ueat/server
  npm ci --omit=dev
fi
