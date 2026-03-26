import test from 'node:test';
import assert from 'node:assert/strict';

import { selectors } from '../src/game/selectors';
import {
  extractArenaOpponentName,
  extractBruteNameFromUrl,
  extractHallBruteName,
  extractHomeBruteNameFromHref,
  extractLatestCellFightOutcomeFromImageSources,
  listHallRosterBrutes,
  pickTopLeftHomeBruteEntry,
  submitLoginForm,
} from '../src/game/navigation';

test('extractBruteNameFromUrl resolves brute identity from a special cell route', () => {
  assert.equal(
    extractBruteNameFromUrl('https://brute.eternaltwin.org/TargetBrute/cell'),
    'TargetBrute',
  );
});

test('extractBruteNameFromUrl resolves brute identity from arena and versus routes', () => {
  assert.equal(
    extractBruteNameFromUrl('https://brute.eternaltwin.org/ExampleBrute/arena'),
    'ExampleBrute',
  );
  assert.equal(
    extractBruteNameFromUrl('https://brute.eternaltwin.org/TargetBrute/versus/OpponentBrute'),
    'TargetBrute',
  );
});

test('extractHomeBruteNameFromHref resolves brute identity from roster links', () => {
  assert.equal(
    extractHomeBruteNameFromHref('/TargetBrute/cell'),
    'TargetBrute',
  );
  assert.equal(
    extractHomeBruteNameFromHref('https://brute.eternaltwin.org/OpponentBrute/cell?view=card'),
    'OpponentBrute',
  );
});

test('extractHallBruteName keeps the visible brute name from a hall card', () => {
  assert.equal(
    extractHallBruteName('ExampleBrute\nLevel 12 brute with agile bonuses'),
    'ExampleBrute',
  );
  assert.equal(
    extractHallBruteName('View\nTargetBrute69\nHeavy hitter with pets'),
    'TargetBrute69',
  );
  assert.equal(
    extractHallBruteName('Tommy08\nFast attacker with reach'),
    'Tommy08',
  );
});

test('extractHallBruteName rejects descriptive and stat-like hall lines', () => {
  assert.equal(
    extractHallBruteName('Level 12\nHeavy hitter with pets\nHP: 120'),
    undefined,
  );
  assert.equal(
    extractHallBruteName('15%\nRanking\nSpeed 12'),
    undefined,
  );
  assert.equal(
    extractHallBruteName('12/20\nRank 5\nXP: 120'),
    undefined,
  );
  assert.equal(
    extractHallBruteName('Sacrificar\nReiniciar\nHistorial de eventos'),
    undefined,
  );
});

test('extractLatestCellFightOutcomeFromImageSources reads the newest fight result from log icons', () => {
  assert.equal(
    extractLatestCellFightOutcomeFromImageSources([
      '/images/log/lose.webp',
      '/images/log/win.webp',
      '/images/log/win.webp',
    ]),
    'loss',
  );

  assert.equal(
    extractLatestCellFightOutcomeFromImageSources([
      '/images/log/win.webp',
      '/images/log/lose.webp',
    ]),
    'win',
  );

  assert.equal(
    extractLatestCellFightOutcomeFromImageSources([
      '/images/other/icon.webp',
      null,
      undefined,
    ]),
    undefined,
  );
});

