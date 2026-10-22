import { typeDefs as authorTypeDefs } from './modules/authors/typeDefs.js';
import { resolvers as authorResolvers } from './modules/authors/resolvers.js';
import { typeDefs as bookTypeDefs } from './modules/books/typeDefs.js';
import { resolvers as bookResolvers } from './modules/books/resolvers.js';

// Punto único donde se ensambla el schema. Para añadir un módulo nuevo (p. ej. "genres"):
// crea modules/genres/{typeDefs,resolvers}.ts y agrégalo a estos dos arreglos.
// Apollo Server fusiona los arreglos: los `extend type Query/Mutation` de cada módulo se
// suman en una única Query y una única Mutation, y los resolvers del mismo tipo se combinan.
export const typeDefs = [authorTypeDefs, bookTypeDefs];
export const resolvers = [authorResolvers, bookResolvers];
