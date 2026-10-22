import type { ApolloServerPlugin } from '@apollo/server';
import type { Context } from './context.js';

// Plugin de la PoC: al terminar cada petición muestra cuántas "consultas a la BD" provocó.
// - En la consola del servidor: la lista completa.
// - En la respuesta (extensions.dbQueries): solo el número, para verlo en Insomnia/Sandbox.
// En producción no se expondría esto al cliente.
export const dbQueryCounterPlugin: ApolloServerPlugin<Context> = {
  async requestDidStart() {
    return {
      async willSendResponse({ contextValue, response }) {
        const { queries } = contextValue.repo;
        if (queries.length > 0) {
          console.log(`📊 ${queries.length} consulta(s) a la BD:\n  ${queries.join('\n  ')}`);
        }
        if (response.body.kind === 'single') {
          response.body.singleResult.extensions = {
            ...response.body.singleResult.extensions,
            dbQueries: queries.length,
          };
        }
      },
    };
  },
};