test('listHallRosterBrutes navigates to /hall and waits for hall roster content', async () => {
  const operations: string[] = [];
  const hallContainers = [
    {
      entries: [
        {
          text: 'Nivel 99 ExampleModifier',
          attributes: { 'aria-label': null, title: null },
          nameNodes: ['ExampleModifier'],
          statIcons: 3,
          fights: 1,
        },
      ],
    },
    {
      entries: [
        {
          text: 'Salon',
          attributes: { 'aria-label': null, title: null },
          nameNodes: ['Salon'],
          statIcons: 0,
          fights: 0,
        },
      ],
    },
    {
      entries: [
        {
          text: 'Nivel 12 ExampleBrute',
          attributes: { 'aria-label': null, title: null },
          nameNodes: ['ExampleBrute'],
          statIcons: 3,
          fights: 1,
        },
        {
          text: 'Nivel 8 TargetBrute69',
          attributes: { 'aria-label': null, title: null },
          nameNodes: ['TargetBrute69'],
          statIcons: 2,
          fights: 1,
        },
        {
          text: 'Nivel 15 OpponentBrute',
          attributes: { 'aria-label': null, title: null },
          nameNodes: ['OpponentBrute'],
          statIcons: 3,
          fights: 1,
        },
      ],
    },
  ];

  const page = {
    async goto(url: string, options: { waitUntil: string }) {
      operations.push(`page.goto:${url}:${options.waitUntil}`);
    },
    locator(selector: string) {
      if (selector === selectors.hall.rosterContainer) {
        return {
          async count() {
            return hallContainers.length;
          },
          nth(containerIndex: number) {
            const hallContainer = hallContainers[containerIndex];
            return {
              locator(subSelector: string) {
                assert.ok([
                  selectors.hall.rosterEntries,
                  selectors.hall.descendantRosterEntries,
                ].includes(subSelector));
                return {
                  first() {
                    operations.push(`hallEntries.first:${containerIndex}`);
                    return this;
                  },
                  async waitFor(options: { state: string; timeout: number }) {
                    operations.push(`hallEntries.waitFor:${containerIndex}:${options.state}:${options.timeout}`);
                  },
                  async count() {
                    return hallContainer.entries.length;
                  },
                  nth(index: number) {
                    const entry = hallContainer.entries[index];
                    return {
                      async getAttribute(name: string) {
                        return entry.attributes[name as 'aria-label' | 'title'];
                      },
                      async boundingBox() {
                        return (entry as { boundingBoxData?: object }).boundingBoxData ?? null;
                      },
                      async innerText() {
                        return entry.text;
                      },
                      locator(selector: string) {
                        if (selector === selectors.hall.entryName) {
                          return {
                            async count() {
                              return entry.nameNodes.length;
                            },
                            nth(candidateIndex: number) {
                              return {
                                async innerText() {
                                  return entry.nameNodes[candidateIndex];
                                },
                              };
                            },
                          };
                        }

                        if (selector === selectors.hall.entryStatIcons) {
                          return {
                            async count() {
                              return entry.statIcons;
                            },
                          };
                        }

                        if (selector === selectors.hall.entryFightAvailability) {
                          return {
                            async count() {
                              return entry.fights;
                            },
                          };
                        }

                        throw new Error(`Unexpected entry selector: ${selector}`);
                      },
                    };
                  },
                };
              },
            };
          },
        };
      }

      throw new Error(`Unexpected selector: ${selector}`);
    },
  };

  const result = await listHallRosterBrutes(page as never, 'https://brute.eternaltwin.org/');

  assert.deepEqual(result, ['ExampleBrute', 'TargetBrute69', 'OpponentBrute']);
  assert.deepEqual(operations, [
    'page.goto:https://brute.eternaltwin.org/hall:domcontentloaded',
    'hallEntries.first:2',
    'hallEntries.waitFor:2:visible:5000',
  ]);
});

