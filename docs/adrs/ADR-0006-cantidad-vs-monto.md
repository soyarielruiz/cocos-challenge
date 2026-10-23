## Entrada por cantidad o monto: floor, sin fracciones

- Estado: **Accepted**
- Fecha: 2026-10-21

**Contexto.** El challenge permite enviar la cantidad exacta de acciones o un monto total de inversión en pesos; "no se admiten fracciones de acciones".

**Decisión.** El request acepta `size` (entero de acciones) **xor** `amount` (ARS). Con `amount`: `size = floor(amount / precio de referencia)`, `close` para MARKET, precio límite para LIMIT. `size = 0` → rechazo (persistido en `REJECTED` según ADR-0005). Sin redondeo hacia arriba, sin fracciones. La invariante de `size` entero se mantiene también para el cash: `CASH_IN`/`CASH_OUT` se modelan como adquisición/disposición de unidades del instrumento `MONEDA` (ARS), donde `price = 1` convencionalmente y `size` es el monto entero en ARS, lo confirma el seed (CASH\_IN con `size` 1.000.000, `price` 1); por eso `size` es `INTEGER` en la DB (ADR-0003). Math monetario con `decimal.js`; nunca acumulación en float.

**Alternativas consideradas.**

- Redondear hacia arriba: compraría más de lo que el monto paga.
- Fracciones de acciones: prohibidas por el enunciado.

**Consecuencias.**

**Positivas.**

- Regla determinista, fácil de testear (rama `size 0` incluida en el e2e obligatorio).

**Negativas.**

- El "efectivo no invertido" del floor queda como cash disponible, decisión razonable pero a documentar.

---
