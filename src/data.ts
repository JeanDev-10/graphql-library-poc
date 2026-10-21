// "Base de datos" en memoria. Más adelante la mutamos desde las mutations.
// Ojo: estas interfaces describen los datos INTERNOS, no el schema de GraphQL.
// El schema puede exponer una forma distinta (p. ej. Book.author en vez de authorId).

export interface AuthorRecord {
  id: string;
  name: string;
}

export interface BookRecord {
  id: string;
  title: string;
  year: number;
  authorId: string;
}

export const authors: AuthorRecord[] = [
  { id: '1', name: 'Gabriel García Márquez' },
  { id: '2', name: 'Julio Cortázar' },
  { id: '3', name: 'Isabel Allende' },
];

export const books: BookRecord[] = [
  { id: '1', title: 'Cien años de soledad', year: 1967, authorId: '1' },
  { id: '2', title: 'El amor en los tiempos del cólera', year: 1985, authorId: '1' },
  { id: '3', title: 'Rayuela', year: 1963, authorId: '2' },
  { id: '4', title: 'La casa de los espíritus', year: 1982, authorId: '3' },
];
