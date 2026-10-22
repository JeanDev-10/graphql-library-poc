# PoC GraphQL: Biblioteca (libros y autores)

Proyecto de aprendizaje de **GraphQL** con **Node.js + TypeScript + Apollo Server 5**.
Se construye paso a paso; cada paso queda como commit y documentado aquí.

## Requisitos

- Node.js 20+ y npm

## Cómo ejecutarlo

```bash
npm install
npm run dev        # servidor con recarga automática en http://localhost:4000
npm run typecheck  # verificación de tipos
```

## Cómo probarlo

**Opción 1: Apollo Sandbox (recomendada).** Abre <http://localhost:4000> en el navegador.
Escribe la consulta en el panel izquierdo y pulsa ▶. El schema aparece documentado gracias a la *introspección*.

**Opción 2: curl / PowerShell.**

```bash
curl -X POST http://localhost:4000/ -H "Content-Type: application/json" \
  -d '{"query":"{ hello }"}'
```

**Opción 3: Insomnia / Postman.**

1. Nueva request `POST` a `http://localhost:4000/`.
2. En **Body** elige **GraphQL**: verás una caja para la **Query** y otra para las **Variables** (solo el JSON de variables).
3. Usa *Refresh Schema* para tener autocompletado (usa introspección).
4. Los datos viven en SQLite y **persisten entre reinicios**. Para volver a los datos iniciales
   (autores `1-3`, libros `1-4`): detén el servidor y ejecuta `npm run db:reset`.

Si prefieres JSON crudo (*raw → JSON*), el body es:
```json
{ "query": "query($id: ID!){ book(id:$id){ title } }", "variables": { "id": "3" } }
```
con el header `Content-Type: application/json`.

## Cómo viaja una petición

- Hay **un solo endpoint** (`/`). Las operaciones se distinguen por el contenido del body, no por la URL.
- **POST** (JSON con `query`, `variables`, `operationName`) sirve para todo. **GET** solo para queries
  (query y variables van en la URL) y las mutations por GET se rechazan.
- Los errores de negocio suelen venir con HTTP 200 y un array `errors` en el cuerpo.
- Un cliente Angular no arma el POST a mano: usa **Apollo Angular**, donde defines el documento
  (`gql`) y las `variables`, y la librería hace la petición y cachea el resultado.

## Conceptos clave

| Concepto | Qué es | Dónde está |
|---|---|---|
| **Schema (`typeDefs`)** | Contrato tipado: qué datos y operaciones existen | `src/modules/*/typeDefs.ts` |
| **Resolvers** | Funciones que obtienen el valor de cada campo | `src/modules/*/resolvers.ts` |
| **Ensamblado** | Junta los módulos en un único schema | `src/schema.ts` |
| **Base de datos** | SQLite (`node:sqlite`): conexión, tablas y semilla | `src/database.ts`, `src/data.ts` |
| **Context** | Objeto por petición con `repo`, `loaders` y `role`, 3.er argumento de los resolvers | `src/context.ts` |
| **Errores** | Errores con código y enmascarado de errores internos | `src/errors.ts` |
| **Repository** | Único lugar con SQL (consultas parametrizadas); anota las sentencias ejecutadas | `src/repository.ts` |
| **DataLoader** | Agrupa lecturas en lotes y cachea por petición (soluciona N+1) | `src/context.ts` |
| **Plugin** | Muestra el nº de consultas por petición (`extensions.dbQueries`) | `src/plugins.ts` |
| **Servidor** | Une schema + resolvers y los expone por HTTP en un único endpoint | `src/index.ts` |

### Resolver por defecto

Solo `Query.books` y `Query.authors` tienen resolver explícito. Para campos como `Book.title`,
GraphQL usa un *resolver por defecto* que lee la propiedad con el mismo nombre del objeto padre.

## Progreso

- [x] **Paso 1: Setup**: npm, TypeScript (ESM), `tsx`, Apollo Server 5.
- [x] **Paso 2: Hello world**: `Query.hello`.
  ```graphql
  query { hello }
  ```
- [x] **Paso 3: Schema Biblioteca con datos en memoria**: tipos `Book` y `Author`, queries `books` y `authors`.
  ```graphql
  query {
    books { id title year }
    authors { id name }
  }
  ```
  Prueba también pedir un campo que no existe (`books { title author }`): GraphQL lo rechaza
  *antes de ejecutar nada* con `GRAPHQL_VALIDATION_FAILED`. Eso es el schema actuando como contrato.
