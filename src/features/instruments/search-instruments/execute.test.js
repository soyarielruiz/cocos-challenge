import { describe, expect, test } from '@jest/globals';
import { createInstrumentSearch } from './execute.js';

describe('instrument search use case', () => {
  test('forwards the parsed search term to the reader', async () => {
    const instruments = [
      { id: 1, ticker: 'MATCH', name: 'Exact match', type: 'ACCIONES' },
    ];
    const calls = [];
    const execute = createInstrumentSearch({
      search: async (term) => {
        calls.push(term);
        return instruments;
      },
    });

    await expect(execute('match')).resolves.toEqual(instruments);
    expect(calls).toEqual(['match']);
  });
});
