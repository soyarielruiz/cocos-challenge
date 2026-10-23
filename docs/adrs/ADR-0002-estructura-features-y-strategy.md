
## Estructura por endpoint y Strategy para ejecutores

- Estado: **Accepted**
- Fecha: 2026-10-21

**Contexto.** Express no impone arquitectura, así que sin una decisión explícita el código termina donde termina siempre: controllers gordos con lógica de negocio adentro, testeables únicamente levantando HTTP + DB. El dominio tiene 4 endpoints con complejidad muy desigual: `search` y `portfolio` son lectura directa, pero `orders` es el corazón (estados, tipos, validación de fondos, transacciones). El objetivo es **limpio sin sobreingeniería**: cada pieza de la estructura responde a un problema concreto de este challenge, no a un patrón por moda. Los principios se aplican como herramientas, con su problema asociado:

**Decisión.** Estructura por caso de uso, con estas piezas y sus porqués:

- **Un endpoint = una carpeta** `src/features/<recurso>/<endpoint>/` con tres archivos de responsabilidad única: `route.js` (solo HTTP), `schema.js` (Zod), `execute.js` (use case). *Por qué:* un endpoint solo se entiende completo viendo su flujo entrada→validación→negocio→salida; agrupar por caso de uso hace que ese flujo viva en un solo lugar (KISS: navegar es trivial) y que agregar un endpoint sea agregar una carpeta, sin tocar existentes (OCP). Cada archivo cambia por una sola razón — el contrato, el transporte o el negocio (SRP a nivel de archivo, no de "capa" genérica).
- **`route.js` no tiene negocio y `execute.js` no conoce Express ni Prisma**: recibe puertos inyectados. *Por qué:* es lo que hace al corazón de orders testeable con fakes en memoria, sin levantar servidor ni base (DIP: el negocio depende de abstracciones declaradas en `src/shared/ports.js`); y si el negocio no vive en `route.js`, no puede acoplarse a `req/res`.
- **`app.js` como único composition root**: crea Prisma y repositorios, e inyecta los puertos una sola vez, manualmente. *Por qué:* el wiring en un único lugar hace visible el flujo real de dependencias (KISS) y evita el service locator que oculta quién depende de quién. Sin framework de DI: con 4 endpoints, inyección por constructor alcanza (YAGNI — un contenedor resolvería un problema que no tenemos).
- **Strategy para ejecutar órdenes** (`market-executor.js` / `limit-executor.js` detrás de un `Map` por tipo): MARKET y LIMIT son dos variantes que existen HOY con reglas distintas (fill inmediato al close vs. persistencia en NEW) — no es abstracción especulativa. El tipo de orden es además el eje de cambio más probable (si aparece STOP, se agrega un archivo y una entrada al Map, sin editar los existentes: OCP). Sin Strategy, ese switch crecería dentro del use case violando SRP.
- **`shared/` solo por promoción** (≥2 casos de uso lo usan o duplicación demostrada) y nunca importa `features/`. *Por qué:* es el balance DRY/YAGNI — ni genéricos tempranos (YAGNI) ni duplicación tolerada (DRY); el error duplicado y los puertos sí se comparten desde el día uno porque orders y portfolio los usan de entrada.

**Alternativas consideradas.**

- MVC plano (controllers + services globales) — el negocio queda acoplado a `req/res` e invisible para testear sin HTTP; los services tienden a multipropósito y violan SRP justo donde orders más lo necesita.
- Carpetas técnicas (`src/controllers`, `src/services`, `src/repositories`) — agrupa por patrón técnico en vez de por caso de uso: seguir un flujo obliga a saltar tres carpetas, y el estímulo a "services" compartidos multipropósito es el mismo.
- Hexagonal/Clean Architecture formal (domain/application/infrastructure con entidades y contratos separados) — da la misma testabilidad que los puertos inyectados, con tres capas de ceremonia que 4 endpoints no justifican (YAGNI).
- Framework de DI — indirection innecesaria a esta escala; el wiring manual es el que hace legible el flujo.

**Consecuencias.**

**Positivas.**

- El caso de uso de orders se testea puro (fakes); SQL aislado en repositorios; agregar endpoint o tipo de orden = archivo nuevo (OCP); cada archivo cambia por una razón (SRP); contrato en un solo lugar (DRY); toda la "arquitectura" son dos reglas de dirección de dependencias que caben en una línea.

**Negativas.**

- Más archivos que un controller monolítico y disciplina manual — Express no la impone; se mitiga con las reglas de imports del copilot-instructions (lint) y la revisión por ADR. El riesgo inverso también existe: sobre-extraer a `shared/` temprano; lo acota la regla de promoción.

---
