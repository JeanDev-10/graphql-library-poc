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

## Conceptos clave

| Concepto | Qué es | Dónde está |
|---|---|---|
| **Schema (`typeDefs`)** | Contrato tipado: qué datos y operaciones existen | `src/schema.ts` |
| **Resolvers** | Funciones que obtienen el valor de cada campo | `src/schema.ts` |
| **Datos** | "Base de datos" en memoria (libros y autores) | `src/data.ts` |
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

  Las mutations se escriben con la palabra `mutation` y modifican los datos **en memoria**
  (se pierden al reiniciar el servidor). Cada una devuelve el recurso resultante, así puedes
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
    deleteBook(id: "5")   # true si existía, false si no
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
- [ ] Paso 7: Variables, alias y fragments
- [ ] Paso 8: Context y manejo de errores
- [ ] Paso 9: Problema N+1 y DataLoader
- [ ] Paso 10: Separar en módulos
