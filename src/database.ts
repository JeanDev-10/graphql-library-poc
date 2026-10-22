import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { authors, books } from './data.js';

// SQLite integrado en Node (`node:sqlite`): sin dependencias ni compilación nativa.
// La BD es un archivo (por defecto data/library.db). Para otra ubicación: DB_PATH=ruta.db
// (`:memory:` crea una BD temporal que desaparece al cerrar el proceso).
const dbPath = process.env.DB_PATH ?? 'data/library.db';
if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });

// Una sola conexión para todo el proceso: SQLite es un archivo local y DatabaseSync es síncrono.
// (Distinto a los DataLoaders y al Repository, que sí se crean por petición.)
export const database = new DatabaseSync(dbPath);

// SQLite trae las claves foráneas APAGADAS por defecto en cada conexión: hay que activarlas.
// Con esto la BD misma impide un libro con un author_id que no existe.
database.exec('PRAGMA foreign_keys = ON');

database.exec(`
  CREATE TABLE IF NOT EXISTS authors (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS books (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    title     TEXT    NOT NULL,
    year      INTEGER NOT NULL,
    author_id INTEGER NOT NULL REFERENCES authors(id)
  );

  -- Sin índice, buscar los libros de un autor recorre toda la tabla; DataLoader consulta por author_id.
  CREATE INDEX IF NOT EXISTS idx_books_author_id ON books(author_id);
`);

// Semilla: solo si la BD está vacía (primer arranque o tras `npm run db:reset`).
// Se insertan los ids explícitos (1-3 y 1-4) para que los ejemplos de la documentación sigan valiendo;
// AUTOINCREMENT continúa desde el id más alto.
const { n } = database.prepare('SELECT COUNT(*) AS n FROM authors').get() as { n: number };
if (n === 0) {
  database.exec('BEGIN');
  try {
    const insertAuthor = database.prepare('INSERT INTO authors (id, name) VALUES (?, ?)');
    for (const a of authors) insertAuthor.run(Number(a.id), a.name);

    const insertBook = database.prepare(
      'INSERT INTO books (id, title, year, author_id) VALUES (?, ?, ?, ?)',
    );
    for (const b of books) insertBook.run(Number(b.id), b.title, b.year, Number(b.authorId));

    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK'); // todo o nada: no queda una semilla a medias
    throw error;
  }
}
