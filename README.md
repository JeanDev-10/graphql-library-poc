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
- [ ] Paso 4: Queries (`books`, `book(id)`, `authors`, `author(id)`)
- [ ] Paso 5: Resolvers anidados (`Book.author`, `Author.books`)
- [ ] Paso 6: Mutations (`addBook`, `updateBook`, `deleteBook`, `addAuthor`)
- [ ] Paso 7: Variables, alias y fragments
- [ ] Paso 8: Context y manejo de errores
- [ ] Paso 9: Problema N+1 y DataLoader
- [ ] Paso 10: Separar en módulos
