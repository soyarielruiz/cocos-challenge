# ADR-0014: Los pesos disponibles netean las operaciones de activos

- Estado: Accepted
- Fecha: 2026-10-25
- Deciders: Ariel Ruiz
- Amends: ADR-0004, cláusula de cash únicamente

## Contexto

El enunciado exige "pesos disponibles para operar" y rechazar órdenes "por un
monto mayor al disponible": disponible es una cifra que refleja lo ya gastado.
La derivación vigente (cash = Σ ±size de órdenes sobre MONEDA) no baja tras una
BUY FILLED de un activo: el usuario podría gastar el mismo cash en forma
indefinida y la invariante de ADR-0009 quedaría vacía. Escribir una "pata de
cash" (segunda orden FILLED sobre MONEDA por el costo) es inviable con las
decisiones aceptadas: `size` es INTEGER y `price = 1` en MONEDA (ADR-0003,
ADR-0006), y los costos tienen centavos. El enunciado habilita el neteo con
"todos los movimientos pertinentes" de la tabla orders.

## Decisión

Cash derivado de un usuario = Σ(+size de CASH_IN FILLED, −size de CASH_OUT
FILLED) − Σ(size × price de órdenes BUY FILLED de activos) + Σ(size × price
de órdenes SELL FILLED de activos). No se escriben filas de cash: el neteo es
parte de la derivación en runtime. Las órdenes NEW, REJECTED y CANCELLED no
afectan el cash. Toda validación de fondos (BUY, CASH_OUT) y la serialización
de ADR-0009 usan esta única fórmula.

## Alternativas consideradas

- Cash = solo movimientos MONEDA (implementación actual) — no refleja lo
  gastado; permite exceder el cash en órdenes secuenciales y vacía la
  invariante de concurrencia de ADR-0009.
- Patas de cash como órdenes FILLED sobre MONEDA — inviable: size INTEGER y
  price = 1 no representan centavos; duplica filas del ledger.

## Consecuencias

**Positivas.**
- "Pesos disponibles para operar" refleja la realidad: comprar baja el cash,
  vender lo sube; la invariante de ADR-0009 es verificable y el test de
  concurrencia del EPIC-04 tiene contenido real.

**Negativas.**
- Cambia los golden values del portfolio ya entregado (EPIC-03) y exige
  actualizar sus tests de integración; requiere enmienda formal por ser
  ADR-0004 Accepted.
