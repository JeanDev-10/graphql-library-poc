import { authors, books } from './data.js';

// Schema (SDL). El comentario #graphql activa el resaltado de sintaxis en editores.
// Las cadenas entre """ """ son descripciones: aparecen en Apollo Sandbox.
export const typeDefs = `#graphql
  """Un libro de la biblioteca."""
  type Book {
    id: ID!
    title: String!
    "Año de publicación"
    year: Int!
  }

  """Una persona que escribe libros."""
  type Author {
    id: ID!
    name: String!
  }

  type Query {
    "Todos los libros"
    books: [Book!]!
    "Todos los autores"
    authors: [Author!]!
  }
`;

// Un resolver por campo que lo necesite. Query.books y Query.authors devuelven
// los arreglos; los campos de Book y Author (id, title...) usan el resolver
// por defecto de GraphQL, que simplemente lee la propiedad con el mismo nombre.
export const resolvers = {
  Query: {
    books: () => books,
    authors: () => authors,
  },
};
