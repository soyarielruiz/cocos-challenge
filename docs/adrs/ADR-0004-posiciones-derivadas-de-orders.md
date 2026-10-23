##Posiciones y cash derivados, nunca materializados

- Estado: **Accepted**
- Fecha: 2026-10-21

**Contexto.** El challenge define: tenencia y pesos disponibles se calculan con los movimientos de `orders` (columna `size`); cash = instrumento `MONEDA`; valor de mercado y rendimiento con órdenes `FILLED`; precio de referencia = `close` del último `marketdata` (retorno diario con `previousClose`). El enunciado también exige: "Cuando una orden es ejecutada, se tiene que actualizar el listado de posiciones del usuario", se interpreta como que **el cálculo del portfolio debe reflejar el nuevo estado tras la ejecución**, no como materializar en una tabla `positions`: la instrucción explícita y prioritaria del mismo enunciado manda calcular tenencias desde los movimientos de `orders` con `size`; materializar duplicaría la fuente de verdad y agregaría complejidad de sincronización innecesaria (YAGNI).

**Decisión.** Posiciones y cash se derivan en runtime agregando `size` de órdenes `FILLED` por instrumento (cash: `CASH_IN`/`CASH_OUT`/`BUY`/`SELL` sobre el instrumento MONEDA). Último precio vía `DISTINCT ON (instrument_id) ... ORDER BY market_date DESC` en el repositorio de market data (único dueño del SQL crudo). Rendimiento total (%) de la posición = (valor de mercado actual − costo total invertido) / costo total invertido, con costo = precio promedio ponderado de compra; las ventas descuentan cantidad y mantienen la base de costo de las compras restantes (supuesto FIFO ponderado, documentado en README). El "retorno diario" del enunciado (`close` vs `previousClose`) es una métrica distinta, la variación diaria del activo, y se expone como campo adicional de contexto por posición (`dailyChangePct`) en la respuesta del portfolio; nunca sustituye al rendimiento total. El seed confirma el modelo de cash: CASH\_IN/CASH\_OUT son órdenes MARKET con `price = 1` sobre el instrumento ARS (`type MONEDA`), que no tiene marketdata, el cash se deriva únicamente de `orders` (size en pesos), nunca de precios. Posiciones legadas inconsistentes: el seed trae una posición neta negativa (usuario 1 en BMA: +20 compradas, −30 vendidas); política: se expone tal cual (cantidad y valor de mercado = qty × `close`) y el rendimiento se reporta `null` cuando qty ≤ 0 (base de costo indefinida); las órdenes creadas por nuestra API nunca generan ese estado (validación de ADR-0009).

**Alternativas consideradas.**

- Snapshot/materialización de posiciones: excluida por la letra del challenge.
- Precio promedio simple sin ponderar por volumen: distorsiona el rendimiento ante compras a distintos precios.

**Consecuencias.**

**Positivas.**

- Una única fuente de verdad (orders); el estado nunca diverge del historial.

**Negativas.**

- Cada lectura recalcula (mitigado por los índices de ADR-0003); el supuesto de base de costo con ventas es una convención que debe quedar explícita en el README.

---
