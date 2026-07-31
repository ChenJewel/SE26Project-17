#!/usr/bin/env bash
set -euo pipefail

apt update
apt install -y postgresql postgresql-contrib

systemctl enable postgresql
systemctl start postgresql

if ! su - postgres -c "psql -tAc \"SELECT 1 FROM pg_roles WHERE rolname = 'root'\"" | grep -q 1; then
  su - postgres -c "createuser root"
fi

su - postgres -c "psql -c \"ALTER ROLE root WITH LOGIN\""

if ! su - postgres -c "psql -tAc \"SELECT 1 FROM pg_database WHERE datname = 'ueat'\"" | grep -q 1; then
  su - postgres -c "createdb -O root ueat"
fi

echo "PostgreSQL database ready: postgresql:///ueat?host=/var/run/postgresql"
