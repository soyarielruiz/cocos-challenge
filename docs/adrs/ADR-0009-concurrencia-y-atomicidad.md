## Creación de órdenes atómica (anti double-spend)

- Estado: **Accepted**
- Fecha: 2026-10-21

**Contexto.** Validar fondos y luego insertar en dos pasos abre una ventana de carrera: dos órdenes concurrentes **del mismo usuario** podrían gastar el mismo cash o vender la misma tenencia dos veces. Antes de elegir mecanismo hay que responder qué recursos son compartidos: cash y tenencias son **per-user y derivados de `orders`** (ADR-0004), no hay filas de balance materializadas sobre las que hacer `SELECT ... FOR UPDATE`, y el único estado mutable del sistema es el historial de órdenes de cada usuario.

**Decisión.** El use case posee la transacción: dentro de **una** transacción se toma un lock por usuario, `pg_advisory_xact_lock` sobre el userId, dentro del mismo tx que lee cash/tenencias e inserta la orden con su estado final. Repositorios aceptan `{ tx }` (TxOpts); el tx manager es un puerto inyectado. La unidad de serialización es **el usuario**, porque son sus recursos (cash en BUY, tenencia en SELL) los únicos que la orden consume.

**Contención cruzada: dos usuarios comprando el mismo ticker NO compiten.** Este modelo no tiene inventario de acciones: el enunciado dice "NO hace falta simular el mercado", `marketdata` solo modela precios (sin book ni profundidad), y una orden MARKET se ejecuta contra "las ofertas del mercado" al último `close`, el mercado es una contraparte con liquidez infinita. Si dos usuarios compran el mismo ticker, ambos reciben FILLED: no hay "última acción disponible" ni remanente, porque las acciones no salen de un fondo finito que dos órdenes disputan. El escenario de escasez presupone un matching engine con inventario, que este challenge excluye explícitamente. Si existiera, la unidad de serialización pasaría a ser el instrumento (lock sobre el book por `instrument_id`), documentado como evolución, no implementado.

**Alternativas consideradas.**

- Validación e inserción como pasos separados: race condition directa.
- Aislamiento `SERIALIZABLE` con reintento en 40001: correcto y sin locks explícitos, pero agrega lógica de retry al use case; el advisory lock logra lo mismo con una línea y sin reintentos.
- Bloqueo optimista con versiones: requiere filas de balance materializadas que no existen (ADR-0004); sobreingeniería para el alcance.
- Serializar por instrumento: innecesario: en este modelo no hay recurso compartido por ticker (ver contención cruzada); sería un cuello de botella global sin invariante que proteger.

**Consecuencias.**

**Positivas.**

- Las invariantes "el usuario nunca gasta más cash del que tiene" y "nunca vende más acciones de las que posee" se sostienen bajo concurrencia, cubriendo BUY y SELL.
- Sin cuello de botella global: usuarios distintos operando el mismo ticker lo hacen en paralelo; la serialización acota solo a las órdenes del mismo usuario.

**Negativas.**

- Las órdenes del mismo usuario se serializan: throughput por usuario acotado, irrelevante a esta escala y honesto de documentar.
- El modelo asume liquidez infinita al `close`: es un supuesto de dominio que debe constar en el README; se podría preguntar por el matching y la respuesta es este ADR, no un cambio de diseño.

---
