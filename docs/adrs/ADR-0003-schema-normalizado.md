## Modelo de datos: schema normalizado. Integridad, consistencia y performance

- Estado: **Accepted**
- Fecha: 2026-10-23

**Contexto.** El enunciado describe la base provista como "modelo funcional básico" y habilita explícitamente a modificarla con justificación técnica. Sobre el DDL real (`../../challenge_statements/database.sql` provisto): las FKs **existen** (orders→instruments/users, marketdata→instruments), pero el resto son gaps reales sin UNIQUE, sin CHECKs de dominio, sin NOT NULL, `NUMERIC(10,2)` justo para montos de cash (el propio seed carga 1.000.000 ARS), sin índices secundarios, y un naming doblado a minúsculas: los identificadores camelCase sin comillas se crean como `instrumentid`, `accountnumber`, `previousclose`. En un sistema que maneja dinero/activos, la premisa máxima es **consistencia de datos**; cada gap es una fuente real de inconsistencia (`size` negativo, status inválido, ticker duplicado) o de cuello de botella (agregaciones full-scan).

**Decisión.** Las **migrations son la fuente de verdad**: la migración inicial normaliza el schema y un seed recarga los datos provistos, con la justificación requerida por el enunciado en este ADR y el README. Ejes:

1. **Integridad referencial**: FKs de `orders → instruments/users` y `marketdata → instruments`, todas `ON DELETE RESTRICT`, en un sistema de dinero no se borra nada que tenga movimientos.
2. **Dominio garantizado por la DB** (última línea de defensa; el código valida primero con Zod): `CHECK (size > 0)`, `CHECK (price > 0)`, enums de `side`/`type`/`status`, `NOT NULL` en columnas de negocio, dinero como `NUMERIC(18,2)` (nunca float/double: representación binaria inexacta; y el `NUMERIC(10,2)` provisto queda justo para montos de cash, 18.2 da margen de mercado), `size INTEGER` (sin fracciones por dominio, ADR-0006).
3. **Unicidad**: `instruments.ticker`, `users.email`, y `marketdata (instrument_id, market_date)`, un solo precio por instrumento y día; `previousClose` se conserva como dato provisto (el enunciado fija su semántica para el retorno diario).
4. **Naming estándar**: columnas snake\_case con mapa explícito sobre el doblado actual, `instrumentid` → `instrument_id`, `accountnumber` → `account_number`, `previousclose` → `previous_close`, `orders.datetime` → `created_at`, `marketdata.date` → `market_date`; tablas plurales; Prisma mapea con `@map` y mantiene el código legible.
5. **Performance calibrada a las dos queries calientes**: índice parcial `orders (user_id, instrument_id) WHERE status = 'FILLED'`, toda lectura de tenencia/cash usa solo FILLED, y un índice parcial más chico calza exacto, y el UNIQUE de marketdata en `(instrument_id, market_date DESC)` para el `DISTINCT ON` del último precio. La **búsqueda de activos** (por ticker y/o nombre) se resuelve en una única query a nivel DB: `WHERE ticker ILIKE $1 OR name ILIKE $1`, con el match exacto de ticker primero; con \~66 instrumentos no se justifica un índice de texto completo ni trigram (GIN/pg\_trgm), YAGNI.

Las posiciones siguen **derivadas** de orders (ADR-0004): no se materializa estado que pueda divergir. El seed se recarga **tal cual, sin "corregirlo"**: contiene una fila que viola la invariante de dominio (un SELL FILLED de 30 acciones de un usuario con solo 20 compradas → posición neta −10 en BMA) y es el dataset otorgado; las constraints aplican a los datos **nuevos** que escribe nuestra API, y la política de lectura de posiciones legadas queda definida en ADR-0004.

**Alternativas consideradas.**

- Mantener el schema tal cual + índices, descartado: desaprovecha la invitación explícita del enunciado y deja los gaps de integridad; "sirve tal como está" es una descripción del punto de partida, no una restricción.
- `db pull` con solo índices, mínima pero inconsistente con la premisa: no resuelve FKs/CHECKs ni el naming mixto que complica cada query.
- Materializar posiciones, sigue excluida por la letra del challenge (ADR-0004).
- Triggers DB para transiciones de estado, sobreingeniería: las transiciones viven en el dominio (ADR-0005); la DB garantiza el dominio estático, no el dinámico.

**Consecuencias.**

**Positivas.**

- La invariante "nunca persistir datos imposibles" queda garantizada en la DB: sin huérfanas, sin `size` negativo, sin status inválido, sin dinero inexacto.
- Las dos consultas calientes cubiertas por índices que calzan exacto; naming consistente en toda query futura; responde punto por punto la invitación del enunciado con justificación documentada.

**Negativas.**

- La DB provista cambia: hay que entregar migración + seed y documentar cómo recrearla (costo pedido explícitamente por el enunciado).
- Los CHECKs duplican validación con Zod, costo aceptado: la web valida para UX (errores legibles), la DB para integridad.
- La migración debe ejecutarse antes de cualquier feature (se agenda en el Slice 0) para evitar convivencia de dos verdades.

---
