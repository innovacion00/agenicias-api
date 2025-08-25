# Script simple para ejecutar el bot de reservas pendientes
Write-Host "🚀 Ejecutando Bot de Reservas Pendientes..." -ForegroundColor Green

# Configuración
$baseUrl = "http://localhost:3000"
$endpoint = "/bot-reservas-pendientes/ejecutar-manualmente"
$token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI2NzdkNzc1MzE1NTk1NDExNWNlYTIwYWEiLCJpYXQiOjE3NTYxMzI3MTAsImV4cCI6MTc1NjEzMzYxMH0.0K_YVMTa43aOopVseM0VYJsryebnyF1MbchLUySCKDs"

# Headers
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

# URL completa
$url = "$baseUrl$endpoint"

Write-Host "📍 URL: $url" -ForegroundColor Yellow
Write-Host "🔑 Token: $($token.Substring(0, 20))..." -ForegroundColor Yellow
Write-Host ""

try {
    Write-Host "📡 Enviando petición..." -ForegroundColor Cyan
    
    # Hacer la petición
    $response = Invoke-RestMethod -Uri $url -Method POST -Headers $headers
    
    Write-Host "✅ Respuesta exitosa:" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 10
    
} catch {
    Write-Host "❌ Error en la petición:" -ForegroundColor Red
    Write-Host "Mensaje: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode
        Write-Host "Código de estado: $statusCode" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "🏁 Script completado" -ForegroundColor Green
