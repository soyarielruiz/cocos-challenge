## Validación con Zod en el borde y errores de dominio tipados

- Estado: **Accepted**
- Fecha: 2026-10-21

**Contexto.** Input HTTP no confiable, JavaScript sin tipos, y necesidad de respuestas de error semánticas y consistentes. Los decorators de class-validator en JS puro dependen de Babel legacy y son frágiles.

**Decisión.** Validación con **Zod** en `schema.js` de cada endpoint: schemas estrictos que rechazan campos desconocidos y reportan **todos** los errores detectados de una vez, antes de invocar `execute.js`. Zod *parsea* (no solo valida): el use case recibe un shape chequeado. Errores de dominio como clases tipadas en `src/shared/errors.js`; un único middleware de error al final del stack los mapea a `{ code, message, details? }` con status semánticos (400/404/409), traduce errores de Prisma/pg, y nunca expone stack traces. pino con request ID (`X-Request-Id` en toda respuesta) y `/health` con `SELECT 1`.

**Alternativas consideradas.**

- class-validator/class-transformer: requiere decorators en JS; menor calidad de detalle de errores que Zod.
- Validación ad-hoc en handlers: se duplica y deriva en respuestas inconsistentes.

**Consecuencias.**

**Positivas.**

- Contrato de errores uniforme; fail fast; mensajes accionables; mismo patrón que la config de ADR-0001.

**Negativas.**

- Doble definición de shape (schema Zod + JSDoc), costo aceptado a cambio de runtime seguro.

---
