# 🚀 Despliegue de Proyecto Next.js a Docker y QNAP

Guía paso a paso para compilar un proyecto Next.js desde Visual Studio Code (Windows/PowerShell), generar su imagen de Docker y desplegarla en un servidor NAS QNAP manteniendo copias de respaldo.

---

## 💻 1. Preparación y Construcción Local (Windows / PowerShell)

### Entrar al proyecto y actualizar el código
Abre la terminal en Visual Studio Code (PowerShell) y ejecuta los siguientes comandos para descargar los últimos cambios y verificar la compilación local:

```powershell
cd C:\Users\iban7\sat-partes
git pull origin main
npm run build
```

### Cargar variables de entorno públicas
Ejecuta este bloque en PowerShell para leer `.env.local` y cargar las variables públicas necesarias para el *build* de Docker:

```powershell
foreach ($line in Get-Content -LiteralPath ".env.local") {
    if ($line -match '^\s*(NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)\s*=\s*(.*)$') {
        $name = $matches[1]
        $value = $matches[2].Trim().Trim('"').Trim("'")
        [Environment]::SetEnvironmentVariable($name, $value, "Process")
    }
}

if (!$env:NEXT_PUBLIC_SUPABASE_URL -or !$env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    throw "Faltan las variables públicas de Supabase."
}

Write-Host "Variables públicas preparadas." -ForegroundColor Green
```

### Construir la imagen de Docker
Si el paso anterior no dio errores, construye la imagen especificando la arquitectura `linux/amd64` (compatible con la mayoría de NAS QNAP):

```powershell
docker build --platform linux/amd64 `
  --build-arg "NEXT_PUBLIC_SUPABASE_URL=$env:NEXT_PUBLIC_SUPABASE_URL" `
  --build-arg "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" `
  -t sat-partes:latest .
```

### Exportar y transferir la imagen al QNAP
Empaqueta la imagen en un archivo `.tar` y envíala por SCP a la carpeta compartida del NAS:

```powershell
docker save -o .\sat-partes.tar sat-partes:latest
scp .\sat-partes.tar Iban77@192.168.1.48:/share/Public/
```

---

## 🖥️ 2. Despliegue en el Servidor QNAP (Vía SSH)

Conéctate a tu QNAP mediante SSH y ejecuta los siguientes pasos:

### Respaldar la imagen anterior
Antes de sobrescribir la imagen `latest`, créale una etiqueta de respaldo con la fecha actual (ej. `20261124`):

```bash
docker tag sat-partes:latest sat-partes:backup-FECHA
```

### Cargar la nueva imagen
Importa el archivo `.tar` transferido previamente:

```bash
docker load -i /share/Public/sat-partes.tar
```

### Conservar el contenedor anterior (Rollback)
Detén el contenedor en ejecución y renómbralo por si necesitas volver atrás rápidamente:

```bash
docker stop sat-partes
docker rename sat-partes sat-partes-rollback-FECHA
```

### Arrancar la nueva versión
Levanta el nuevo contenedor aplicando el archivo de variables de entorno del servidor y configurando el reinicio automático:

```bash
docker run -d \
  --name sat-partes \
  --env-file /share/Public/sat-partes.env \
  --restart unless-stopped \
  -p 32768:3000 \
  sat-partes:latest
```

---

## ✅ 3. Verificación

Comprueba que el contenedor esté corriendo correctamente y revisa los últimos registros para descartar errores:

```bash
docker ps -a --filter name=sat-partes
docker logs --tail 40 sat-partes
```