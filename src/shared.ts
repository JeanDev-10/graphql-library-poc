// Piezas compartidas por varios módulos.

// Los argumentos que llegan al resolver (2º parámetro) tienen la forma del schema.
export interface IdArgs {
  id: string;
}

// Genera el siguiente id numérico como string (en una BD real lo haría la BD).
export const nextId = (items: { id: string }[]) =>
  String(Math.max(0, ...items.map((i) => Number(i.id))) + 1);
