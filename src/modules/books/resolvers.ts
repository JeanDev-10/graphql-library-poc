import type { BookRecord } from '../../data.js';
import type { Context } from '../../context.js';
import type { Repository } from '../../repository.js';
import { badUserInput, forbidden } from '../../errors.js';
import type { IdArgs } from '../../shared.js';

interface AddBookArgs {
  input: { title: string; year: number; authorId: string };
}
interface UpdateBookArgs {
  id: string;
  input: { title?: string | null; year?: number | null; authorId?: string | null };
}

// Falla con un error con código (BAD_USER_INPUT) si el autor no existe.
// `argumentName` viaja en extensions para que el cliente sepa qué campo corregir.
// (La BD también lo impediría con la clave foránea, pero con un error técnico y sin código.)
async function assertAuthorExists(repo: Repository, authorId: string) {
  if (!(await repo.authorById(authorId))) {
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
    addBook: async (_parent: unknown, { input }: AddBookArgs, { repo, loaders }: Context) => {
      await assertAuthorExists(repo, input.authorId);
      const book = await repo.insertBook(input);
      // Los loaders cachean durante la petición: tras escribir hay que invalidar lo afectado.
      loaders.booksByAuthorId.clear(input.authorId);
      return book;
    },
    updateBook: async (
      _parent: unknown,
      { id, input }: UpdateBookArgs,
      { repo, loaders }: Context,
    ) => {
      const current = await repo.bookById(id);
      if (!current) return null;
      if (input.authorId != null) await assertAuthorExists(repo, input.authorId);
      const updated = await repo.updateBook(id, input);
      loaders.booksByAuthorId.clear(current.authorId); // autor anterior
      if (input.authorId != null) loaders.booksByAuthorId.clear(input.authorId); // autor nuevo
      return updated ?? null;
    },
    deleteBook: async (_parent: unknown, { id }: IdArgs, { repo, loaders, role }: Context) => {
      // Autorización: el contexto sabe QUIÉN pregunta; el resolver decide si puede.
      if (role !== 'admin') throw forbidden('Solo un admin puede eliminar libros');
      const current = await repo.bookById(id);
      if (!current) return false;
      const deleted = await repo.deleteBook(id);
      loaders.booksByAuthorId.clear(current.authorId);
      return deleted;
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
