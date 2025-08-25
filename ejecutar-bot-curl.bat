@echo off
chcp 65001 >nul
echo 🚀 Ejecutando Bot de Reservas Pendientes...
echo.

REM Configuración
set BASE_URL=http://localhost:3000
set ENDPOINT=/bot-reservas-pendientes/ejecutar-manualmente
set TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI2NzdkNzc1MzE1NTk1NDExNWNlYTIwYWEiLCJpYXQiOjE3NTYxMzI3MTAsImV4cCI6MTc1NjEzMzYxMH0.0K_YVMTa43aOopVseM0VYJsryebnyF1MbchLUySCKDs

echo 📍 URL: %BASE_URL%%ENDPOINT%
echo 🔑 Token: %TOKEN:~0,20%...
echo.

echo 📡 Enviando petición con cURL...
echo.

REM Ejecutar cURL
curl -X POST "%BASE_URL%%ENDPOINT%" ^
  -H "Authorization: Bearer %TOKEN%" ^
  -H "Content-Type: application/json" ^
  -v

echo.
echo 🏁 Script completado
pause
