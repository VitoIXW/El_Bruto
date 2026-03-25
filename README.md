# El Bruto Arena Runner

CLI en TypeScript + Playwright para automatizar combates de **La Brute / El Bruto** en EternalTwin.

Ahora mismo el flujo real es este:

1. abre la web principal
2. inicia sesión automáticamente con credenciales locales
3. entra al primer bruto visible de la cuenta
4. pelea en `single` o recorre todo el roster en `all-brutes`

## Qué hace

El proyecto permite:

- iniciar sesión automáticamente
- entrar al primer bruto visible de la cuenta
- lanzar combates hasta que el bruto quede descansando
- recorrer todos los brutos con `Siguiente Bruto` en modo `all-brutes`
- elegir rival en arena usando el menor `Ratio de Victoria` / `Win Rate` público cuando ese dato se puede resolver
- guardar logs y artifacts para depurar errores

## Requisitos

- Node.js 20+
- npm
- Playwright Chromium

## Instalación

```bash
npm install
npx playwright install chromium
```

## Credenciales locales

La sesión se automatiza con credenciales guardadas **solo en local**.

Puedes usar una de estas dos opciones:

1. Variables de entorno `ET_USERNAME` y `ET_PASSWORD`
2. Archivo local `/.credentials.local.json`

Ejemplo:

```json
{
  "username": "EXAMPLE_USERNAME",
  "password": "EXAMPLE_PASSWORD"
}
```

También tienes una plantilla en:

- [\.credentials.local.json.example](/home/vito/repositorios/el_bruto/.credentials.local.json.example)

Ese archivo local está ignorado por git y no debe subirse.

## Uso normal

Primero compila:

```bash
npm run build
```

Luego ejecuta uno de estos modos.

### Modo `single`

Usa el primer bruto visible de la cuenta y pelea con él hasta que se quede sin combates o aparezca una parada segura.

```bash
npm run start -- --mode single --debug
```

### Modo `all-brutes`

Procesa el roster completo avanzando con `Siguiente Bruto`.

```bash
npm run start -- --mode all-brutes --debug
```

## Opciones útiles

- `--mode single|all-brutes`
- `--debug`
- `--profile-dir <ruta>`
- `--artifacts-dir <ruta>`
- `--logs-dir <ruta>`
- `--login-timeout-ms <ms>`
- `--url <url>`

Nota sobre `--url`:

- hoy en día el arranque real entra por la home autenticada y abre el primer bruto visible
- `--url` sigue existiendo por compatibilidad y para construir la base del sitio, pero ya no es la forma principal de elegir el bruto en el arranque

## Qué verás al ejecutarlo

- se abre un navegador visible
- si hace falta, pulsa `Conectarse` / `Log in`
- rellena usuario y contraseña
- entra en la cuenta
- abre el primer bruto visible
- empieza a pelear o a recorrer el roster según el modo

## Logs y artifacts

Los logs se guardan en:

- `logs/`

Si ocurre un error inesperado, también se guardan:

- captura de pantalla
- snapshot HTML

en:

- `artifacts/`

## Estado actual

El proyecto ya cubre el flujo práctico de uso, pero todavía hay límites:

- algunas decisiones siguen dependiendo del HTML real que devuelva EternalTwin
- cambios en la interfaz pueden obligar a ajustar selectores o parsers
- la selección de rival depende de que el win-rate público se pueda resolver correctamente
- las decisiones manuales de level-up siguen fuera de alcance

## Comandos de desarrollo

```bash
npm run build
npm run test
npm run check
```
