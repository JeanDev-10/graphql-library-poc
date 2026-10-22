import type { BookRecord } from '../../data.js';
import type { Context } from '../../context.js';
import type { Db } from '../../repository.js';
import { badUserInput, forbidden } from '../../errors.js';
import { nextId, type IdArgs } from '../../shared.js';

interface AddBookArgs {
  input: { title: string; year: number; authorId: string };
}
interface UpdateBookArgs {
  id: string;
  input: { title?: string | null; year?: number | null; authorId?: string | null };
}

// Falla con un error con código (BAD_USER_INPUT) si el autor no existe.
// `argumentName` viaja en extensions para que el cliente sepa qué campo corregir.
function assertAuthorExists(db: Db, authorId: string) {
  if (!db.authors.some((a) => a.id === authorId)) {
    throw badUserInput(`El autor con id ${authorId} no existe`, { argumentName: 'authorId' });
  }
}

export const resolvers = {
  Query: {
    books: (_parent: unknown, _args: unknown, { repo }: Context) => repo.allBooks(),
    book: async (_parent: unknown, args: IdArgs, { repo }: Context) =>
      (await repo.bookById(args.id)) ?? null,
  },

  Mutation: {
    addBook: (_parent: unknown, { input }: AddBookArgs, { db, loaders }: Context) => {
      assertAuthorExists(db, input.authorId);
      const book: BookRecord = { id: nextId(db.books), ...input };
      db.books.push(book);
      // Los loaders cachean durante la petición: tras escribir hay que invalidar lo afectado.
      loaders.booksByAuthorId.clear(input.authorId);
      return book;
    },
    updateBook: (_parent: unknown, { id, input }: UpdateBookArgs, { db, loaders }: Context) => {
      const book = db.books.find((b) => b.id === id);
      if (!book) return null;
      if (input.authorId != null) assertAuthorExists(db, input.authorId);
      loaders.booksByAuthorId.clear(book.authorId); // autor anterior
      if (input.authorId != null) loaders.booksByAuthorId.clear(input.authorId); // autor nuevo
      // `??` conserva el valor actual si el cliente no envió el campo (o envió null).
      book.title = input.title ?? book.title;
      book.year = input.year ?? book.year;
      book.authorId = input.authorId ?? book.authorId;
      return book;
    },
    deleteBook: (_parent: unknown, { id }: IdArgs, { db, loaders, role }: Context) => {
      // Autorización: el contexto sabe QUIÉN pregunta; el resolver decide si puede.
      if (role !== 'admin') throw forbidden('Solo un admin puede eliminar libros');
      const index = db.books.findIndex((b) => b.id === id);
      if (index === -1) return false;
      loaders.booksByAuthorId.clear(db.books[index]!.authorId);
      db.books.splice(index, 1);
      return true;
    },
  },

  Book: {
    // BookRecord solo tiene authorId; aquí lo "traducimos" al objeto Author que promete el schema.
    // El `!` del schema garantiza que no puede ser null, por eso usamos `!` en TypeScript.
    // Con DataLoader: cada llamada a load() solo "pide" el autor; el loader junta todos los ids
    // de la misma tanda y hace UNA consulta. Los ids repetidos se cargan una sola vez (caché).
    author: async (book: BookRecord, _args: unknown, { loaders }: Context) =>
      (await loaders.authorById.load(book.authorId))!,
  },
};
