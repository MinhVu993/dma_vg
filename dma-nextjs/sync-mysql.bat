@echo off
cd /d "%~dp0"
echo Syncing Dormitory Requests from MySQL (dorm_db) to PostgreSQL (vg_dma)...
node scripts/sync-from-mysql.js
pause

