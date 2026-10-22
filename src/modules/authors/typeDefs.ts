// Schema del módulo Authors. Cada módulo declara sus propios tipos y aporta campos a las
// raíces Query/Mutation; al arrancar, GraphQL junta todos los módulos en un solo schema.
// `Book` se declara en el módulo Books: los tipos pueden referirse entre módulos.
//
// Regla de las raíces: EXACTAMENTE UN módulo declara `type Query` / `type Mutation` (este),
// y los demás los amplían con `extend type`. `extend` sin una declaración base falla al arrancar,
// y una raíz vacía tampoco es válida en GraphQL.
export const typeDefs = `#graphql
  """Una persona que escribe libros."""
  type Author {
    id: ID!
    name: String!
    "Libros escritos por este autor"
    books: [Book!]!
  }

  # "input" es el tipo de objeto para ENVIAR datos. Los "type" solo sirven para devolver.
  input AddAuthorInput {
    name: String!
  }

  type Query {
    "Todos los autores"
    authors: [Author!]!
    "Un autor por id. Devuelve null si no existe."
    author(id: ID!): Author
  }

  type Mutation {
    "Crea un autor"
    addAuthor(input: AddAuthorInput!): Author!
  }
`;
