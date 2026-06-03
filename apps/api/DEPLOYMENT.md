# Guía de Despliegue Automatizado con GitHub Actions

Este documento detalla los pasos para configurar un pipeline de CI/CD (Integración y Despliegue Continuo) usando GitHub Actions. El pipeline automatizará la construcción de la imagen Docker del proyecto, la publicará en GitHub Container Registry (GHCR) y la desplegará en un servidor de producción cada vez que se realice un `push` a la rama `main`.

## Prerrequisitos

- Un servidor (ej. una instancia EC2 de AWS, un Droplet de DigitalOcean, etc.) con acceso SSH.
- Docker y Docker Compose instalados en el servidor.
- Una cuenta de GitHub y un repositorio para este proyecto.

---

## Paso 1: Configuración del Servidor

Primero, debemos preparar el servidor para recibir los despliegues.

### 1. Crear el Directorio del Proyecto

Conéctate a tu servidor vía SSH y crea el directorio donde vivirá la aplicación.

```bash
mkdir -p /home/ubuntu/fuel-track-api
cd /home/ubuntu/fuel-track-api
```

> **Nota:** Reemplaza `/home/ubuntu/fuel-track-api` con la ruta y usuario que prefieras.

### 2. Crear `docker-compose.yml` para Producción

En tu servidor, dentro del directorio del proyecto, crea un archivo `docker-compose.yml`. Esta versión está optimizada para producción, ya que descarga la imagen pre-construida del registro en lugar de construirla en el servidor.

```yaml
# Ruta en el servidor: /home/ubuntu/fuel-track-api/docker-compose.yml

version: "3.8"

services:
  api:
    # Usamos la imagen desde GitHub Container Registry
    # ¡IMPORTANTE! Reemplaza 'tu-usuario-github/tu-repositorio'
    image: ghcr.io/tu-usuario-github/tu-repositorio:${IMAGE_TAG:-latest}
    container_name: fuel-track-api
    restart: always
    env_file:
      - .env # Los secretos se gestionan en el servidor
    ports:
      - "${PORT}:${PORT}"
    depends_on:
      db:
        condition: service_healthy
    networks:
      - fueltrack-net

  db:
    image: postgres:15-alpine
    container_name: fuel-track-db
    restart: always
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASS}
      POSTGRES_DB: ${DB_DATABASE}
    volumes:
      - db-data:/var/lib/postgresql/data
    networks:
      - fueltrack-net
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER} -d ${DB_DATABASE}"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  db-data:

networks:
  fueltrack-net:
    driver: bridge
```

### 3. Crear el archivo `.env`

En el mismo directorio, crea el archivo `.env` con tus secretos de producción.

```bash
# Ruta en el servidor: /home/ubuntu/fuel-track-api/.env

NODE_ENV=production
PORT=3000
DB_USER=usuario_produccion
DB_PASS=contraseña_super_secreta
DB_DATABASE=fueltrack_prod
DB_HOST=db
DB_PORT=5432

# Este tag será actualizado automáticamente por el script de despliegue
IMAGE_TAG=latest
```

### 4. Generar Clave SSH para el Despliegue

Para permitir que GitHub Actions se conecte de forma segura, usaremos una clave SSH dedicada.

1.  En tu **máquina local** (no en el servidor), ejecuta este comando. No establezcas una contraseña (passphrase) cuando se te solicite.

    ```bash
    ssh-keygen -t rsa -b 4096 -f deploy_key -C "github-actions"
    ```

    Esto crea dos archivos: `deploy_key` (clave privada) y `deploy_key.pub` (clave pública).

2.  Añade la clave pública a las claves autorizadas de tu servidor. Primero, muestra la clave pública:
    ```bash
    cat deploy_key.pub
    ```
3.  Copia la salida. Luego, en tu **servidor**, pégala en el archivo `~/.ssh/authorized_keys`:
    ```bash
    echo "ssh-rsa AAAA..." >> ~/.ssh/authorized_keys
    ```
4.  El contenido del archivo `deploy_key` (la clave privada) se usará como un Secreto de GitHub en el siguiente paso. Puedes verlo con `cat deploy_key`.

---

## Paso 2: Configuración del Repositorio de GitHub

### 1. Generar un Personal Access Token (PAT)

El script de despliegue necesita un token para autenticarse en Docker en tu servidor y descargar la imagen de GHCR.

1.  Ve a tu perfil de GitHub > **Settings** > **Developer settings** > **Personal access tokens** > **Tokens (classic)**.
2.  Haz clic en **Generate new token**.
3.  Dale un nombre descriptivo (ej. "GHCR Deploy Token"), una fecha de expiración y asígnale los siguientes permisos (scopes): `write:packages` y `read:packages`.
4.  Haz clic en **Generate token**. **Copia este token inmediatamente**, ya que no podrás volver a verlo.

### 2. Añadir los Secretos al Repositorio

Ve a tu repositorio de GitHub y navega a **Settings** > **Secrets and variables** > **Actions**. Haz clic en **New repository secret** para cada una de las siguientes variables:

- `SSH_HOST`: La dirección IP o dominio de tu servidor.
- `SSH_USERNAME`: El nombre de usuario para la conexión SSH (ej. `ubuntu`).
- `SSH_PORT`: El puerto SSH de tu servidor (normalmente `22`).
- `SSH_PRIVATE_KEY`: Pega el contenido **completo** del archivo de la clave privada (`deploy_key`) que generaste. Debe empezar con `-----BEGIN OPENSSH PRIVATE KEY-----`.
- `GHCR_TOKEN`: Pega el Personal Access Token que acabas de crear.

---

## Paso 3: Desplegar

1.  Asegúrate de que el archivo `.github/workflows/deploy.yml` existe en tu repositorio local.
2.  Haz commit y push de tus cambios a la rama `main`.
    ```bash
    git add .
    git commit -m "feat: Add CI/CD deployment workflow"
    git push origin main
    ```
3.  Ve a la pestaña **Actions** en tu repositorio de GitHub. Deberías ver el flujo de trabajo "Deploy to Production" ejecutándose.

¡Listo! A partir de ahora, cada `push` a la rama `main` disparará un nuevo despliegue a producción.
