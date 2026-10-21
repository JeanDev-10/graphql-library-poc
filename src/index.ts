import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';

// 1. Schema: el contrato. Describe QUÉ se puede pedir.
const typeDefs = `#graphql
  type Query {
    hello: String!
  }
`;

// 2. Resolvers: las funciones que dicen DE DÓNDE sale cada campo.
const resolvers = {
  Query: {
    hello: () => 'Hola GraphQL 👋',
  },
};

// 3. Servidor: une schema + resolvers y lo expone por HTTP.
const server = new ApolloServer({ typeDefs, resolvers });

const { url } = await startStandaloneServer(server, {
  listen: { port: 4000 },
});

console.log(`🚀 Servidor listo en ${url}`);
