import type { AuthorRecord, BookRecord } from './data.js';

export interface Db {
  authors: AuthorRecord[];
  books: BookRecord[];
}

// Capa de acceso a datos que SIMULA una base de datos SQL: cada método es una "consulta"
// y la anota en `queries`. Así podemos contar cuántas consultas provoca una petición GraphQL.
// Una instancia por petición (se crea en el contexto), por eso `queries` empieza vacío.
// Solo las LECTURAS pasan por aquí; las mutations modifican `db` directamente.
export class Repository {
  readonly queries: string[] = [];

  constructor(private readonly db: Db) {}

  private log(sql: string) {
    this.queries.push(sql);
  }

  async allBooks() {
    this.log('SELECT * FROM books');
    return this.db.books;
  }

  async allAuthors() {
    this.log('SELECT * FROM authors');
    return this.db.authors;
  }

  async bookById(id: string) {
    this.log(`SELECT * FROM books WHERE id = ${id}`);
    return this.db.books.find((b) => b.id === id);
  }

  async authorById(id: string) {
    this.log(`SELECT * FROM authors WHERE id = ${id}`);
    return this.db.authors.find((a) => a.id === id);
  }

  async booksByAuthorId(authorId: string) {
    this.log(`SELECT * FROM books WHERE author_id = ${authorId}`);
    return this.db.books.filter((b) => b.authorId === authorId);
  }

  // Versiones por LOTE: una sola consulta con IN (...) en vez de una por id.
  // Las usan los DataLoaders. Ojo: no garantizan el orden ni devuelven huecos
  // para ids que no existen; el DataLoader se encarga de reordenarlos.
  async authorsByIds(ids: readonly string[]) {
    this.log(`SELECT * FROM authors WHERE id IN (${ids.join(', ')})`);
    return this.db.authors.filter((a) => ids.includes(a.id));
  }

  async booksByAuthorIds(authorIds: readonly string[]) {
    this.log(`SELECT * FROM books WHERE author_id IN (${authorIds.join(', ')})`);
    return this.db.books.filter((b) => authorIds.includes(b.authorId));
  }
}
