# El Bruto Arena Runner

CLI en TypeScript + Playwright para automatizar combates de **La Brute / El Bruto** en EternalTwin.

El proyecto tiene ahora dos formas de uso:

- **modo automático**, pensado para lanzarlo con parámetros desde terminal, scripts o cron
- **modo interactivo**, pensado para abrir un pequeño flujo guiado en consola y elegir cuenta, brutos y modo de ejecución

## Qué hace

Actualmente el runner puede:

- iniciar sesión automáticamente en EternalTwin
- usar cuentas locales guardadas solo en tu máquina
- descubrir el roster de brutos de una cuenta desde `/hall`
- ejecutar:
  - un solo bruto
  - varios brutos concretos
  - todos los brutos de la cuenta
- entrar directamente al `/cell` del bruto elegido
- pelear hasta que el bruto quede descansando o aparezca una parada segura
- recorrer el roster con `Siguiente Bruto` en modo `all-brutes`
- elegir rival en arena usando el menor `Ratio de Victoria` / `Win Rate` público cuando ese dato se puede resolver
- guardar logs detallados y artifacts para depurar errores

## Requisitos

- Node.js 20+
- npm
- Playwright Chromium

## Instalación

```bash
npm install
npx playwright install chromium
```

## Cómo se guardan las cuentas

La forma principal y recomendada es usar:

- [\.accounts.local.json.example](/home/vito/repositorios/el_bruto/.accounts.local.json.example)

Copia su estructura en:

- `/.accounts.local.json`

Formato:

```json
{
  "accounts": [
    {
      "label": "Mi cuenta principal",
      "username": "mi_usuario",
      "password": "mi_password"
    },
    {
      "label": "Cuenta secundaria",
      "username": "otro_usuario",
      "password": "otro_password"
    }
  ]
}
```

Notas:

- el archivo `/.accounts.local.json` está ignorado por git
- el label es el nombre que verás en el modo interactivo y también el que puedes usar con `--account`
- si solo tienes una cuenta guardada, el modo automático puede usarla sin preguntar
- si tienes varias cuentas guardadas, en automático debes indicar cuál usar con `--account`

Prioridad actual para resolver credenciales:

1. `ET_USERNAME` + `ET_PASSWORD`
2. cuenta guardada en `/.accounts.local.json`

## Uso rápido

Durante desarrollo puedes ejecutar directamente el código fuente:

```bash
npm run dev
```

Si prefieres usar la versión compilada:

```bash
npm run build
npm run start
```

## Modo interactivo

Si ejecutas sin parámetros:

```bash
npm run start
```

entra en modo interactivo.

También puedes forzarlo con:

```bash
npm run start -- --interactive
```

o:

```bash
npm run start -- --manual
```

### Qué hace el modo interactivo

1. te deja elegir una cuenta guardada o introducir una nueva
2. si introduces una nueva, te pregunta si quieres guardarla
3. inicia sesión
4. abre `/hall`
5. descubre los brutos de la cuenta
6. te deja elegir entre:
   - todos los brutos
   - un bruto
   - varios brutos concretos

## Modo automático

El modo automático está pensado para lanzamientos no interactivos.

### Ejecutar todos los brutos

Con una sola cuenta guardada:

```bash
npm run start -- --mode all-brutes --headless
```

Con una cuenta concreta guardada:

```bash
npm run start -- --mode all-brutes --account "Mi cuenta principal" --headless
```

Con variables de entorno:

```bash
ET_USERNAME="mi_usuario" ET_PASSWORD="mi_password" npm run start -- --mode all-brutes --headless
```

### Ejecutar un solo bruto

En automático, `single` requiere indicar el bruto:

```bash
npm run start -- --mode single --brute ExampleBrute --account "Mi cuenta principal" --headless
```

o con variables:

```bash
ET_USERNAME="mi_usuario" ET_PASSWORD="mi_password" npm run start -- --mode single --brute ExampleBrute --headless
```

## Opciones principales

- `--mode single|all-brutes`
- `--brute <nombre>`
- `--account <label>`
- `--interactive`
- `--manual`
- `--debug`
- `--headless`
- `--profile-dir <ruta>`
- `--artifacts-dir <ruta>`
- `--logs-dir <ruta>`
- `--login-timeout-ms <ms>`
- `--url <url>`

### Notas útiles

- `single` en automático requiere `--brute`
- si hay varias cuentas guardadas, en automático conviene usar `--account`
- `--debug` controla sobre todo la verbosidad en terminal
- el archivo de log guarda detalle rico aunque no uses `--debug`

## Perfiles de navegador

El runner usa un perfil persistente de Playwright.

Si vas a alternar entre varias cuentas, es recomendable usar perfiles distintos:

```bash
npm run start -- --mode single --brute ExampleBrute --account "Mi cuenta principal" --profile-dir playwright-profile-main
```

```bash
npm run start -- --mode single --brute ExampleBrute --account "Cuenta secundaria" --profile-dir playwright-profile-alt
```

Así evitas mezclar cookies o estado entre cuentas.

## Logs y artifacts

Los logs se guardan en:

- `logs/`

Los artifacts de error se guardan en:

- `artifacts/`

Cuando algo falla, normalmente tendrás:

- un `.log`
- una captura `.png`
- un snapshot `.html`

## Flujo real del runner

En términos prácticos, el flujo actual es:

1. abre EternalTwin
2. inicia sesión si hace falta
3. estabiliza la cuenta
4. descubre brutos desde `/hall` cuando hace falta elegirlos
5. entra al `/cell` del bruto correspondiente
6. va a arena
7. elige rival
8. repite hasta descansar o terminar el modo elegido

## Limitaciones conocidas

- el proyecto depende del HTML real que sirva EternalTwin
- cambios en la interfaz pueden obligar a ajustar selectores o parsers
- la selección de rival depende de que el win-rate público se pueda resolver correctamente
- decisiones manuales como level-up siguen fuera de alcance

## Comandos de desarrollo

```bash
npm run build
npm run test
npm run check
```
