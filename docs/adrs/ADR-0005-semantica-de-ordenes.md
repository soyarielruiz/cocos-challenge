## Semántica de órdenes: MARKET/LIMIT, estados y transiciones

- Estado: **Accepted**
- Fecha: 2026-10-21

**Contexto.** El challenge fija: MARKET se ejecuta inmediatamente al último precio (`FILLED`), LIMIT queda `NEW`, los rechazos por fondos/tenencia insuficientes **se guardan** en `REJECTED`, solo `NEW` se cancela, y "NO hace falta simular el mercado".

**Decisión.** Máquina de estados explícita: `NEW → FILLED | CANCELLED`, y `REJECTED` como estado terminal de ingreso. MARKET: se valida y ejecuta al `close`, sin `price` en el request (si viene, 400). LIMIT: se persiste en `NEW` al precio pedido, sin matching engine. Rechazos (cash insuficiente en BUY, tenencia insuficiente en SELL): **se inserta la orden con status `REJECTED` y el endpoint responde 201 Created con el payload de la orden persistida**, cumplimiento estricto de "la orden tiene que ser rechazada y guardarse". `400 Bad Request` se reserva exclusivamente para errores de contrato/sintaxis (campo faltante, tipo inválido, `price` enviado en un MARKET): "request inválido" es semánticamente distinto de "negocio rechazado pero persistido y auditado". Nunca 400 sin persistir. Cancelar una orden no-`NEW` es error de dominio → 409.

**Alternativas consideradas.**

- Rechazar con 400/422 sin persistir: viola la letra del challenge y pierde auditabilidad.
- Simular matching de LIMIT: explícitamente innecesario según el enunciado.

**Consecuencias.**

**Positivas.**

- Trazabilidad completa del intento de operación (es posible ver el REJECTED en la tabla).

**Negativas.**

- 201 con una orden rechazada puede sorprender a un cliente HTTP ingenuo; el README y el api-contract deben aclarar el contrato.

---