- [x] **Paso 4: Queries con argumentos**: `book(id)` y `author(id)`.
  ```graphql
  query {
    book(id: "3") { title year }
    autor: author(id: "2") { name }   # "autor" es un alias
  }
  ```
  - Id inexistente (`book(id: "99")`) → `{ "data": { "book": null } }`, sin error, porque el campo es nullable (`Book`, sin `!`).
  - Omitir el id → error de validación, porque el argumento es obligatorio (`ID!`).
  - Los argumentos llegan al resolver como 2º parámetro: `(parent, args, context, info)`.
- [x] **Paso 5: Resolvers anidados**: `Book.author` y `Author.books`.
  ```graphql
  query {
    books { title author { name } }
    authors { name books { title } }
  }
  ```
  El grafo es navegable en ambos sentidos y a cualquier profundidad (libro → autor → libros → autor...).
  La profundidad la elige el cliente, algo que en REST requeriría endpoints nuevos.

  **Cómo se ejecuta `books { title author { name } }`:**
  1. `Query.books` devuelve 4 `BookRecord`.
  2. Para cada libro: `title` usa el resolver por defecto y `Book.author(book)` busca el autor por `book.authorId`.
  3. Para cada autor: `name` usa el resolver por defecto.

  Ojo: `Book.author` se ejecuta **una vez por libro**. Con una BD real serían N consultas (problema N+1, paso 9).
- [x] **Paso 6: Mutations**: `addAuthor`, `addBook`, `updateBook`, `deleteBook`.

  Las mutations se escriben con la palabra `mutation` y modifican los datos (en este paso vivían
  **en memoria**; desde el paso 11 se guardan en SQLite). Cada una devuelve el recurso resultante, así puedes
  pedir en la misma petición los campos que quieras del objeto creado.

  ```graphql
  mutation {
    addAuthor(input: { name: "Mario Vargas Llosa" }) { id name }
  }

  mutation {
    addBook(input: { title: "La ciudad y los perros", year: 1963, authorId: "4" }) {
      id title author { name }
    }
  }

  mutation {
    updateBook(id: "5", input: { year: 1964 }) { title year }   # solo cambia lo enviado
  }

  mutation {
    deleteBook(id: "5")   # true si existía, false si no. Requiere el header x-role: admin (paso 8)
  }
  ```

  Casos límite para probar:
  - `addBook` con `authorId: "99"` → error `BAD_USER_INPUT` (`data: null`, porque el campo es `Book!`).
  - `updateBook` con un id inexistente → `null`, sin error (el campo es nullable).
  - `addAuthor(input: {})` → error de validación, falta `name` (`String!`).

  Conceptos:
  - **`input` vs `type`**: `input` es para *enviar* datos, `type` para *devolverlos*. No se pueden mezclar.
  - **Query vs Mutation**: técnicamente son iguales, pero los campos de una mutation raíz se ejecutan
    **en serie** (en orden) y los de una query pueden ejecutarse en paralelo. Por eso las escrituras van en `Mutation`.
  - **Actualización parcial**: `UpdateBookInput` tiene todos los campos opcionales y el resolver usa `??`
    para conservar el valor actual de lo que no se envía.