test('listHallRosterBrutes logs hall discovery steps and finds roster candidates without relying on main', async () => {
  const logs: string[] = [];
  const hallContainers = [
    {
      entries: [
        {
          text: 'Noticias',
          attributes: { 'aria-label': null, title: null },
          nameNodes: ['Noticias'],
          statIcons: 0,
          fights: 0,
        },
      ],
    },
    {
      entries: [
        {
          text: 'Nivel 18 ExampleBrute',
          attributes: { 'aria-label': 'Te quedan 0 combates para el día de hoy.', title: null },
          nameNodes: ['ExampleBrute'],
          statIcons: 3,
          fights: 1,
        },
        {
          text: 'Nivel 15 TargetBrute',
          attributes: { 'aria-label': 'Te quedan 0 combates para el día de hoy.', title: null },
          nameNodes: ['TargetBrute'],
          statIcons: 3,
          fights: 1,
        },
      ],
    },
  ];

  const page = {
    async goto() {},
    locator(selector: string) {
      assert.equal(selector, selectors.hall.rosterContainer);
      return {
        async count() {
          return hallContainers.length;
        },
        nth(containerIndex: number) {
          const hallContainer = hallContainers[containerIndex];
          return {
            locator(subSelector: string) {
              assert.ok([
                selectors.hall.rosterEntries,
                selectors.hall.descendantRosterEntries,
              ].includes(subSelector));
              return {
                first() {
                  return this;
                },
                async waitFor() {},
                async count() {
                  return hallContainer.entries.length;
                },
                nth(index: number) {
                  const entry = hallContainer.entries[index];
                  return {
                    async getAttribute(name: string) {
                      return entry.attributes[name as 'aria-label' | 'title'];
                    },
                    async boundingBox() {
                      return (entry as { boundingBoxData?: object }).boundingBoxData ?? null;
                    },
                    async innerText() {
                      return entry.text;
                    },
                    locator(innerSelector: string) {
                      if (innerSelector === selectors.hall.entryName) {
                        return {
                          async count() {
                            return entry.nameNodes.length;
                          },
                          nth(candidateIndex: number) {
                            return {
                              async innerText() {
                                return entry.nameNodes[candidateIndex];
                              },
                            };
                          },
                        };
                      }

                      if (innerSelector === selectors.hall.entryStatIcons) {
                        return {
                          async count() {
                            return entry.statIcons;
                          },
                        };
                      }

                      if (innerSelector === selectors.hall.entryFightAvailability) {
                        return {
                          async count() {
                            return entry.fights;
                          },
                        };
                      }

                      throw new Error(`Unexpected entry selector: ${innerSelector}`);
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };

  const logger = {
    info(message: string) {
      logs.push(message);
    },
    warn() {},
    error() {},
    debug() {},
    logFilePath: '/tmp/example.log',
  };

  const result = await listHallRosterBrutes(
    page as never,
    'https://brute.eternaltwin.org/',
    logger,
  );

  assert.deepEqual(result, ['ExampleBrute', 'TargetBrute']);
  assert.match(logs[0] ?? '', /\[hall\] Opening hall roster page https:\/\/brute\.eternaltwin\.org\/hall/);
  assert.match(logs[1] ?? '', /\[hall\] Found 2 hall roster container candidate\(s\)\./);
  assert.match(logs[2] ?? '', /\[hall\] Selected hall roster candidate #1 using direct entry discovery with 2 entries, 2 structurally valid, 2 extracted names\./);
  assert.match(logs[3] ?? '', /\[hall\] Accepted hall entries \(2\/2\): #0:ExampleBrute \|\| #1:TargetBrute/);
  assert.match(logs[4] ?? '', /\[hall\] Resolved 2 hall brute name\(s\): ExampleBrute, TargetBrute/);
});

test('listHallRosterBrutes does not choose a repeated non-roster container over a valid roster candidate', { concurrency: false }, async () => {
  const logs: string[] = [];
  const hallContainers = [
    {
      entries: [
        {
          text: 'Resumen',
          attributes: { 'aria-label': null, title: null },
          nameNodes: ['Resumen'],
          statIcons: 0,
          fights: 0,
        },
      ],
    },
    {
      entries: [
        {
          text: 'Nivel 18 ExampleBrute',
          attributes: { 'aria-label': 'Te quedan 0 combates para el día de hoy.', title: null },
          nameNodes: ['ExampleBrute'],
          statIcons: 3,
          fights: 1,
        },
        {
          text: 'Nivel 16 TargetBrute',
          attributes: { 'aria-label': 'Te quedan 1 combates para el día de hoy.', title: null },
          nameNodes: ['TargetBrute'],
          statIcons: 3,
          fights: 1,
        },
      ],
    },
    {
      entries: [
        {
          text: 'Versión beta Este juego está todavía en beta.',
          attributes: { 'aria-label': null, title: null },
          nameNodes: ['Versión beta'],
          statIcons: 0,
          fights: 0,
        },
        {
          text: 'Repórtalo en nuestro Discord',
          attributes: { 'aria-label': null, title: null },
          nameNodes: ['Discord'],
          statIcons: 0,
          fights: 0,
        },
      ],
    },
  ];

  const page = {
    async goto() {},
    locator(selector: string) {
      if (selector === selectors.hall.rosterContainer) {
        return {
          async count() {
            return hallContainers.length;
          },
          nth(containerIndex: number) {
            const hallContainer = hallContainers[containerIndex];
            return {
              locator(subSelector: string) {
                assert.ok([
                  selectors.hall.rosterEntries,
                  selectors.hall.descendantRosterEntries,
                ].includes(subSelector));
                return {
                  first() {
                    return this;
                  },
                  async waitFor() {},
                  async count() {
                    return hallContainer.entries.length;
                  },
                  nth(index: number) {
                    const entry = hallContainer.entries[index];
                    return {
                      async getAttribute(name: string) {
                        return entry.attributes[name as 'aria-label' | 'title'];
                      },
                      async boundingBox() {
                        return null;
                      },
                      async innerText() {
                        return entry.text;
                      },
                      locator(innerSelector: string) {
                        if (innerSelector === selectors.hall.entryName) {
                          return {
                            async count() {
                              return entry.nameNodes.length;
                            },
                            nth(candidateIndex: number) {
                              return {
                                async innerText() {
                                  return entry.nameNodes[candidateIndex];
                                },
                              };
                            },
                          };
                        }

                        if (innerSelector === selectors.hall.entryStatIcons) {
                          return {
                            async count() {
                              return entry.statIcons;
                            },
                          };
                        }

                        if (innerSelector === selectors.hall.entryFightAvailability) {
                          return {
                            async count() {
                              return entry.fights;
                            },
                          };
                        }

                        throw new Error(`Unexpected entry selector: ${innerSelector}`);
                      },
                    };
                  },
                };
              },
            };
          },
        };
      }

      throw new Error(`Unexpected selector: ${selector}`);
    },
  };

  const logger = {
    info(message: string) {
      logs.push(message);
    },
    warn() {},
    error() {},
    debug() {},
    logFilePath: '/tmp/example.log',
  };

  const result = await listHallRosterBrutes(page as never, 'https://brute.eternaltwin.org/', logger);

  assert.deepEqual(result, ['ExampleBrute', 'TargetBrute']);
  assert.match(logs[2] ?? '', /\[hall\] Selected hall roster candidate #1 using direct entry discovery with 2 entries, 2 structurally valid, 2 extracted names\./);
});

test('listHallRosterBrutes waits for hall roster cards to render before failing on non-roster containers', { concurrency: false }, async () => {
  const logs: string[] = [];
  let scanPhase = 0;

  const hallContainersByPhase = [
    [
      {
        entries: [
          {
            text: 'Versión beta Este juego está todavía en beta.',
            attributes: { 'aria-label': null, title: null },
            nameNodes: ['Versión beta'],
            statIcons: 0,
            fights: 0,
          },
          {
            text: 'Repórtalo en nuestro Discord',
            attributes: { 'aria-label': null, title: null },
            nameNodes: ['Discord'],
            statIcons: 0,
            fights: 0,
          },
        ],
      },
    ],
    [
      {
        entries: [
          {
            text: 'Versión beta Este juego está todavía en beta.',
            attributes: { 'aria-label': null, title: null },
            nameNodes: ['Versión beta'],
            statIcons: 0,
            fights: 0,
          },
          {
            text: 'Repórtalo en nuestro Discord',
            attributes: { 'aria-label': null, title: null },
            nameNodes: ['Discord'],
            statIcons: 0,
            fights: 0,
          },
        ],
      },
      {
        entries: [
          {
            text: 'Nivel 18 ExampleBrute',
            attributes: { 'aria-label': 'Te quedan 0 combates para el día de hoy.', title: null },
            nameNodes: ['ExampleBrute'],
            statIcons: 3,
            fights: 1,
          },
          {
            text: 'Nivel 16 TargetBrute',
            attributes: { 'aria-label': 'Te quedan 1 combates para el día de hoy.', title: null },
            nameNodes: ['TargetBrute'],
            statIcons: 3,
            fights: 1,
          },
        ],
      },
    ],
  ];

  const page = {
    async goto() {},
    async waitForTimeout() {
      scanPhase = 1;
    },
    locator(selector: string) {
      if (selector === selectors.hall.rosterContainer) {
        return {
          async count() {
            return hallContainersByPhase[scanPhase].length;
          },
          nth(containerIndex: number) {
            const hallContainer = hallContainersByPhase[scanPhase][containerIndex];
            return {
              locator(subSelector: string) {
                assert.ok([
                  selectors.hall.rosterEntries,
                  selectors.hall.descendantRosterEntries,
                ].includes(subSelector));
                return {
                  first() {
                    return this;
                  },
                  async waitFor() {},
                  async count() {
                    return hallContainer.entries.length;
                  },
                  nth(index: number) {
                    const entry = hallContainer.entries[index];
                    return {
                      async getAttribute(name: string) {
                        return entry.attributes[name as 'aria-label' | 'title'];
                      },
                      async boundingBox() {
                        return null;
                      },
                      async innerText() {
                        return entry.text;
                      },
                      locator(innerSelector: string) {
                        if (innerSelector === selectors.hall.entryName) {
                          return {
                            async count() {
                              return entry.nameNodes.length;
                            },
                            nth(candidateIndex: number) {
                              return {
                                async innerText() {
                                  return entry.nameNodes[candidateIndex];
                                },
                              };
                            },
                          };
                        }

                        if (innerSelector === selectors.hall.entryStatIcons) {
                          return {
                            async count() {
                              return entry.statIcons;
                            },
                          };
                        }

                        if (innerSelector === selectors.hall.entryFightAvailability) {
                          return {
                            async count() {
                              return entry.fights;
                            },
                          };
                        }

                        throw new Error(`Unexpected entry selector: ${innerSelector}`);
                      },
                    };
                  },
                };
              },
            };
          },
        };
      }

      throw new Error(`Unexpected selector: ${selector}`);
    },
  };

  const logger = {
    info(message: string) {
      logs.push(message);
    },
    warn() {},
    error() {},
    debug() {},
    logFilePath: '/tmp/example.log',
  };

  const result = await listHallRosterBrutes(page as never, 'https://brute.eternaltwin.org/', logger);

  assert.deepEqual(result, ['ExampleBrute', 'TargetBrute']);
  assert.match(logs[1] ?? '', /\[hall\] Found 1 hall roster container candidate\(s\)\./);
  assert.match(logs[2] ?? '', /\[hall\] Selected hall roster candidate #1 using direct entry discovery with 2 entries, 2 structurally valid, 2 extracted names\./);
});

test('listHallRosterBrutes falls back to descendant hall entries to return the full roster and logs rejected entries', async () => {
  const logs: string[] = [];
  const hallContainers = [
    {
      directEntries: [
        {
          text: 'Resumen del salon',
          attributes: { 'aria-label': null, title: null },
          nameNodes: ['Resumen del salon'],
          statIcons: 0,
          fights: 0,
        },
      ],
      descendantEntries: [
        {
          text: 'Nivel 21 ExampleBrute',
          attributes: { 'aria-label': 'Te quedan 0 combates para el día de hoy.', title: null },
          nameNodes: ['ExampleBrute'],
          statIcons: 3,
          fights: 1,
        },
        {
          text: 'Nivel 17 TargetBrute',
          attributes: { 'aria-label': 'Te quedan 1 combates para el día de hoy.', title: null },
          nameNodes: ['TargetBrute'],
          statIcons: 3,
          fights: 1,
        },
        {
          text: 'Nivel 12 OpponentBrute',
          attributes: { 'aria-label': 'Te quedan 2 combates para el día de hoy.', title: null },
          nameNodes: ['OpponentBrute'],
          statIcons: 2,
          fights: 1,
        },
        {
          text: 'Historial de eventos',
          attributes: { 'aria-label': null, title: null },
          nameNodes: ['Historial de eventos'],
          statIcons: 0,
          fights: 0,
        },
      ],
      descendantNoiseEntries: [
        {
          text: 'ExampleBrute',
          attributes: { 'aria-label': null, title: null },
          nameNodes: ['ExampleBrute'],
          statIcons: 0,
          fights: 0,
        },
        {
          text: 'strength agility speed',
          attributes: { 'aria-label': null, title: null },
          nameNodes: [],
          statIcons: 3,
          fights: 0,
        },
      ],
    },
  ];

  const page = {
    async goto() {},
    locator(selector: string) {
      assert.equal(selector, selectors.hall.rosterContainer);
      return {
        async count() {
          return hallContainers.length;
        },
        nth(containerIndex: number) {
          const hallContainer = hallContainers[containerIndex];
          return {
            locator(subSelector: string) {
              const entries = subSelector === selectors.hall.rosterEntries
                ? hallContainer.directEntries
                : subSelector === selectors.hall.descendantRosterEntries
                  ? hallContainer.descendantEntries
                  : undefined;
              if (!entries) {
                throw new Error(`Unexpected container selector: ${subSelector}`);
              }
              return {
                first() {
                  return this;
                },
                async waitFor() {},
                async count() {
                  return entries.length;
                },
                nth(index: number) {
                  const entry = entries[index];
                  return {
                    async getAttribute(name: string) {
                      return entry.attributes[name as 'aria-label' | 'title'];
                    },
                    async boundingBox() {
                      return (entry as { boundingBoxData?: object }).boundingBoxData ?? null;
                    },
                    async innerText() {
                      return entry.text;
                    },
                    locator(innerSelector: string) {
                      if (innerSelector === selectors.hall.entryName) {
                        return {
                          async count() {
                            return entry.nameNodes.length;
                          },
                          nth(candidateIndex: number) {
                            return {
                              async innerText() {
                                return entry.nameNodes[candidateIndex];
                              },
                            };
                          },
                        };
                      }

                      if (innerSelector === selectors.hall.entryStatIcons) {
                        return {
                          async count() {
                            return entry.statIcons;
                          },
                        };
                      }

                      if (innerSelector === selectors.hall.entryFightAvailability) {
                        return {
                          async count() {
                            return entry.fights;
                          },
                        };
                      }

                      throw new Error(`Unexpected entry selector: ${innerSelector}`);
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };

  const logger = {
    info(message: string) {
      logs.push(message);
    },
    warn() {},
    error() {},
    debug() {},
    logFilePath: '/tmp/example.log',
  };

  const result = await listHallRosterBrutes(page as never, 'https://brute.eternaltwin.org/', logger);

  assert.deepEqual(result, ['ExampleBrute', 'TargetBrute', 'OpponentBrute']);
  assert.match(logs[2] ?? '', /using descendant entry discovery with 4 entries, 3 structurally valid, 3 extracted names/);
  assert.match(logs[3] ?? '', /Accepted hall entries \(3\/4\): #0:ExampleBrute \|\| #1:TargetBrute \|\| #2:OpponentBrute/);
  assert.match(logs[4] ?? '', /Rejected hall entries \(1\/4\): #3:(blocked-action|missing-structural-evidence):Historial de eventos/);
  assert.match(logs[5] ?? '', /Resolved 3 hall brute name\(s\): ExampleBrute, TargetBrute, OpponentBrute/);
});

test('listHallRosterBrutes deduplicates overlapping descendant matches so one brute card counts once', async () => {
  const logs: string[] = [];
  const hallContainers = [
    {
      directEntries: [
        {
          text: 'Panel',
          attributes: { 'aria-label': null, title: null },
          nameNodes: ['Panel'],
          statIcons: 0,
          fights: 0,
        },
      ],
      descendantEntries: [
        {
          text: 'Nivel 22 ExampleBrute',
          attributes: { 'aria-label': 'Te quedan 0 combates para el día de hoy.', title: null },
          nameNodes: ['ExampleBrute'],
          statIcons: 3,
          fights: 1,
          boundingBoxData: { x: 0, y: 0, width: 200, height: 120 },
        },
        {
          text: 'Nivel 22 ExampleBrute',
          attributes: { 'aria-label': 'Te quedan 0 combates para el día de hoy.', title: null },
          nameNodes: ['ExampleBrute'],
          statIcons: 3,
          fights: 1,
          boundingBoxData: { x: 16, y: 12, width: 140, height: 84 },
        },
        {
          text: 'Nivel 18 TargetBrute',
          attributes: { 'aria-label': 'Te quedan 1 combates para el día de hoy.', title: null },
          nameNodes: ['TargetBrute'],
          statIcons: 3,
          fights: 1,
          boundingBoxData: { x: 0, y: 140, width: 200, height: 120 },
        },
        {
          text: 'Nivel 18 TargetBrute',
          attributes: { 'aria-label': 'Te quedan 1 combates para el día de hoy.', title: null },
          nameNodes: ['TargetBrute'],
          statIcons: 3,
          fights: 1,
          boundingBoxData: { x: 20, y: 154, width: 132, height: 80 },
        },
      ],
    },
  ];

  const page = {
    async goto() {},
    locator(selector: string) {
      assert.equal(selector, selectors.hall.rosterContainer);
      return {
        async count() {
          return hallContainers.length;
        },
        nth(containerIndex: number) {
          const hallContainer = hallContainers[containerIndex];
          return {
            locator(subSelector: string) {
              if (subSelector === '.MuiBox-root, [class*="box" i]') {
                throw new Error('Broad descendant MuiBox selector should not be used for hall roster discovery.');
              }

              const entries = subSelector === selectors.hall.rosterEntries
                ? hallContainer.directEntries
                : subSelector === selectors.hall.descendantRosterEntries
                  ? hallContainer.descendantEntries
                  : undefined;

              if (!entries) {
                throw new Error(`Unexpected container selector: ${subSelector}`);
              }

              return {
                first() {
                  return this;
                },
                async waitFor() {},
                async count() {
                  return entries.length;
                },
                nth(index: number) {
                  const entry = entries[index];
                  return {
                    async getAttribute(name: string) {
                      return entry.attributes[name as 'aria-label' | 'title'];
                    },
                    async boundingBox() {
                      return (entry as { boundingBoxData?: object }).boundingBoxData ?? null;
                    },
                    async innerText() {
                      return entry.text;
                    },
                    locator(innerSelector: string) {
                      if (innerSelector === selectors.hall.entryName) {
                        return {
                          async count() {
                            return entry.nameNodes.length;
                          },
                          nth(candidateIndex: number) {
                            return {
                              async innerText() {
                                return entry.nameNodes[candidateIndex];
                              },
                            };
                          },
                        };
                      }

                      if (innerSelector === selectors.hall.entryStatIcons) {
                        return {
                          async count() {
                            return entry.statIcons;
                          },
                        };
                      }

                      if (innerSelector === selectors.hall.entryFightAvailability) {
                        return {
                          async count() {
                            return entry.fights;
                          },
                        };
                      }

                      throw new Error(`Unexpected entry selector: ${innerSelector}`);
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };

  const logger = {
    info(message: string) {
      logs.push(message);
    },
    warn() {},
    error() {},
    debug() {},
    logFilePath: '/tmp/example.log',
  };

  const result = await listHallRosterBrutes(page as never, 'https://brute.eternaltwin.org/', logger);

  assert.deepEqual(result, ['ExampleBrute', 'TargetBrute']);
  assert.match(logs[2] ?? '', /using descendant entry discovery with 2 entries, 2 structurally valid, 2 extracted names/);
  assert.doesNotMatch(logs[2] ?? '', /3 entries|4 entries|5 entries|6 entries/);
  assert.match(logs[3] ?? '', /Accepted hall entries \(2\/2\): #0:ExampleBrute \|\| #1:TargetBrute/);
});

test('listHallRosterBrutes can fall back to the earliest structurally valid hall candidate when repetition evidence is absent', async () => {
  const hallContainers = [
    {
      entries: [
        {
          text: 'Nivel 12 ExampleBrute',
          attributes: { 'aria-label': null, title: null },
          nameNodes: ['ExampleBrute'],
          statIcons: 3,
          fights: 1,
        },
      ],
    },
    {
      entries: [
        {
          text: 'Nivel 8 TargetBrute',
          attributes: { 'aria-label': null, title: null },
          nameNodes: ['TargetBrute'],
          statIcons: 2,
          fights: 1,
        },
      ],
    },
  ];

  const page = {
    async goto() {},
    locator(selector: string) {
      if (selector === selectors.hall.rosterContainer) {
        return {
          async count() {
            return hallContainers.length;
          },
          nth(containerIndex: number) {
            const hallContainer = hallContainers[containerIndex];
            return {
              locator(subSelector: string) {
                assert.ok([
                  selectors.hall.rosterEntries,
                  selectors.hall.descendantRosterEntries,
                ].includes(subSelector));
                return {
                  first() {
                    return this;
                  },
                  async waitFor() {},
                  async count() {
                    return hallContainer.entries.length;
                  },
                  nth(index: number) {
                    const entry = hallContainer.entries[index];
                    return {
                      async getAttribute(name: string) {
                        return entry.attributes[name as 'aria-label' | 'title'];
                      },
                      async boundingBox() {
                        return (entry as { boundingBoxData?: object }).boundingBoxData ?? null;
                      },
                      async innerText() {
                        return entry.text;
                      },
                      locator(selector: string) {
                        if (selector === selectors.hall.entryName) {
                          return {
                            async count() {
                              return entry.nameNodes.length;
                            },
                            nth(candidateIndex: number) {
                              return {
                                async innerText() {
                                  return entry.nameNodes[candidateIndex];
                                },
                              };
                            },
                          };
                        }

                        if (selector === selectors.hall.entryStatIcons) {
                          return {
                            async count() {
                              return entry.statIcons;
                            },
                          };
                        }

                        if (selector === selectors.hall.entryFightAvailability) {
                          return {
                            async count() {
                              return entry.fights;
                            },
                          };
                        }

                        throw new Error(`Unexpected entry selector: ${selector}`);
                      },
                    };
                  },
                };
              },
            };
          },
        };
      }

      throw new Error(`Unexpected selector: ${selector}`);
    },
  };

  const result = await listHallRosterBrutes(page as never, 'https://brute.eternaltwin.org/');

  assert.deepEqual(result, ['ExampleBrute']);
});

test('listHallRosterBrutes rejects repeated non-roster hall controls and surfaces actionable diagnostics', async () => {
  const hallContainers = [
    {
      entries: [
        {
          text: 'Torneos',
          attributes: { 'aria-label': 'Torneos', title: null },
          nameNodes: ['Torneos'],
          statIcons: 0,
          fights: 0,
        },
        {
          text: 'Historial de eventos',
          attributes: { 'aria-label': null, title: null },
          nameNodes: ['Historial de eventos'],
          statIcons: 0,
          fights: 0,
        },
        {
          text: 'Sacrificar',
          attributes: { 'aria-label': null, title: 'Sacrificar' },
          nameNodes: ['Sacrificar'],
          statIcons: 0,
          fights: 0,
        },
      ],
    },
  ];

  const page = {
    async goto() {},
    locator(selector: string) {
      if (selector === selectors.hall.rosterContainer) {
        return {
          async count() {
            return hallContainers.length;
          },
          nth(containerIndex: number) {
            const hallContainer = hallContainers[containerIndex];
            return {
              locator(subSelector: string) {
                assert.ok([
                  selectors.hall.rosterEntries,
                  selectors.hall.descendantRosterEntries,
                ].includes(subSelector));
                return {
                  first() {
                    return this;
                  },
                  async waitFor() {},
                  async count() {
                    return hallContainer.entries.length;
                  },
                  nth(index: number) {
                    const entry = hallContainer.entries[index];
                    return {
                      async getAttribute(name: string) {
                        return entry.attributes[name as 'aria-label' | 'title'];
                      },
                      async boundingBox() {
                        return (entry as { boundingBoxData?: object }).boundingBoxData ?? null;
                      },
                      async innerText() {
                        return entry.text;
                      },
                      locator(selector: string) {
                        if (selector === selectors.hall.entryName) {
                          return {
                            async count() {
                              return entry.nameNodes.length;
                            },
                            nth(candidateIndex: number) {
                              return {
                                async innerText() {
                                  return entry.nameNodes[candidateIndex];
                                },
                              };
                            },
                          };
                        }

                        if (selector === selectors.hall.entryStatIcons) {
                          return {
                            async count() {
                              return entry.statIcons;
                            },
                          };
                        }

                        if (selector === selectors.hall.entryFightAvailability) {
                          return {
                            async count() {
                              return entry.fights;
                            },
                          };
                        }

                        throw new Error(`Unexpected entry selector: ${selector}`);
                      },
                    };
                  },
                };
              },
            };
          },
        };
      }

      throw new Error(`Unexpected selector: ${selector}`);
    },
  };

  await assert.rejects(
    () => listHallRosterBrutes(page as never, 'https://brute.eternaltwin.org/'),
    /none matched the roster-card structure.*(Historial de eventos|Sacrificar)/i,
  );
});

test('listHallRosterBrutes reports repeated-entry threshold failure when candidates have no entries', async () => {
  const page = {
    async goto() {},
    locator(selector: string) {
      if (selector === selectors.hall.rosterContainer) {
        return {
          async count() {
            return 2;
          },
          nth() {
            return {
              locator(subSelector: string) {
                assert.ok([
                  selectors.hall.rosterEntries,
                  selectors.hall.descendantRosterEntries,
                ].includes(subSelector));
                return {
                  async count() {
                    return 0;
                  },
                };
              },
            };
          },
        };
      }

      throw new Error(`Unexpected selector: ${selector}`);
    },
  };

  await assert.rejects(
    () => listHallRosterBrutes(page as never, 'https://brute.eternaltwin.org/'),
    /none contained repeated roster entries/i,
  );
});

test('listHallRosterBrutes reports when repeated entries are structurally valid but names cannot be extracted', async () => {
  const hallContainers = [
    {
      entries: [
        {
          text: 'Nivel 12\nHP: 120\nXP: 80',
          attributes: { 'aria-label': null, title: null },
          nameNodes: ['Nivel 12'],
          statIcons: 3,
          fights: 1,
        },
        {
          text: 'Nivel 8\nHP: 100\n12/20',
          attributes: { 'aria-label': null, title: null },
          nameNodes: ['Nivel 8'],
          statIcons: 2,
          fights: 1,
        },
      ],
    },
  ];

  const page = {
    async goto() {},
    locator(selector: string) {
      if (selector === selectors.hall.rosterContainer) {
        return {
          async count() {
            return hallContainers.length;
          },
          nth(containerIndex: number) {
            const hallContainer = hallContainers[containerIndex];
            return {
              locator(subSelector: string) {
                assert.ok([
                  selectors.hall.rosterEntries,
                  selectors.hall.descendantRosterEntries,
                ].includes(subSelector));
                return {
                  first() {
                    return this;
                  },
                  async waitFor() {},
                  async count() {
                    return hallContainer.entries.length;
                  },
                  nth(index: number) {
                    const entry = hallContainer.entries[index];
                    return {
                      async getAttribute(name: string) {
                        return entry.attributes[name as 'aria-label' | 'title'];
                      },
                      async boundingBox() {
                        return (entry as { boundingBoxData?: object }).boundingBoxData ?? null;
                      },
                      async innerText() {
                        return entry.text;
                      },
                      locator(selector: string) {
                        if (selector === selectors.hall.entryName) {
                          return {
                            async count() {
                              return entry.nameNodes.length;
                            },
                            nth(candidateIndex: number) {
                              return {
                                async innerText() {
                                  return entry.nameNodes[candidateIndex];
                                },
                              };
                            },
                          };
                        }

                        if (selector === selectors.hall.entryStatIcons) {
                          return {
                            async count() {
                              return entry.statIcons;
                            },
                          };
                        }

                        if (selector === selectors.hall.entryFightAvailability) {
                          return {
                            async count() {
                              return entry.fights;
                            },
                          };
                        }

                        throw new Error(`Unexpected entry selector: ${selector}`);
                      },
                    };
                  },
                };
              },
            };
          },
        };
      }

      throw new Error(`Unexpected selector: ${selector}`);
    },
  };

  await assert.rejects(
    () => listHallRosterBrutes(page as never, 'https://brute.eternaltwin.org/'),
    /no brute names could be extracted from 2 structurally valid entries/i,
  );
});

test('hall roster selector targets intentional brute-entry structures', () => {
  assert.doesNotMatch(selectors.hall.rosterContainer, /\bmain\b/);
  assert.match(selectors.hall.rosterContainer, /#root/);
  assert.match(selectors.hall.rosterContainer, /\.MuiPaper-root/);
  assert.match(selectors.hall.rosterEntries, /:scope > \.MuiBox-root/);
  assert.match(selectors.hall.descendantRosterEntries, /:has\(/);
  assert.match(selectors.hall.descendantRosterEntries, /aria-label\*="combates"/);
  assert.match(selectors.hall.entryName, /\.MuiTypography-root/);
  assert.match(selectors.hall.entryFightAvailability, /aria-label\*="combates"/);
});

test('pickTopLeftHomeBruteEntry prefers the top-left roster candidate over later generic positions', () => {
  const selected = pickTopLeftHomeBruteEntry([
    { index: 0, x: 420, y: 120 },
    { index: 1, x: 48, y: 64 },
    { index: 2, x: 300, y: 64 },
  ]);

  assert.deepEqual(selected, { index: 1, x: 48, y: 64 });
});

test('pickTopLeftHomeBruteEntry returns undefined when no roster candidates are available', () => {
  assert.equal(pickTopLeftHomeBruteEntry([]), undefined);
});

test('extractArenaOpponentName skips generic arena labels and keeps the visible rival name', () => {
  assert.equal(
    extractArenaOpponentName('Fight\nOpponentBrute\n62%'),
    'OpponentBrute',
  );
  assert.equal(
    extractArenaOpponentName('Comenzar el combate\nTargetBrute\nRatio de Victoria 41%'),
    'TargetBrute',
  );
});

test('submitLoginForm waits for the submit control to become enabled before clicking', async () => {
  const operations: string[] = [];
  const submitControl = {
    first() {
      return this;
    },
    async waitFor(options: { state: string; timeout: number }) {
      operations.push(`submit.waitFor:${options.state}:${options.timeout}`);
    },
    async isEnabled() {
      operations.push('submit.isEnabled');
      return operations.filter((entry) => entry === 'submit.isEnabled').length > 1;
    },
    async click() {
      operations.push('submit.click');
    },
  };
  const form = {
    first() {
      return this;
    },
    locator(selector: string) {
      if (selector.includes('username')) {
        return {
          first() {
            return this;
          },
          async fill(value: string) {
            operations.push(`username.fill:${value}`);
          },
        };
      }

      if (selector === 'input[type="password"]') {
        return {
          first() {
            return this;
          },
          async fill(value: string) {
            operations.push(`password.fill:${value}`);
          },
        };
      }

      return submitControl;
    },
  };
  const page = {
    locator() {
      return form;
    },
    async waitForTimeout(timeoutMs: number) {
      operations.push(`page.waitForTimeout:${timeoutMs}`);
    },
  };

  await submitLoginForm(page as never, 'EXAMPLE_USERNAME', 'EXAMPLE_PASSWORD');

  assert.deepEqual(operations, [
    'username.fill:EXAMPLE_USERNAME',
    'password.fill:EXAMPLE_PASSWORD',
    'submit.waitFor:visible:3000',
    'submit.isEnabled',
    'page.waitForTimeout:100',
    'submit.isEnabled',
    'submit.click',
  ]);
});
