import { database } from './database.js';
import type { AuthorRecord, BookRecord } from './data.js';

// Filas tal como salen de SQLite (columnas en snake_case, ids numéricos).
interface AuthorRow {
  id: number;
  name: string;
}
interface BookRow {
  id: number;
  title: string;
  year: number;
  author_id: number;
}

type Param = string | number | null;

const toAuthor = (r: AuthorRow): AuthorRecord => ({ id: String(r.id), name: r.name });
const toBook = (r: BookRow): BookRecord => ({
  id: String(r.id),
  title: r.title,
  year: r.year,
  authorId: String(r.author_id),
});

// Un ID de GraphQL llega como string. Solo se acepta un entero positivo; cualquier otra cosa
// ("abc", "1 OR 1=1", "-5") se trata como "no existe" y NI SIQUIERA llega a la BD.
const toRowId = (id: string): number | null => (/^\d+$/.test(id) ? Number(id) : null);

// Los `?` son PARÁMETROS: el valor viaja aparte del texto SQL y SQLite nunca lo interpreta como código.
// Así se evita la inyección SQL. Nunca construyas el SQL concatenando valores del cliente.
const placeholders = (n: number) => Array(n).fill('?').join(', ');

const BOOK_COLUMNS = 'id, title, year, author_id';

// Capa de acceso a datos: el ÚNICO lugar con SQL. Una instancia por petición, para poder anotar en
// `queries` las sentencias reales que provoca cada petición GraphQL (las cuenta el plugin).
export class Repository {
  readonly queries: string[] = [];

  private log(sql: string, params: Param[]) {
    this.queries.push(params.length > 0 ? `${sql}   -- [${params.join(', ')}]` : sql);
  }

  private all<T>(sql: string, params: Param[] = []): T[] {
    this.log(sql, params);
    return database.prepare(sql).all(...params) as unknown as T[];
  }

  private get<T>(sql: string, params: Param[] = []): T | undefined {
    this.log(sql, params);
    return database.prepare(sql).get(...params) as unknown as T | undefined;
  }

  private run(sql: string, params: Param[] = []) {
    this.log(sql, params);
    return database.prepare(sql).run(...params);
  }

  // ---- Lecturas ----

  async allBooks() {
    return this.all<BookRow>(`SELECT ${BOOK_COLUMNS} FROM books ORDER BY id`).map(toBook);
  }

  async allAuthors() {
    return this.all<AuthorRow>('SELECT id, name FROM authors ORDER BY id').map(toAuthor);
  }

  async bookById(id: string) {
    const rowId = toRowId(id);
    if (rowId === null) return undefined;
    const row = this.get<BookRow>(`SELECT ${BOOK_COLUMNS} FROM books WHERE id = ?`, [rowId]);
    return row && toBook(row);
  }

  async authorById(id: string) {
    const rowId = toRowId(id);
    if (rowId === null) return undefined;
    const row = this.get<AuthorRow>('SELECT id, name FROM authors WHERE id = ?', [rowId]);
    return row && toAuthor(row);
  }

  async booksByAuthorId(authorId: string) {
    const rowId = toRowId(authorId);
    if (rowId === null) return [];
    return this.all<BookRow>(
      `SELECT ${BOOK_COLUMNS} FROM books WHERE author_id = ? ORDER BY id`,
      [rowId],
    ).map(toBook);
  }

  // Versiones por LOTE (las usan los DataLoaders): una sola consulta con IN (?, ?, ...).
  // No garantizan el orden ni devuelven huecos para ids inexistentes; el DataLoader reordena.
  async authorsByIds(ids: readonly string[]) {
    const rowIds = ids.map(toRowId).filter((i): i is number => i !== null);
    if (rowIds.length === 0) return [];
    return this.all<AuthorRow>(
      `SELECT id, name FROM authors WHERE id IN (${placeholders(rowIds.length)})`,
      rowIds,
    ).map(toAuthor);
  }

  async booksByAuthorIds(authorIds: readonly string[]) {
    const rowIds = authorIds.map(toRowId).filter((i): i is number => i !== null);
    if (rowIds.length === 0) return [];
    return this.all<BookRow>(
      `SELECT ${BOOK_COLUMNS} FROM books WHERE author_id IN (${placeholders(rowIds.length)}) ORDER BY id`,
      rowIds,
    ).map(toBook);
  }

  // ---- Escrituras ----
  // `RETURNING` devuelve la fila resultante en la misma sentencia (sin un SELECT aparte).

  async insertAuthor(name: string) {
    const row = this.get<AuthorRow>('INSERT INTO authors (name) VALUES (?) RETURNING id, name', [name]);
    return toAuthor(row!);
  }

  async insertBook(input: { title: string; year: number; authorId: string }) {
    const row = this.get<BookRow>(
      `INSERT INTO books (title, year, author_id) VALUES (?, ?, ?) RETURNING ${BOOK_COLUMNS}`,
      [input.title, input.year, toRowId(input.authorId)],
    );
    return toBook(row!);
  }

  // Actualización PARCIAL en una sola sentencia: COALESCE(?, columna) conserva el valor actual
  // cuando el cliente no envía el campo (o lo envía null). Devuelve undefined si el libro no existe.
  async updateBook(
    id: string,
    input: { title?: string | null; year?: number | null; authorId?: string | null },
  ) {
    const rowId = toRowId(id);
    if (rowId === null) return undefined;
    const row = this.get<BookRow>(
      `UPDATE books SET title = COALESCE(?, title), year = COALESCE(?, year), author_id = COALESCE(?, author_id)
       WHERE id = ? RETURNING ${BOOK_COLUMNS}`.replace(/\s+/g, ' '),
      [
        input.title ?? null,
        input.year ?? null,
        input.authorId != null ? toRowId(input.authorId) : null,
        rowId,
      ],
    );
    return row && toBook(row);
  }

  async deleteBook(id: string) {
    const rowId = toRowId(id);
    if (rowId === null) return false;
    return Number(this.run('DELETE FROM books WHERE id = ?', [rowId]).changes) > 0;
  }
}
