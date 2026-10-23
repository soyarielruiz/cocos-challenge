## Stack base: Express + JavaScript ESM

- Estado: **Accepted**
- Fecha: 2026-10-21

**Contexto.** El challenge exige "desarrollar utilizando Node.js" y sugiere Express o NestJS. NestJS es TypeScript-first: su CLI genera TS, su documentación y ecosistema asumen TS, y usarlo en JavaScript plano exige Babel con decorators legacy, fricción que empeora con cada dependencia futura del ecosistema Nest. El equipo ya tiene convenciones probadas de JavaScript ESM (features/route-schema-execute, composition root manual).

**Decisión.** Node.js 20 LTS + Express 4 + JavaScript ES modules (sin TypeScript, sin build step) + Prisma 5 + Zod + pino + Jest/Supertest. La configuración se lee una única vez al arranque con un schema Zod: fail antes de servir, reportando todos los errores; solo `PORT` tiene default. La falta de compilador se compensa con JSDoc tipado en puertos y exports, verificado en CI por ESLint con `eslint-plugin-jsdoc`. Cero tooling de TypeScript en el proyecto: ni `tsc`, ni `tsconfig`.

**Alternativas consideradas.**

- Fastify, performance superior y API similar; descartado por convención vigente del equipo y ecosistema de middlewares en Express.
- Knex / SQL crudo con `pg`, control fino de queries; descartado: Prisma cubre el schema provisto con introspección y migraciones, y las pocas queries agregadas (ADR-0004) son auditables.
- NestJS + TypeScript, técnicamente cumple (TS corre en Node y el challenge nombra NestJS), pero abre margen de discusión sobre el requisito "Node.js" y agrega build a un challenge de 4 endpoints.
- NestJS en JavaScript, viable pero antinatural: decorators legacy, CLI inútil, ecosistema en contra; costo de adaptación creciente a futuro.

**Consecuencias.**

**Positivas.**

- Fricción cero con el requisito; cero ceremony; la estructura mostrada es disciplina propia, no heredada.

**Negativas.**

- Sin type-checking: obligatorio JSDoc verificado por ESLint (`eslint-plugin-jsdoc`); los errores de tipo en runtime los atrapan los tests (red-first) y la cobertura mínima del 80%.

---
