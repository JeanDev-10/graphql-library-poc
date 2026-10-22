import type { IncomingMessage } from 'node:http';
import { authors, books } from './data.js';
import { Repository, type Db } from './repository.js';

// El contexto es el 3er argumento de TODOS los resolvers. Se crea UNA VEZ POR PETICIÓN,
// así que es el lugar para lo que depende de quién pregunta (usuario, permisos) y para
// las dependencias compartidas (acceso a datos). Los resolvers no importan los datos
// directamente: los reciben por contexto, igual que recibirían una conexión a BD real.
export type Role = 'admin' | 'guest';

export interface Context {
  db: Db;
  repo: Repository;
  role: Role;
}

const db: Db = { authors, books };

// Autenticación de JUGUETE para la PoC: el rol viene en el header `x-role`.
// En un proyecto real aquí se validaría un JWT/sesión y se cargaría al usuario.
export async function createContext({ req }: { req: IncomingMessage }): Promise<Context> {
  const role: Role = req.headers['x-role'] === 'admin' ? 'admin' : 'guest';
  return { db, repo: new Repository(db), role };
}
