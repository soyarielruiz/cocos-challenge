# cocos-challenge-qa-automation

**Resumen:**
Tenés una app de inversiones en React Native (Expo) —`app-qa`— ya desarrollada, que
consume una API REST (instrumentos, portafolio, búsqueda y envío de órdenes). Tu trabajo
no es agregarle funcionalidad: es **evaluar su calidad y automatizar su validación**.

Lo que más nos interesa evaluar no es cuántos tests escribís, sino tu **criterio**: qué
decidís probar, **qué decidís NO probar, y por qué**. Un buen QA prioriza en función del
riesgo y sabe justificar el alcance de su trabajo.

Tiempo estimado: **una semana**.

## La app bajo prueba

`app-qa` es una app de trading en React Native (Expo) ya construida. Cloná el repo desde
[github.com/cocoscap/app-qa](https://github.com/cocoscap/app-qa) y seguí su `README` para
levantarla (Bun, un simulador de iOS o un emulador de Android, y un `.env` copiado de
`.env.example`).

A grandes rasgos, la app tiene:

- **Instrumentos**: listado con ticker, nombre, último precio y retorno diario.
- **Búsqueda**: buscador de instrumentos por ticker.
- **Portafolio**: efectivo disponible y posiciones con valor de mercado, ganancia y
  rendimiento.
- **Órdenes**: envío de órdenes (`BUY`/`SELL`, `MARKET`/`LIMIT`) e historial con su estado,
  más una acción para reiniciar la cuenta.

El formulario de órdenes acepta la **cantidad exacta** de acciones **o** un **monto en
pesos**, que la app convierte a la cantidad máxima de acciones enteras usando el último
precio (sin fracciones de acción).

Vos decidís a qué nivel automatizar —UI sobre el dispositivo/simulador, la API que
consume, o una combinación— y con qué herramientas. Se valora que la elección esté
**justificada** en función del problema.

## La API bajo prueba

Base URL: `https://dummy-api-topaz.vercel.app`

La app consume esta API REST; podés pegarle directo para automatizar a ese nivel.

### Headers requeridos y aislamiento de estado

Cada request necesita dos headers:

- `X-Enable-Bugs` — requerido. Controla el "nivel de defectos" de la API y sólo acepta los
  valores `off`, `easy`, `medium` o `hard` (case-insensitive); cualquier otro valor —o su
  ausencia— hace que la API responda `400`.
  - Con `off` la API se comporta de forma **correcta** ("golden path"): es la línea base
    contra la que escribís tus aserciones.
  - `easy`, `medium` y `hard` **inyectan defectos intencionales** de dificultad creciente.
    Sirven para **validar tu propia suite**: tus tests deberían **pasar con `off`** y
    **empezar a fallar** a medida que subís el nivel. Detectar cada bug puntual no es un
    entregable explícito, pero una buena suite debería ser capaz de hacerlo.
- `X-Candidate-Id: <tu-id>` — identifica tu sesión. Los endpoints `/portfolio`, `/orders`
  y `/reset` responden `400` sin él. La API **aísla** tu estado (órdenes, efectivo y
  tenencias) por este id, así que elegí un valor propio (por ejemplo tu nombre) y vas a
  trabajar sobre tu propia cuenta sin interferir con la de otros candidatos.

Los instrumentos y sus precios son **compartidos y de sólo lectura**; lo que es
por-candidato es tu portafolio y tus órdenes.

Cada candidato arranca con **1.000.000 ARS** y sin posiciones. El portafolio (efectivo +
tenencias) se **deriva de tus órdenes en estado `FILLED`**: no hay saldo guardado aparte.
Tu estado **persiste** entre corridas; `POST /reset` lo borra (útil para preparar o
limpiar escenarios). Esto es para facilitar el armado de los casos de prueba. Es parte del entregable mencionar cómo se puede montar la automatización en un entorno donde un reset no es una posibilidad.

### Endpoints

- `GET /instruments` — listado de instrumentos. Cada uno incluye `ticker`, `name`,
  `last_price` y `close_price`. El retorno diario se calcula a partir del último precio y
  el precio de cierre.
- `GET /search?query=<texto>` — búsqueda de instrumentos por ticker.
- `GET /portfolio` — `{ cash, holdings }`, derivados de tus órdenes `FILLED` y **netos de
  lo reservado por tus órdenes `PENDING`**. Para cada tenencia:
  `ticker`, `quantity`, `last_price`, `close_price` y `avg_cost_price` (precio de compra
  promedio ponderado). El valor de mercado de una posición es `quantity * last_price`; usá
  `avg_cost_price` para la ganancia ($) y el rendimiento (%).
- `GET /orders` — tu historial de órdenes.
- `POST /orders` — envío de una orden. Body:

  ```json
  // Orden a mercado, por cantidad de acciones
  { "instrument_id": 1, "side": "BUY", "type": "MARKET", "quantity": 1234 }

  // Orden límite (requiere price)
  { "instrument_id": 1, "side": "SELL", "type": "LIMIT", "quantity": 123, "price": 84.5 }
  ```

  La respuesta incluye un `id` y un `status`.
- `POST /reset` — borra tu estado para empezar de cero.

### Reglas de negocio documentadas

- Los precios están en pesos (ARS) y no se admiten fracciones de acciones: `quantity` debe
  ser un **entero positivo**.
- `side` puede ser `BUY` o `SELL`; `type` puede ser `MARKET` o `LIMIT`.
- El `status` de una orden puede ser `FILLED`, `PENDING` o `REJECTED`.
- Las órdenes `MARKET` se ejecutan de inmediato (`FILLED`) al `last_price` del instrumento.
- Las órdenes `LIMIT` **siempre se crean como `PENDING`** y se resuelven en algún momento
  (conceptualmente, cuando el mercado las acepta; en la práctica, bajo ciertas condiciones y
  con un factor aleatorio): cada `PENDING` puede quedarse en `PENDING`, pasar a `FILLED` o
  pasar a `REJECTED`.
- Al crearse, tanto `MARKET` como `LIMIT` **reservan saldo**: una compra reserva efectivo y
  una venta reserva acciones. Una orden `PENDING` mantiene esa reserva (reduce lo disponible
  para nuevas órdenes), una `FILLED` la liquida y una `REJECTED` la libera. Por eso el `cash`
  y las `holdings` de `/portfolio` van **netos de lo reservado**.

## Qué esperamos que entregues

1. **Plan de pruebas** (puede vivir dentro del README). Como mínimo:
   - Alcance: qué vas a cubrir y con qué profundidad.
   - **Fuera de alcance**: qué decidiste NO probar y **la razón** (tiempo, riesgo, valor,
     limitaciones del entorno, etc.).
   - Priorización basada en riesgo: qué es lo más crítico de este sistema y por qué.
   - Supuestos que tomaste ante cualquier ambigüedad de la consigna o del comportamiento
     real de la app/API.
2. **Suite de pruebas automatizadas**. Lenguaje y framework a tu elección. Tiene que estar
   acompañada de la documentación para poder ejecutarse.
3. **Reporte de bugs / hallazgos**. Todo comportamiento que consideres incorrecto,
   inconsistente o inesperado respecto de lo documentado. Para cada hallazgo: pasos de
   reproducción, resultado esperado vs. obtenido, severidad y evidencia.
4. **README** que explique cómo ejecutar la suite y las decisiones que tomaste.

## Consideraciones técnicas

- La suite debe ser **reproducible** por otra persona: instrucciones claras y una sola
  forma de ejecutarla.
- Pensá en la **confiabilidad** de tus pruebas: que no sean intermitentes (flaky) y que sus
  aserciones verifiquen comportamiento real, no solo que el request "no explotó". Tené en
  cuenta que la resolución de las órdenes `LIMIT` es **no determinística**.
- Pensá en el **aislamiento entre tests**: tu estado persiste entre corridas y varias pueden
  interferir entre sí. Usá tu `X-Candidate-Id` y `POST /reset` a tu favor.
- La app puede tener **problemas de calidad**, incluso cosas que **dificulten la
  automatización**. Detectarlos y documentarlos es parte del challenge.
- Si necesitás **modificar la app** para poder automatizarla, hacelo; documentá **qué
  cambiaste y por qué**.
- Reporte de resultados legible (HTML, JUnit, etc.).

## Opcionales / Nice to have

- Validación de contrato/esquema de las respuestas.
- Colección de Postman/Insomnia/REST Client como apoyo a la exploración.

## Entrega

Subí tu solución a un repositorio git (público o con acceso) con todo el historial de
commits. Enfocate en entregarlo como si fuera a usarse en un entorno real (Production
Ready).
