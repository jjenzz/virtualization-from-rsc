/**
 * Whether `fn` is a `'use server'` function. React's bundler integration tags every
 * server function with this symbol (`registerServerReference`), and it's the same
 * check React uses to decide whether a function can be sent to the client. Only
 * meaningful on the server: in the browser, server functions carry no public tag.
 */
export function isServerFunction<T>(fn: T): fn is Extract<T, (...args: never[]) => unknown> {
  return typeof fn === 'function' && (fn as { $$typeof?: symbol }).$$typeof === Symbol.for('react.server.reference');
}
