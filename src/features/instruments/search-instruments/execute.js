import { instrumentSearchResponseSchema } from './schema.js';

/**
 * @typedef {import('../../../shared/ports.js').InstrumentSearchReader} InstrumentSearchReader
 * @typedef {import('../../../shared/ports.js').InstrumentSummary} InstrumentSummary
 */

/**
 * @param {InstrumentSearchReader} instrumentSearchReader
 * @returns {(term: string) => Promise<InstrumentSummary[]>}
 */
export const createInstrumentSearch = (instrumentSearchReader) => async (term) =>
  instrumentSearchResponseSchema.parse(await instrumentSearchReader.search(term));