- [x] **Paso 7: Variables, alias, fragments y directivas**: sin cambios de código en el servidor;
  son funciones del lenguaje de consulta que ya trae GraphQL. Se aprenden desde el cliente.

  **Variables.** Se declaran en la operación (`$id: ID!`) y los valores viajan aparte en `variables`.
  Evitan concatenar strings (y con ello inyecciones) y permiten reutilizar la misma consulta.
  ```graphql
  query GetBook($id: ID!) { book(id: $id) { title } }
  ```
  Variables: `{ "id": "3" }`

  **Fragments.** Bloque de campos reutilizable, para no repetir la selección.
  ```graphql
  fragment BookCard on Book { id title year author { name } }

  query {
    books { ...BookCard }
    libro3: book(id: "3") { ...BookCard }
  }
  ```

  **Directivas** `@include(if:)` y `@skip(if:)`: incluyen o excluyen campos según una variable.
  ```graphql
  query Books($withAuthor: Boolean!, $hideYear: Boolean!) {
    books {
      title
      year @skip(if: $hideYear)
      author @include(if: $withAuthor) { name }
    }
  }
  ```
  Variables: `{ "withAuthor": true, "hideYear": true }` → solo `title` y `author`.

  **Varias operaciones en un documento.** Si hay más de una, hay que indicar cuál ejecutar con
  `operationName` (Insomnia/Sandbox lo preguntan). Sin él: `Must provide operation name if query contains multiple operations`.

  **Mutations en serie.** Los campos raíz de una mutation se ejecutan **en orden**. Con datos iniciales:
  ```graphql
  mutation {
    a: addAuthor(input: { name: "Autor nuevo" }) { id }          # recibe id "4"
    b: addBook(input: { title: "Libro nuevo", year: 2024, authorId: "4" }) { id title author { name } }
  }
  ```
  Si inviertes el orden (`b` antes que `a`), falla con `El autor con id 4 no existe`. Con una query, en cambio,
  el orden no afecta, porque los campos pueden resolverse en paralelo.

  **Errores de validación de variables** (se detectan antes de ejecutar):
  | Caso | Mensaje |
  |---|---|
  | Usar `$id` sin declararla | `Variable "$id" is not defined.` |
  | Declarar `$x` y no usarla | `Variable "$x" is never used.` |
  | No enviar una variable `ID!` | `Variable "$id" of required type "ID!" was not provided.` |
- [x] **Paso 8: Context y manejo de errores**

  **Context.** Objeto que se crea **una vez por petición** (`src/context.ts`) y llega como 3.er argumento a
  todos los resolvers. Aquí lleva el acceso a datos (ya no se importan directamente) y `role`
  (quién pregunta). Es el lugar natural para el usuario autenticado, conexiones a BD y, en el paso 9, los DataLoaders.

  **Autorización de juguete.** `deleteBook` exige el header `x-role: admin`. En Insomnia: pestaña **Header** →
  `x-role` = `admin`. Sin él:
  ```json
  { "errors": [{ "message": "Solo un admin puede eliminar libros", "extensions": { "code": "FORBIDDEN" } }], "data": null }
  ```
  y el status HTTP es **403** (se fija con `extensions.http.status`; por defecto GraphQL responde 200).
  En producción aquí se validaría un JWT/sesión; el header es solo para aprender.

  **Errores con código.** `src/errors.ts` define `badUserInput` y `forbidden`: lanzan un `GraphQLError` con
  `extensions.code` estable. El cliente decide según el código, no según el texto del mensaje.
  ```json
  { "message": "El autor con id 99 no existe", "path": ["addBook"],
    "extensions": { "code": "BAD_USER_INPUT", "argumentName": "authorId" } }
  ```

  **Errores inesperados (bugs, BD caída).** `formatError` los enmascara: el cliente solo ve
  `Error interno del servidor` (`INTERNAL_SERVER_ERROR`) y el detalle real se escribe en el log del servidor.
  Así no se filtran contraseñas, hosts ni rutas.

  **Stacktrace.** Ya no se envía por defecto. Para depurar: `INCLUDE_STACKTRACE=true npm run dev`
  (en PowerShell: `$env:INCLUDE_STACKTRACE="true"; npm run dev`).

  **Resultados parciales y propagación de `null`.** Una respuesta puede traer `data` **y** `errors` a la vez:
  | Caso | Resultado |
  |---|---|
  | `addBook` con autor inexistente (campo `Book!`) | `data: null` (el `null` sube hasta la raíz) |
  | `updateBook` con `authorId` inexistente (campo `Book`, nullable) | `data: { updateBook: null }` + `errors` |
  | `{ a: book(id:"2"){title} b: book(id:"99"){title} }` | `b: null` sin error; `a` llega bien |
  | Un campo `!` que devuelve `null` dentro de una lista `[Book!]!` | falla toda la lista → `data: null` |

  Regla: cuando un campo `!` falla, el `null` sube hasta el primer padre **nullable**. Por eso conviene que
  los campos que pueden fallar sean nullable: así un fallo no tumba toda la respuesta.
