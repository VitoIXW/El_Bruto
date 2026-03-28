# El Bruto Arena Runner

Guía de uso del CLI para automatizar combates de **El Bruto / La Brute** en EternalTwin.

## Requisitos

- Node.js 20 o superior
- npm
- Chromium de Playwright

## Instalación

```bash
npm install
npx playwright install chromium
```

## Uso En Windows

Funciona también en Windows. Lo recomendable es usar `PowerShell` o `Windows Terminal`.

Instalación:

```powershell
npm install
npx playwright install chromium
```

Modo interactivo:

```powershell
npm run start
```

Modo automático:

```powershell
npm run start -- --mode all-brutes --headless
```

Con credenciales por variables de entorno en PowerShell:

```powershell
$env:ET_USERNAME="tu_usuario"
$env:ET_PASSWORD="tu_password"
npm run start -- --mode single --brute TuBruto --headless
```

Si prefieres `cmd.exe`:

```cmd
set ET_USERNAME=tu_usuario
set ET_PASSWORD=tu_password
npm run start -- --mode single --brute TuBruto --headless
```

## Primer Arranque

Modo interactivo:

```bash
npm run start
```

También puedes forzarlo con:

```bash
npm run start -- --interactive
```

o:

```bash
npm run start -- --manual
```

## Cuentas Guardadas

Las cuentas se guardan en:

- `.accounts.local.json`

Ejemplo:

```json
{
  "accounts": [
    {
      "label": "Cuenta principal",
      "username": "mi_usuario",
      "password": "mi_password"
    }
  ]
}
```

Notas:

- ese archivo está ignorado por Git
- el `label` es el que puedes usar con `--account`
- si no hay cuentas guardadas, el modo interactivo te deja introducir una nueva

## Credenciales

Orden habitual:

1. `ET_USERNAME` + `ET_PASSWORD`
2. cuenta guardada en `.accounts.local.json`

## Modos De Ejecución

### Modo interactivo

Te deja:

- elegir cuenta
- descubrir brutos del `/hall`
- ejecutar:
  - todos los brutos
  - un bruto
  - varios brutos seleccionados
- decidir qué hacer cuando un bruto sube de nivel si Chromium está visible:
  - saltarlo y seguir
  - dejar Chromium abierto, subirlo manualmente y continuar al pulsar Enter

### Modo automático

Pensado para lanzar por terminal, script o tarea programada.

En `headless`, si un bruto sube de nivel se salta y la ejecución sigue.

## Comandos Más Usados

### Ejecutar todos los brutos

Con una cuenta guardada:

```bash
npm run start -- --mode all-brutes --headless
```

Con una cuenta concreta:

```bash
npm run start -- --mode all-brutes --account "Cuenta principal" --headless
```

Con variables de entorno:

```bash
ET_USERNAME="tu_usuario" ET_PASSWORD="tu_password" npm run start -- --mode all-brutes --headless
```

### Ejecutar un solo bruto

```bash
npm run start -- --mode single --brute TuBruto --account "Cuenta principal" --headless
```

o:

```bash
ET_USERNAME="tu_usuario" ET_PASSWORD="tu_password" npm run start -- --mode single --brute TuBruto --headless
```

### Ejecutar con Chromium visible

```bash
npm run start -- --mode single --brute TuBruto --account "Cuenta principal"
```

### Ejecutar desde TypeScript sin compilar

```bash
npm run dev
```

## Opciones

- `--mode single|all-brutes`
- `--brute <name>`
- `--account <label>`
- `--interactive`
- `--manual`
- `--debug`
- `--headless`
- `--profile-dir <path>`
- `--artifacts-dir <path>`
- `--logs-dir <path>`
- `--login-timeout-ms <ms>`
- `--url <url>`

## Perfiles

Si usas varias cuentas, conviene separar perfiles:

```bash
npm run start -- --mode single --brute TuBruto --account "Cuenta principal" --profile-dir playwright-profile-main
```

```bash
npm run start -- --mode single --brute OtroBruto --account "Cuenta secundaria" --profile-dir playwright-profile-alt
```

## Logs Y Artefactos

Los logs se guardan en:

- `logs/`

Los artefactos de error se guardan en:

- `artifacts/`

Cuando algo falla normalmente tendrás:

- un `.log`
- una captura `.png`
- un volcado `.html`

## Sumarios

Al final de la ejecución se muestra:

- número de combates
- victorias
- derrotas
- porcentaje de victoria
- si quedó descansando
- si subió de nivel
- si hubo errores

En ejecuciones de cuenta también se muestran los totales agregados.

## Comandos De Desarrollo

```bash
npm run build
npm run test
npm run check
```
