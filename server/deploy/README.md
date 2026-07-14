# Cloud Deployment

Target from project docs:

```text
External: http://10.119.5.83/api
Nginx:    80 -> 127.0.0.1:3000
Node:     127.0.0.1:3000
```

## One-time server setup

SSH into the Ubuntu host:

```bash
ssh root@10.119.5.83
```

Then run:

```bash
bash /opt/ueat/server/deploy/install-ubuntu.sh
bash /opt/ueat/server/deploy/activate-service.sh
```

## Push from Windows after SSH key is configured

From the repo root:

```powershell
powershell -ExecutionPolicy Bypass -File server/deploy/push-from-windows.ps1
```

This script deploys backend code only. It preserves `/opt/ueat/server/data` on the cloud host and removes local `data/*.sqlite*` files from the upload package.

To deploy both the cloud web page and backend API:

```powershell
powershell -ExecutionPolicy Bypass -File deploy-cloud.ps1
```

## Expected checks

On the server:

```bash
systemctl status ueat-server --no-pager
curl http://127.0.0.1:3000/health
curl http://127.0.0.1/api/health
```

From your local machine:

```powershell
Invoke-RestMethod http://10.119.5.83/api/health
Invoke-RestMethod http://10.119.5.83/api/meal-cards
```

## Logs

```bash
journalctl -u ueat-server -n 100 --no-pager
tail -n 100 /var/log/nginx/error.log
tail -n 100 /var/log/nginx/access.log
```

## Database

Current prototype database on the server:

```text
DATABASE_URL=postgresql:///ueat?host=/var/run/postgresql
```

Back it up before resetting the server:

```bash
bash /opt/ueat/server/deploy/backup-postgres.sh
```

Suggested daily cron entry:

```cron
15 3 * * * BACKUP_DIR=/opt/ueat/backups/postgres RETENTION_DAYS=14 bash /opt/ueat/server/deploy/backup-postgres.sh >> /var/log/ueat-postgres-backup.log 2>&1
```

Restore example:

```bash
createdb ueat_restore
pg_restore --dbname=postgresql:///ueat_restore?host=/var/run/postgresql /opt/ueat/backups/postgres/ueat-YYYYMMDDTHHMMSSZ.dump
```

Local SQLite backups, if any, should stay under `local-db-backups/` and are ignored by Git.
