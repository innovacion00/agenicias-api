# Script para validar access tokens
Write-Host "Validando Access Token..." -ForegroundColor Green

# Configuracion
$baseUrl = "http://localhost:3000/agencias/v1"
$endpoint = "/auth/validate-access-token"

# Token a validar (reemplaza con el token que quieras validar)
$tokenToValidate = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI2NzdkNzc1MzE1NTk1NDExNWNlYTIwYWEiLCJpYXQiOjE3NTYxNDExMzMsImV4cCI6MTc1NjE0MjAzM30.yiWTFSQueA56CkdTvWJlHe9mxgaCrm_TaM3PJSIXim4"

# Body de la peticion
$body = @{
    accessToken = $tokenToValidate
} | ConvertTo-Json

# Headers
$headers = @{
    "Content-Type" = "application/json"
}

# URL completa
$url = "$baseUrl$endpoint"

Write-Host "URL: $url" -ForegroundColor Yellow
Write-Host "Token a validar: $($tokenToValidate.Substring(0, 20))..." -ForegroundColor Yellow
Write-Host ""

try {
    Write-Host "Enviando peticion..." -ForegroundColor Cyan
    
    # Hacer la peticion
    $response = Invoke-RestMethod -Uri $url -Method POST -Headers $headers -Body $body
    
    Write-Host "Respuesta:" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 10
    
} catch {
    Write-Host "Error en la peticion:" -ForegroundColor Red
    Write-Host "Mensaje: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode
        Write-Host "Codigo de estado: $statusCode" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Script completado" -ForegroundColor Green
