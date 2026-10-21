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
    "Un libro por id. Devuelve null si no existe."
    book(id: ID!): Book
    "Un autor por id. Devuelve null si no existe."
    author(id: ID!): Author
  }
`;

// Los argumentos que llegan al resolver (2º parámetro) tienen la forma del schema.
interface IdArgs {
  id: string;
}

// Un resolver por campo que lo necesite. Query.books y Query.authors devuelven
// los arreglos; los campos de Book y Author (id, title...) usan el resolver
// por defecto de GraphQL, que simplemente lee la propiedad con el mismo nombre.
export const resolvers = {
  Query: {
    books: () => books,
    authors: () => authors,
    // Firma completa: (parent, args, context, info). En un campo raíz parent no se usa.
    // find() devuelve undefined si no hay coincidencia; `?? null` lo convierte en null,
    // que es lo que GraphQL espera para un campo nullable (Book, sin "!").
    book: (_parent: unknown, args: IdArgs) => books.find((b) => b.id === args.id) ?? null,
    author: (_parent: unknown, args: IdArgs) => authors.find((a) => a.id === args.id) ?? null,
  },
};
