export const selectors = {
  login: {
    loginForm: 'form[action*="login"], form:has(input[type="password"])',
    usernameInput:
      'input[name="username"], input[autocomplete="username"], input[type="text"], input[type="email"]',
    passwordInput: 'input[type="password"]',
    loginButton: 'a:has-text("Log in"), button:has-text("Log in"), a:has-text("Conectarse"), button:has-text("Conectarse")',
    submitButton:
      'form button[type="submit"], form input[type="submit"], form button:has-text("Log in"), form button:has-text("Conectarse"), form button:has-text("Iniciar sesión")',
    searchBruteInput:
      'input[placeholder*="Search a Brute" i], input[aria-label*="Search a Brute" i], input[placeholder*="Buscar un bruto" i], input[aria-label*="Buscar un bruto" i]',
    bruteNotFoundText: 'text=/brute not found|bruto no encontrado/i',
  },
  home: {
    authenticatedMarker:
      'a[href$="/cell"], a[href*="/cell?"], button[aria-label*="brute" i], [data-testid*="brute" i]',
    rosterBruteEntries:
      'main a[href$="/cell"]:has(img, svg, canvas, [role="img"], [class*="avatar" i], [class*="icon" i]), ' +
      'main a[href*="/cell?"]:has(img, svg, canvas, [role="img"], [class*="avatar" i], [class*="icon" i])',
  },
  cell: {
    arenaLink: 'a[href$="/arena"]',
    nextBruteControl:
      'a:has-text("Next Brute"), button:has-text("Next Brute"), a:has-text("Siguiente Bruto"), button:has-text("Siguiente Bruto"), a[aria-label="Next Brute"], button[aria-label="Next Brute"], a[aria-label="Siguiente Bruto"], button[aria-label="Siguiente Bruto"]',
    restingText:
      'text=/rest(ing|ed)|come back later|no more fights|is resting|new fights (will be )?available tomorrow|est[aá] descansando|nuevos combates estar[aá]n disponibles ma[nñ]ana/i',
    bruteNameHeading: 'h1, h2, [data-testid="brute-name"]',
  },
  arena: {
    welcomeText: 'text=/bienvenido a la arena|welcome to the arena/i',
    searchInput: 'input[type="search"], input[placeholder*="brute" i], input[aria-label*="brute" i]',
    goButton: 'button:has-text("GO!"), input[type="submit"][value="GO!"]',
    opponentLinks: 'a[href*="/fight/"], button[formaction*="/fight/"], button[onclick*="/fight/"]',
    opponentCards:
      'div.MuiGrid-root.MuiGrid-item.MuiGrid-grid-xs-12.MuiGrid-grid-sm-6',
    anyFightStartLink: 'a[href*="/fight/"]',
  },
  preFight: {
    startFightLink:
      'a[href*="/fight/"], button:has-text("Comenzar el combate"), button:has-text("Start fight"), [role="button"]:has-text("Comenzar el combate"), [role="button"]:has-text("Start fight"), div:has(> h5:has-text("Comenzar el combate")), div:has(> h5:has-text("Start fight"))',
    versusText: 'text=/vs\.?/i',
  },
  fight: {
    returnToCellLinks: 'a[href$="/cell"]',
    fightContainer: 'main, body',
  },
  levelUp: {
    levelUpHeading: 'text=/level up|sube de nivel/i',
    levelUpChoiceText: 'text=/choose|skill|weapon|pet/i',
  },
};

export function buildCellHrefPattern(bruteName: string): string {
  return `/${encodeURIComponent(bruteName)}/cell`;
}

export function buildCellUrl(origin: string, bruteName: string): string {
  return `${origin}/${encodeURIComponent(bruteName)}/cell`;
}

export function normalizeText(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}
