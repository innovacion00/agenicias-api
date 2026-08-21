# Despliegue de Agencias API en DigitalOcean

Guía para desplegar esta API NestJS en un Droplet Ubuntu de DigitalOcean, usando Docker, MongoDB administrado, Nginx y HTTPS.

Los comandos están escritos para Ubuntu 22.04 o 24.04. Ejecuta cada bloque en el orden indicado.

## 1. Datos previos

Define estos valores antes de comenzar:

```text
DOMINIO=api.tudominio.com
IP_DROPLET=203.0.113.10
REPOSITORIO=https://github.com/organizacion/agenicias-api.git
```

Debes tener el dominio, acceso a su DNS, la cadena de conexión de MongoDB, todas las variables de producción y acceso al repositorio Git.

## 2. Crear el Droplet

En DigitalOcean crea un Droplet con:

- Ubuntu 22.04 LTS o Ubuntu 24.04 LTS.
- Arquitectura x86.
- Mínimo 2 GB de RAM; 4 GB es preferible si se generan PDFs frecuentemente.
- Autenticación mediante clave SSH.
- Backups del Droplet activados, si el presupuesto lo permite.

MongoDB debe permanecer en el servicio administrado de DigitalOcean. No ejecutes otro MongoDB en este Droplet.

## 3. Conectarse y actualizar Ubuntu

Desde tu equipo local:

```bash
ssh root@IP_DROPLET
```

En el servidor:

```bash
apt update && apt upgrade -y
reboot
```

Después del reinicio, vuelve a conectarte:

```bash
ssh root@IP_DROPLET
```

## 4. Crear usuario de despliegue

```bash
adduser deploy
usermod -aG sudo deploy
mkdir -p /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
```

Prueba una segunda conexión antes de cerrar la sesión root:

```bash
ssh deploy@IP_DROPLET
```

## 5. Configurar la zona horaria

Los backups usan `America/Bogota`. Configura también el sistema:

```bash
sudo timedatectl set-timezone America/Bogota
timedatectl
```

## 6. Instalar Docker y Docker Compose

Elimina paquetes antiguos que puedan entrar en conflicto:

```bash
sudo apt remove -y docker docker-engine docker.io containerd runc || true
```

Instala los requisitos del repositorio oficial:

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
```

Registra el repositorio e instala Docker:

```bash
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
```

Permite usar Docker sin `sudo`:

```bash
sudo usermod -aG docker deploy
exit
ssh deploy@IP_DROPLET
```

Comprueba la instalación:

```bash
docker --version
docker compose version
docker run --rm hello-world
```

## 7. Configurar firewall

Primero mantén abierta la sesión SSH actual y prueba una nueva conexión después de activar UFW:

```bash
sudo apt install -y ufw
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status verbose
```

En el Cloud Firewall de DigitalOcean permite TCP `22`, `80` y `443`. No abras `3000` ni `27017` públicamente.

## 8. Autorizar MongoDB externo

En DigitalOcean abre la configuración de Trusted Sources del clúster MongoDB y agrega:

```text
IP_DROPLET/32
```

No uses `0.0.0.0/0` para MongoDB. Conserva la cadena de conexión entregada por DigitalOcean con TLS, replica set y `authSource` cuando corresponda.

## 9. Descargar el proyecto

```bash
sudo apt install -y git
mkdir -p ~/apps
cd ~/apps
git clone REPOSITORIO agencias-api
cd agencias-api
ls -la Dockerfile docker-compose.yml .env.example nginx/agencias-api.conf
```

Para un repositorio privado utiliza una deploy key SSH o un token seguro. No pongas tokens dentro de la URL ni en archivos versionados.

## 10. Crear `.env` de producción

```bash
cp .env.example .env
nano .env
chmod 600 .env
```

Completa todas las variables requeridas por [src/config/envs.ts](src/config/envs.ts). Incluye `PORT=3000`, `MONGO_URL`, `JWT_SECRET`, credenciales Cobre, Cloudinary, Gmail, SendGrid, Autocore, My Tool, todas las variables `API_*`, Amadeus, `BOOKING_PERSONAS_TOKEN`, MaarLab, `HOST_BRIDGE`, Google Drive y correo de backups.

No ejecutes `git add .env`, no subas este archivo al repositorio y no lo copies dentro de la imagen Docker. El `.dockerignore` ya lo excluye.

## 11. Construir y arrancar la API

Desde `~/apps/agenicias-api`:

```bash
docker compose build
docker compose up -d
docker compose ps
docker compose logs -f api
```

La primera compilación puede tardar porque instala Chromium para Puppeteer. La API queda publicada solo en `127.0.0.1:3000`.

Comprueba el readiness check:

```bash
curl -i http://127.0.0.1:3000/agencias/v1/api-docs-json
docker inspect --format='{{json .State.Health}}' "$(docker compose ps -q api)"
```

Debe devolver HTTP `200`. Si no inicia:

```bash
docker compose logs --tail=200 api
docker compose config
```

## 12. Instalar Nginx

```bash
sudo apt update
sudo apt install -y nginx
sudo systemctl enable --now nginx
```

Edita la configuración y sustituye `api.example.com` por el dominio real:

```bash
nano nginx/agencias-api.conf
sudo cp nginx/agencias-api.conf /etc/nginx/sites-available/agencias-api
sudo ln -s /etc/nginx/sites-available/agencias-api /etc/nginx/sites-enabled/agencias-api
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

