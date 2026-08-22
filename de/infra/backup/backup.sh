#!/bin/bash
set -euo pipefail

DATE=$(date +%Y-%m-%d)
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="hotspot_${DATE}"
BACKUP_DIR="/tmp/clickhouse-backup"
BACKUP_FILE="${BACKUP_DIR}/${BACKUP_NAME}"
LOG_FILE="/var/log/clickhouse-backup/backup_${TIMESTAMP}.log"
CLICKHOUSE_CONTAINER="olap-hotspot-clickhouse-1"

R2_BUCKET="guax"
R2_PATH="hotspot"

mkdir -p /var/log/clickhouse-backup
mkdir -p ${BACKUP_DIR}

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "========================================="
log "Starting ClickHouse Backup"
log "Backup name: ${BACKUP_NAME}"
log "========================================="

log "Testing ClickHouse connection..."
if ! docker exec $CLICKHOUSE_CONTAINER clickhouse-client --query "SELECT 1" > /dev/null 2>&1; then
    log "ERROR: Cannot connect to ClickHouse"
    exit 1
fi
log "ClickHouse connection OK"

log "Cleaning up old local backups..."
rm -rf ${BACKUP_FILE}*

log "Creating backup..."
START_TIME=$(date +%s)

if docker exec $CLICKHOUSE_CONTAINER clickhouse-client --query "
BACKUP DATABASE hotspot TO File('${BACKUP_NAME}')
SETTINGS compression_method='zstd', compression_level=3
" 2>&1 | tee -a "$LOG_FILE"; then
    log "ClickHouse backup created"
else
    log "ERROR: ClickHouse backup failed"
    exit 1
fi

log "Copying backup from container..."
docker cp ${CLICKHOUSE_CONTAINER}:/var/lib/clickhouse/backups/${BACKUP_NAME} ${BACKUP_DIR}/

log "Creating archive..."
cd ${BACKUP_DIR}
tar -czf ${BACKUP_NAME}.tar.gz ${BACKUP_NAME}
ARCHIVE_SIZE=$(du -h ${BACKUP_NAME}.tar.gz | cut -f1)
log "Archive created: ${BACKUP_NAME}.tar.gz (${ARCHIVE_SIZE})"

log "Uploading to R2..."
if rclone copy ${BACKUP_NAME}.tar.gz r2:${R2_BUCKET}/${R2_PATH}/ -v 2>&1 | tee -a "$LOG_FILE"; then
    log "Upload completed"
else
    log "ERROR: Upload failed"
    exit 1
fi

log "Verifying upload..."
if rclone ls r2:${R2_BUCKET}/${R2_PATH}/${BACKUP_NAME}.tar.gz 2>&1 | tee -a "$LOG_FILE"; then
    log "Verification OK"
else
    log "ERROR: Verification failed"
    exit 1
fi

log "Cleaning up local files..."
rm -rf ${BACKUP_DIR}/${BACKUP_NAME}
rm -f ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz
docker exec $CLICKHOUSE_CONTAINER rm -rf /var/lib/clickhouse/backups/${BACKUP_NAME}

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

log "========================================="
log "Backup completed in ${DURATION}s"
log "File: r2:${R2_BUCKET}/${R2_PATH}/${BACKUP_NAME}.tar.gz"
log "Size: ${ARCHIVE_SIZE}"
log "========================================="

find /var/log/clickhouse-backup/ -name "backup_*.log" -mtime +30 -delete 2>/dev/null || true

log "Cleaning up old backups in R2 (keeping 30 days)..."
rclone delete r2:${R2_BUCKET}/${R2_PATH}/ --min-age 30d 2>&1 | tee -a "$LOG_FILE" || true

exit 0