- [x] **Paso 9: Problema N+1 y DataLoader**

  **El problema.** `Book.author` se ejecuta una vez por libro. Con una BD real, cada ejecución sería una
  consulta SQL: 1 consulta para la lista + N para los autores = **N+1**. Con 4 libros ya son 5; con 1000, 1001.

  **Cómo se mide.** `src/repository.ts` anota cada consulta SQL que ejecuta (en este paso la BD era simulada;
  desde el paso 11 son sentencias reales de SQLite). Un plugin (`src/plugins.ts`)
  las cuenta: la lista completa sale en la consola del servidor y el número viaja en la respuesta, en
  `extensions.dbQueries` (solo para la PoC; en producción no se expondría). Pruébalo en Insomnia: el campo
  aparece junto a `data`, y el log del servidor muestra las consultas.

  | Query | Antes (ingenuo) | Con DataLoader |
  |---|---|---|
  | `{ books { title } }` | 1 | 1 |
  | `{ books { title author { name } } }` | **5** | **2** |
  | `{ authors { name books { title } } }` | **4** | **2** |
  | `{ authors { books { author { name } } } }` | **8** | **3** |

  El commit `Paso 9a` conserva la versión ingenua si quieres ver el "antes" (`git show f4872bc`).

  **La solución: DataLoader** (paquete `dataloader`). En vez de consultar de inmediato, `loader.load(id)`
  solo *anota* el id. Cuando termina el ciclo actual del event loop, el loader llama **una vez** a la función de
  lote con todos los ids acumulados, y reparte cada resultado a quien lo pidió:
  ```ts
  authorById: new DataLoader(async (ids) => {
    const found = await repo.authorsByIds(ids);        // UNA consulta: WHERE id IN (...)
    return ids.map((id) => found.find((a) => a.id === id)); // mismo orden y longitud que `ids`
  })
  ```
  En el resolver cambia una línea: `loaders.authorById.load(book.authorId)`.

  **Reglas importantes**
  1. **Un loader por petición**, creado en el contexto (`createLoaders` en `src/context.ts`). Cachea lo que carga;
     compartirlo entre peticiones serviría datos viejos y mezclaría datos entre usuarios.
  2. **El lote debe devolver un arreglo de la misma longitud y en el mismo orden que las claves**
     (`undefined` o `[]` donde no haya resultado). Una BD no garantiza orden ni devuelve huecos.
  3. **Tras escribir, invalida la caché** con `loader.clear(clave)`. Si no, dos mutations en la misma petición
     podrían leer una lista vieja. Las mutations `addBook`, `updateBook` y `deleteBook` lo hacen.
  4. Los ids repetidos se cargan una sola vez: con 4 libros de 3 autores se piden 3 autores, no 4.

  Comprobado: dos `addBook` al mismo autor en una sola petición devuelven la lista de libros actualizada
  después de cada uno.
- [x] **Paso 10: Separar en módulos por dominio**: sin cambios de comportamiento (el schema expone exactamente lo mismo).

  Un solo `schema.ts` con todo no escala. Ahora cada dominio vive en su carpeta con sus `typeDefs` y `resolvers`:
  ```
  src/
    index.ts              # arranca el servidor
    schema.ts             # ensambla: typeDefs = [authors, books], resolvers = [authors, books]
    context.ts            # contexto por petición (repo, loaders, role)
    database.ts           # conexión SQLite, tablas y semilla (paso 11)
    errors.ts · plugins.ts · repository.ts · data.ts · shared.ts
    modules/
      authors/{typeDefs,resolvers}.ts
      books/{typeDefs,resolvers}.ts
  ```
  Apollo Server acepta **arreglos** en `typeDefs` y `resolvers` y los fusiona. Dos detalles:
  - **Las raíces `Query`/`Mutation`:** exactamente un módulo las declara (`authors`) y los demás las amplían con
    `extend type Query { ... }` (`books`). Si ningún módulo declara la base, el servidor no arranca
    (`Cannot extend type "Query" because it is not defined`), y una raíz vacía tampoco es válida.
  - **Los resolvers del mismo tipo se combinan:** `Query` de authors y de books se suman en una sola `Query`.
    Los tipos pueden referirse entre módulos (`Author.books` usa `Book`, `Book.author` usa `Author`).

  **Cómo añadir un módulo nuevo** (p. ej. `genres`):
  1. Crea `src/modules/genres/typeDefs.ts` (con `extend type Query { ... }`) y `resolvers.ts`.
  2. Agrégalos a los arreglos de `src/schema.ts`.

  Pendiente opcional: `graphql-codegen`, que genera tipos TypeScript desde el schema para no escribir a mano
  las interfaces de argumentos (`AddBookArgs`, etc.) ni el tipo de los resolvers.
