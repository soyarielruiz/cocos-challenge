
## Taxonomía de errores y mapeo de errores de persistencia

- Estado: **Accepted**
- Fecha: 2026-10-24

**Contexto.** ADR-0007 exige errores de dominio tipados, un único middleware de error con envelope `{ code, message, details? }` y la traducción de errores de Prisma/pg, pero no enumera los códigos estables ni el mapeo de persistencia. EPIC-01 S3 necesita fijarlos en tests sin adivinar. Matiz sobre las violaciones de FK: con `ON DELETE RESTRICT` (ADR-0003) y la validación de existencia previa en el use case (404), un `P2003`/`23503` no debería ser alcanzable por un camino esperado; es una red de seguridad ante una carrera o un bug. Si llega al boundary, es síntoma de bug y la pista es el log de pino con el request ID; nadie debe tratarlo como comportamiento normal del contrato.

**Decisión.** Los fallos esperados son clases tipadas en `src/shared/errors.js`, cada una con status HTTP, `code` estable, mensaje seguro y `details` opcional. El middleware serializa solo `{ code, message, details? }` (sin `details` si no hay). Los `details` de validación nombran campos inválidos, nunca los valores enviados. Conjunto único de códigos, espejado en el schema `Error` de `docs/api/openapi.yaml`:

| Status | Code | Origen |
| ---: | --- | --- |
| 400 | `INVALID_REQUEST` | Contrato/Zod (incluye `price` en MARKET, LIMIT de cash, XOR size/amount) |
| 404 | `NOT_FOUND` | Recurso inexistente o de otro usuario (anti-enumeración); también `P2025` |
| 409 | `ORDER_NOT_CANCELLABLE` | Dominio: cancelar una orden que no está en `NEW` (ADR-0005) |
| 409 | `RESOURCE_CONFLICT` | Persistencia: `P2002`/`23505` (unique), `P2003`/`23503` (FK) |
| 500 | `INTERNAL_SERVER_ERROR` | Todo lo demás, mensaje genérico |

`ORDER_NOT_CANCELLABLE` es distinto de `RESOURCE_CONFLICT` para que un cliente distinga "esto nunca va a pasar con esta orden" de un conflicto de persistencia potencialmente transitorio. Todo otro error de Prisma/pg y todo error no tipado responde 500 con mensaje genérico. Nunca se devuelven mensajes de DB, SQL, nombres de constraints, metadata ni stack traces. El error original se loguea con pino y el request ID.

**Alternativas consideradas.**

- Devolver mensajes crudos de Prisma/pg: expone diagnósticos de la base; descartado.
- Traducir todo error de persistencia a 500 genérico: pierde semántica útil en unique/not-found; descartado.
- Un único código 409 para dominio y persistencia: impide al cliente distinguir el caso permanente del potencialmente transitorio; descartado.

**Consecuencias.**

**Positivas.**

- Contrato de errores estable y testeable, espejado en el openapi; los fallos de DB inesperados no revelan nada al cliente.

**Negativas.**

- El boundary debe reconocer códigos Prisma y SQLSTATE y mantener ambos mapeos consistentes; agregar un código exige actualizar ADR y openapi.

---
