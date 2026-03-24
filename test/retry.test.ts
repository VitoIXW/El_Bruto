import test from 'node:test';
import assert from 'node:assert/strict';

import { canRetryFromState } from '../src/game/retry';

test('canRetryFromState allows retry only when still in the expected source state', () => {
  assert.equal(canRetryFromState('arena_selection', 'arena_selection'), true);
  assert.equal(canRetryFromState('arena_selection', 'pre_fight'), false);
  assert.equal(canRetryFromState('fight', 'cell_ready'), false);
});