## 13. Configurar DNS

En el proveedor DNS crea:

```text
Tipo: A
Nombre: api
Valor: IP_DROPLET
TTL: 300
```

Comprueba la propagación:

```bash
sudo apt install -y dnsutils
dig +short api.tudominio.com
```

El resultado debe ser la IP pública del Droplet. No solicites HTTPS hasta que el dominio resuelva correctamente y el puerto 80 sea accesible.

## 14. Activar HTTPS

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.tudominio.com
```

Elige redireccionar HTTP a HTTPS. Comprueba la renovación:

```bash
sudo certbot renew --dry-run
sudo systemctl status certbot.timer
curl -I https://api.tudominio.com/agencias/v1/api-docs-json
```

Swagger quedará disponible en `https://api.tudominio.com/agencias/v1/api-docs`.

## 15. Verificación funcional

Comprueba readiness, Swagger, MongoDB, un endpoint público, un endpoint protegido con JWT, generación de PDF con Puppeteer, carga de archivos, correos y webhooks.

Los cron jobs están dentro de NestJS:

- Backup diario a las 03:00, zona `America/Bogota`.
- Bot de reservas pendientes a las 08:00.
- Notificaciones cada hora.

Mantén una sola réplica de `api`; varias réplicas duplicarían estas tareas.

## 16. Actualizar la aplicación

```bash
cd ~/apps/agenicias-api
git pull
docker compose build --pull
docker compose up -d --remove-orphans
docker compose ps
docker compose logs --tail=200 api
```

Para reconstruir sin caché:

```bash
docker compose build --no-cache
docker compose up -d
```

## 17. Backups

La API crea los archivos temporalmente dentro del contenedor, los comprime, los sube a Google Drive y los elimina. No se monta un volumen local.

Revisa logs de backup:

```bash
docker compose logs --since=24h api | grep -i -E 'backup|drive|error'
```

Activa también los backups automáticos del clúster MongoDB administrado y prueba periódicamente una restauración.

## 18. Operación diaria

```bash
docker compose ps
docker compose logs -f api
docker compose logs --tail=100 api
docker compose restart api
docker compose stop api
docker stats
docker system df
```

No uses `docker system prune -a` sin revisar antes, porque puede eliminar imágenes necesarias para volver atrás.

## 19. Diagnóstico

### API `unhealthy` o reiniciándose

```bash
docker compose logs --tail=300 api
docker compose ps
```

Lo más frecuente es una variable ausente o incorrecta; la validación Joi detiene el arranque.

### Error de MongoDB

Comprueba Trusted Sources, `MONGO_URL`, credenciales, TLS, hora del servidor y estado del clúster:

```bash
timedatectl
docker compose logs --tail=200 api | grep -i -E 'mongo|mongodb|connect|timeout'
```

### Nginx devuelve `502 Bad Gateway`

```bash
curl -i http://127.0.0.1:3000/agencias/v1/api-docs-json
sudo tail -n 100 /var/log/nginx/error.log
sudo nginx -t
```

Si el `curl` local falla, el problema está en la API. Si funciona, revisa Nginx.

### HTTPS no se puede emitir

```bash
dig +short api.tudominio.com
sudo ss -tulpn | grep -E ':80|:443'
sudo ufw status
```

### Puppeteer no genera PDF

```bash
docker compose logs --tail=300 api | grep -i -E 'puppeteer|chrom|pdf'
docker compose build --no-cache
docker compose up -d
```

La imagen usa Debian slim e instala las librerías necesarias para Chromium.

## 20. Seguridad final

Comprueba que `.env` no esté en Git, que los puertos `3000` y `27017` no estén abiertos, que MongoDB acepte conexiones solo desde el Droplet, que SSH use claves, que el contenedor use un usuario no root, que los secretos hayan sido rotados y que HTTPS se renueve correctamente.