- [x] **Paso 11: Persistencia real con SQLite**

  Hasta ahora los datos eran arreglos en memoria. Ahora viven en un archivo SQLite (`data/library.db`) y
  **sobreviven a los reinicios**. La API GraphQL no cambia: el schema, las queries y las mutations son las mismas.
  Lo único que cambió es la capa de datos, y por eso es una buena demostración de por qué el schema y el
  almacenamiento son cosas independientes.

  **Por qué `node:sqlite`.** Viene incluido en Node (sin dependencias ni compilación nativa) y basta para aprender.
  Se usa SQL escrito a mano para ver exactamente qué consulta lanza cada resolver. En un proyecto real
  se suele usar un ORM o query builder (Drizzle, Prisma, Kysely).

  **Esquema** (`src/database.ts`, se crea solo al arrancar y se siembra con los datos iniciales si está vacía):
  ```sql
  CREATE TABLE authors (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL);
  CREATE TABLE books (
    id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, year INTEGER NOT NULL,
    author_id INTEGER NOT NULL REFERENCES authors(id)
  );
  CREATE INDEX idx_books_author_id ON books(author_id);
  ```

  **Uso**
  | Qué | Cómo |
  |---|---|
  | Arrancar | `npm run dev` (crea `data/library.db` la primera vez; está en `.gitignore`) |
  | Volver a los datos iniciales | detén el servidor y `npm run db:reset` |
  | Usar otro archivo | `DB_PATH=ruta/otra.db` (o `:memory:` para una BD temporal) |
  | Ver el SQL ejecutado | consola del servidor: cada petición lista sus sentencias reales |
  | Inspeccionar la BD | cualquier visor SQLite (p. ej. DB Browser for SQLite) abriendo `data/library.db` |

  **Lo que hay que entender**
  1. **Consultas parametrizadas.** Los `?` de `src/repository.ts` son parámetros: el valor viaja aparte del texto SQL y
     nunca se interpreta como código. Así se evita la **inyección SQL**. Nunca concatenes valores del cliente en el SQL.
     Comprobado: `book(id: "1; DROP TABLE books;--")` devuelve `null` y la tabla sigue intacta (además el repositorio
     descarta ids que no sean enteros sin llegar a consultar la BD).
  2. **IDs.** GraphQL expone `ID` como string; la BD guarda enteros. El repositorio traduce en ambos sentidos
     (`String(row.id)` al leer, número al consultar). `AUTOINCREMENT` no reutiliza ids de filas borradas.
  3. **Claves foráneas.** SQLite las trae **apagadas** en cada conexión; `PRAGMA foreign_keys = ON` las activa.
     Con eso la BD impide un libro con autor inexistente (`FOREIGN KEY constraint failed`) aunque falle la validación
     de la aplicación. La validación del resolver sigue ahí porque devuelve un error con código (`BAD_USER_INPUT`).
  4. **`RETURNING`.** `INSERT`/`UPDATE ... RETURNING` devuelve la fila resultante en la misma sentencia (sin un
     `SELECT` aparte), y por eso las mutations devuelven el recurso con una sola consulta.
  5. **Actualización parcial en SQL.** `SET title = COALESCE(?, title)` conserva el valor actual si no se envía el campo.
  6. **DataLoader sigue valiendo.** Con SQL real el ahorro es el mismo: `{ books { author { name } } }` ejecuta
     2 sentencias (`SELECT ... FROM books` y `SELECT ... FROM authors WHERE id IN (?, ?, ?)`) en vez de 5.
     `extensions.dbQueries` ahora cuenta también las escrituras (un `addBook` = 2: validar autor + `INSERT`).
  7. **Una conexión para todo el proceso, un `Repository` por petición.** SQLite es un archivo local y `DatabaseSync`
     es síncrono; en una BD de red (Postgres) usarías un *pool* de conexiones.
