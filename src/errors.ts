import { GraphQLError, type GraphQLFormattedError } from 'graphql';
import { ApolloServerErrorCode, unwrapResolverError } from '@apollo/server/errors';

// Errores "esperados": los lanzamos nosotros con un código estable en extensions.code,
// para que el cliente (p. ej. Angular) decida qué hacer según el código y no el texto.
export const badUserInput = (message: string, extensions: Record<string, unknown> = {}) =>
  new GraphQLError(message, { extensions: { code: 'BAD_USER_INPUT', ...extensions } });

export const forbidden = (message: string) =>
  new GraphQLError(message, {
    // extensions.http permite cambiar el status HTTP (por defecto GraphQL responde 200).
    extensions: { code: 'FORBIDDEN', http: { status: 403 } },
  });

// Se ejecuta con CADA error antes de enviarlo al cliente.
// Los errores inesperados (bugs, caída de BD...) NO deben filtrar detalles internos.
export function formatError(
  formattedError: GraphQLFormattedError,
  error: unknown,
): GraphQLFormattedError {
  if (formattedError.extensions?.code === ApolloServerErrorCode.INTERNAL_SERVER_ERROR) {
    // El detalle real se queda en el log del servidor...
    console.error('Error interno:', unwrapResolverError(error));
    // ...y el cliente solo recibe un mensaje genérico, sin stacktrace.
    return {
      message: 'Error interno del servidor',
      locations: formattedError.locations,
      path: formattedError.path,
      extensions: { code: ApolloServerErrorCode.INTERNAL_SERVER_ERROR },
    };
  }
  return formattedError;
}
