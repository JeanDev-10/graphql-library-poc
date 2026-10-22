// Schema del módulo Books (ver authors/typeDefs.ts para el patrón `extend type`).
export const typeDefs = `#graphql
  """Un libro de la biblioteca."""
  type Book {
    id: ID!
    title: String!
    "Año de publicación"
    year: Int!
    "Autor del libro (se resuelve desde authorId)"
    author: Author!
  }

  input AddBookInput {
    title: String!
    year: Int!
    authorId: ID!
  }

  # Todos opcionales: solo se cambia lo que el cliente envíe (actualización parcial).
  input UpdateBookInput {
    title: String
    year: Int
    authorId: ID
  }

  extend type Query {
    "Todos los libros"
    books: [Book!]!
    "Un libro por id. Devuelve null si no existe."
    book(id: ID!): Book
  }

  extend type Mutation {
    "Crea un libro para un autor existente"
    addBook(input: AddBookInput!): Book!
    "Actualiza campos de un libro. Devuelve null si el libro no existe."
    updateBook(id: ID!, input: UpdateBookInput!): Book
    "Elimina un libro. Devuelve true si existía. Requiere el header x-role: admin."
    deleteBook(id: ID!): Boolean!
  }
`;
