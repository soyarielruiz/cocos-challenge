
## Testing: red-first, tres niveles y Neon branch aislada

- Estado: **Accepted**
- Fecha: 2026-10-21

**Contexto.** El challenge exige "un test funcional sobre la función para enviar una orden" y provee una DB compartida. Las validaciones del e2e no deben ensuciar los datos de desarrollo.

**Decisión.** Tres niveles: (1) unitarios con fakes en memoria de los puertos (sin Prisma) para use cases, ejecutores y policies, red-first TDD: primero los tests de las ramas de contrato, luego la implementación; (2) integración con Prisma real contra un **branch aislado de Neon** (branching instantáneo y gratuito), con seed determinístico por corrida; (3) **e2e funcional obligatorio con Supertest sobre `POST /orders`** cubriendo: market BUY con fondos → FILLED; market BUY sin fondos → REJECTED persistido; LIMIT → NEW; SELL sin tenencia → REJECTED; cancel NEW → CANCELLED; cancel no-NEW → 409; `amount` → floor con caso size 0. Coverage mínimo 80% en `execute.js`, ejecutores y policies. Nunca se mockea Prisma en integración.

**Alternativas consideradas.**

- Solo test unitario de la función: no cubre "funcional" (HTTP + persistencia real).
- Mockear Prisma en todos lados: valida contra suposiciones, no contra SQL real (el `DISTINCT ON` y las agregaciones solo se prueban con DB de verdad).

**Consecuencias.**

**Positivas.**

- Las ramas de negocio exigidas quedan demostradas en verde sobre el endpoint real.

**Negativas.**

- Dependencia de la disponibilidad de Neon en CI (mitigar: fallback a Postgres local en Docker para el runner).

---
