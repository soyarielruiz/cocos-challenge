/**
 * @typedef {object} DatabaseHealthReader
 * @property {() => Promise<void>} ping
 */

/**
 * @typedef {object} InstrumentSummary
 * @property {number} id
 * @property {string} ticker
 * @property {string} name
 * @property {'ACCIONES' | 'MONEDA'} type
 */

/**
 * @typedef {object} InstrumentSearchReader
 * @property {(term: string) => Promise<InstrumentSummary[]>} search
 */

export {};
