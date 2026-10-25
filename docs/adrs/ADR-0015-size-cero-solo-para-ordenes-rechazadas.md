# ADR-0015: Permitir size cero solo en órdenes REJECTED

- Estado: Accepted
- Fecha: 2026-10-24
- Amends: ADR-0003, únicamente el CHECK de `orders.size`

## Contexto

ADR-0006 requiere que, al convertir `amount` a `size` mediante floor, un
resultado `size = 0` se persista como una orden `REJECTED` y la API responda
201. El CHECK vigente de ADR-0003, `size > 0`, impide persistir ese intento.
Se necesita permitir esta representación auditada sin relajar la invariante
para órdenes ejecutadas o en cualquier otro estado.

## Decisión

Reemplazar el CHECK de `orders.size` por:

```sql
CHECK (size > 0 OR (size = 0 AND status = 'REJECTED'))
```

Así, `size` debe ser positivo para todo estado distinto de `REJECTED`; solo
una orden `REJECTED` puede tener `size = 0`. No se permiten tamaños negativos.
El comportamiento de ADR-0006 permanece sin cambios: si `amount` produce
`size = 0`, se persiste la orden `REJECTED` y se responde 201.

## Alternativas consideradas

- Mantener `CHECK (size > 0)` y no persistir el intento: contradice el
  comportamiento de ADR-0006 para `size = 0`.
- Permitir `size >= 0` sin condición de estado: permitiría órdenes no
  rechazadas sin unidades, debilitando innecesariamente la invariante.

## Consecuencias

### Positivas

- Los intentos de orden que se redondean a cero quedan auditados como exige
  ADR-0006.
- La base sigue rechazando `size = 0` para cualquier estado que no sea
  `REJECTED`, y rechaza todos los tamaños negativos.

### Negativas

- La migración y los tests del contrato de base de datos deben mantener
  explícitamente la correspondencia entre `size = 0` y `status = 'REJECTED'`.
