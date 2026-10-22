import type { IncomingMessage } from 'node:http';
import DataLoader from 'dataloader';
import type { AuthorRecord, BookRecord } from './data.js';
import { Repository } from './repository.js';

// El contexto es el 3er argumento de TODOS los resolvers. Se crea UNA VEZ POR PETICIÓN,
// así que es el lugar para lo que depende de quién pregunta (usuario, permisos) y para
// las dependencias compartidas (acceso a datos). Los resolvers no tocan la BD directamente:
// la alcanzan a través de `repo`.
export type Role = 'admin' | 'guest';

export interface Loaders {
  authorById: DataLoader<string, AuthorRecord | undefined>;
  booksByAuthorId: DataLoader<string, BookRecord[]>;
}

export interface Context {
  repo: Repository;
  loaders: Loaders;
  role: Role;
}

// Los loaders se crean POR PETICIÓN, nunca globales: DataLoader cachea lo que ya cargó, y esa
// caché no debe compartirse entre peticiones (datos viejos) ni entre usuarios (permisos distintos).
function createLoaders(repo: Repository): Loaders {
  return {
    // Recibe TODOS los ids pedidos durante el mismo "tick" y hace UNA consulta.
    // Contrato: devolver un arreglo de la MISMA longitud y en el MISMO orden que `ids`.
    authorById: new DataLoader(async (ids) => {
      const found = await repo.authorsByIds(ids);
      return ids.map((id) => found.find((a) => a.id === id)); // undefined si no existe
    }),
    booksByAuthorId: new DataLoader(async (ids) => {
      const found = await repo.booksByAuthorIds(ids);
      return ids.map((id) => found.filter((b) => b.authorId === id)); // [] si no tiene libros
    }),
  };
}

// Autenticación de JUGUETE para la PoC: el rol viene en el header `x-role`.
// En un proyecto real aquí se validaría un JWT/sesión y se cargaría al usuario.
export async function createContext({ req }: { req: IncomingMessage }): Promise<Context> {
  const role: Role = req.headers['x-role'] === 'admin' ? 'admin' : 'guest';
  const repo = new Repository();
  return { repo, loaders: createLoaders(repo), role };
}
