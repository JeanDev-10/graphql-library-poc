import type { AuthorRecord, BookRecord } from './data.js';
import type { Context } from './context.js';
import type { Db } from './repository.js';
import { badUserInput, forbidden } from './errors.js';

// Schema (SDL). El comentario #graphql activa el resaltado de sintaxis en editores.
// Las cadenas entre """ """ son descripciones: aparecen en Apollo Sandbox.
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

  """Una persona que escribe libros."""
  type Author {
    id: ID!
    name: String!
    "Libros escritos por este autor"
    books: [Book!]!
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

  # "input" es el tipo de objeto para ENVIAR datos. Los "type" solo sirven para devolver.
  input AddAuthorInput {
    name: String!
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

  type Mutation {
    "Crea un autor"
    addAuthor(input: AddAuthorInput!): Author!
    "Crea un libro para un autor existente"
    addBook(input: AddBookInput!): Book!
    "Actualiza campos de un libro. Devuelve null si el libro no existe."
    updateBook(id: ID!, input: UpdateBookInput!): Book
    "Elimina un libro. Devuelve true si existía. Requiere el header x-role: admin."
    deleteBook(id: ID!): Boolean!
  }
`;

interface AddAuthorArgs {
  input: { name: string };
}
interface AddBookArgs {
  input: { title: string; year: number; authorId: string };
}
interface UpdateBookArgs {
  id: string;
  input: { title?: string | null; year?: number | null; authorId?: string | null };
}

// Genera el siguiente id numérico como string (en una BD real lo haría la BD).
const nextId = (items: { id: string }[]) =>
  String(Math.max(0, ...items.map((i) => Number(i.id))) + 1);

// Falla con un error con código (BAD_USER_INPUT) si el autor no existe.
// `argumentName` viaja en extensions para que el cliente sepa qué campo corregir.
function assertAuthorExists(db: Db, authorId: string) {
  if (!db.authors.some((a) => a.id === authorId)) {
    throw badUserInput(`El autor con id ${authorId} no existe`, { argumentName: 'authorId' });
  }
}

// Los argumentos que llegan al resolver (2º parámetro) tienen la forma del schema.
interface IdArgs {
  id: string;
}

// Un resolver por campo que lo necesite. Query.books y Query.authors devuelven
// los arreglos; los campos de Book y Author (id, title...) usan el resolver
// por defecto de GraphQL, que simplemente lee la propiedad con el mismo nombre.
// Firma completa: (parent, args, context, info). Los datos ya no se importan:
// llegan en `context.db` (paso 8).
export const resolvers = {
  Query: {
    books: (_parent: unknown, _args: unknown, { repo }: Context) => repo.allBooks(),
    authors: (_parent: unknown, _args: unknown, { repo }: Context) => repo.allAuthors(),
    // El repositorio devuelve undefined si no hay coincidencia; `?? null` lo convierte en null,
    // que es lo que GraphQL espera para un campo nullable (Book, sin "!").
    book: async (_parent: unknown, args: IdArgs, { repo }: Context) =>
      (await repo.bookById(args.id)) ?? null,
    author: async (_parent: unknown, args: IdArgs, { repo }: Context) =>
      (await repo.authorById(args.id)) ?? null,
  },

  // Las mutations modifican los datos y devuelven el recurso resultante, para que el
  // cliente pueda pedir en la misma petición los campos que quiera del objeto creado.
  Mutation: {
    addAuthor: (_parent: unknown, { input }: AddAuthorArgs, { db }: Context) => {
      const author: AuthorRecord = { id: nextId(db.authors), name: input.name };
      db.authors.push(author);
      return author;
    },
    addBook: (_parent: unknown, { input }: AddBookArgs, { db }: Context) => {
      assertAuthorExists(db, input.authorId);
      const book: BookRecord = { id: nextId(db.books), ...input };
      db.books.push(book);
      return book;
    },
    updateBook: (_parent: unknown, { id, input }: UpdateBookArgs, { db }: Context) => {
      const book = db.books.find((b) => b.id === id);
      if (!book) return null;
      if (input.authorId != null) assertAuthorExists(db, input.authorId);
      // `??` conserva el valor actual si el cliente no envió el campo (o envió null).
      book.title = input.title ?? book.title;
      book.year = input.year ?? book.year;
      book.authorId = input.authorId ?? book.authorId;
      return book;
    },
    deleteBook: (_parent: unknown, { id }: IdArgs, { db, role }: Context) => {
      // Autorización: el contexto sabe QUIÉN pregunta; el resolver decide si puede.
      if (role !== 'admin') throw forbidden('Solo un admin puede eliminar libros');
      const index = db.books.findIndex((b) => b.id === id);
      if (index === -1) return false;
      db.books.splice(index, 1);
      return true;
    },
  },

  // Resolvers de tipo: se ejecutan cuando el cliente pide ese campo dentro de un Book/Author.
  // El `parent` es lo que devolvió el resolver del nivel anterior (un BookRecord, un AuthorRecord).
  Book: {
    // BookRecord solo tiene authorId; aquí lo "traducimos" al objeto Author que promete el schema.
    // El `!` del schema garantiza que no puede ser null, por eso usamos `!` en TypeScript.
    // VERSIÓN INGENUA: una consulta por cada libro (problema N+1).
    author: async (book: BookRecord, _args: unknown, { repo }: Context) =>
      (await repo.authorById(book.authorId))!,
  },
  Author: {
    // VERSIÓN INGENUA: una consulta por cada autor (problema N+1).
    books: (author: AuthorRecord, _args: unknown, { repo }: Context) =>
      repo.booksByAuthorId(author.id),
  },
};
