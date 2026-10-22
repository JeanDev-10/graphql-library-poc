import type { AuthorRecord } from '../../data.js';
import type { Context } from '../../context.js';
import { nextId, type IdArgs } from '../../shared.js';

interface AddAuthorArgs {
  input: { name: string };
}

// Firma de un resolver: (parent, args, context, info).
export const resolvers = {
  Query: {
    authors: (_parent: unknown, _args: unknown, { repo }: Context) => repo.allAuthors(),
    // El repositorio devuelve undefined si no hay coincidencia; `?? null` lo convierte en null,
    // que es lo que GraphQL espera para un campo nullable (Author, sin "!").
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
  },

  // Resolver de tipo: se ejecuta cuando el cliente pide `books` dentro de un Author.
  // El `parent` es lo que devolvió el resolver del nivel anterior (un AuthorRecord).
  Author: {
    books: (author: AuthorRecord, _args: unknown, { loaders }: Context) =>
      loaders.booksByAuthorId.load(author.id),
  },
};
