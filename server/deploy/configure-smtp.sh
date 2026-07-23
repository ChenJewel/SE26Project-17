#!/usr/bin/env bash
set -euo pipefail

env_file="/etc/ueat/ueat-server.env"
install -d -m 700 /etc/ueat
touch "$env_file"
chmod 600 "$env_file"

upsert_env() {
  local key="$1"
  local value="$2"
  local escaped
  local quoted
  quoted="'$(printf '%s' "$value" | sed "s/'/'\\\\''/g")'"
  escaped="$(printf '%s' "$quoted" | sed -e 's/[\/&]/\\&/g')"
  if grep -q "^${key}=" "$env_file"; then
    sed -i "s/^${key}=.*/${key}=${escaped}/" "$env_file"
  else
    printf '%s=%s\n' "$key" "$quoted" >> "$env_file"
  fi
}

read -r -p "SMTP user/email: " smtp_user
read -r -p "SMTP from display, default U eat <${smtp_user}>: " smtp_from
read -r -s -p "SMTP authorization code/password: " smtp_pass
printf '\n'

smtp_from="${smtp_from:-U eat <${smtp_user}>}"

if ! grep -q "^EMAIL_CODE_SECRET=" "$env_file"; then
  upsert_env "EMAIL_CODE_SECRET" "$(openssl rand -hex 32)"
fi
upsert_env "EMAIL_CODE_EXPOSE_DEV_CODE" "false"
if ! grep -q "^EMAIL_CODE_DAILY_SEND_LIMIT=" "$env_file"; then
  upsert_env "EMAIL_CODE_DAILY_SEND_LIMIT" "40"
fi
if ! grep -q "^EMAIL_CODE_DAILY_LIMIT_TIME_ZONE=" "$env_file"; then
  upsert_env "EMAIL_CODE_DAILY_LIMIT_TIME_ZONE" "Asia/Shanghai"
fi
upsert_env "SMTP_HOST" "smtp.163.com"
upsert_env "SMTP_PORT" "465"
upsert_env "SMTP_SECURE" "true"
upsert_env "SMTP_USER" "$smtp_user"
upsert_env "SMTP_PASS" "$smtp_pass"
upsert_env "SMTP_FROM" "$smtp_from"

systemctl restart ueat-server
systemctl is-active --quiet ueat-server
printf 'SMTP config saved and ueat-server restarted.\n'
