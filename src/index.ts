import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { typeDefs, resolvers } from './schema.js';
import { createContext, type Context } from './context.js';
import { formatError } from './errors.js';
import { dbQueryCounterPlugin } from './plugins.js';

// Servidor: une schema + resolvers y lo expone por HTTP en un único endpoint.
// ApolloServer<Context> hace que el contexto esté tipado en los resolvers y plugins.
const server = new ApolloServer<Context>({
  typeDefs,
  resolvers,
  formatError,
  plugins: [dbQueryCounterPlugin],
  // Por defecto Apollo incluye el stacktrace (con rutas de tu máquina) en los errores.
  // Aquí solo se activa si lo pides: INCLUDE_STACKTRACE=true npm run dev
  includeStacktraceInErrorResponses: process.env.INCLUDE_STACKTRACE === 'true',
});

const { url } = await startStandaloneServer(server, {
  // Se ejecuta en cada petición y su resultado es el `context` de los resolvers.
  context: createContext,
  listen: { port: 4000 },
});

console.log(`🚀 Servidor listo en ${url}`);
