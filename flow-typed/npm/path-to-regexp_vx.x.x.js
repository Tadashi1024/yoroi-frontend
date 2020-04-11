// @flow
// flow-typed signature: cdae9c018fcdcdbb1d4d7c15c36911f8
// flow-typed version: <<STUB>>/path-to-regexp_v6.1.0/flow_v0.122.0

/**
 * This is an autogenerated libdef stub for:
 *
 *   'path-to-regexp'
 *
 * Fill this stub out by replacing all the `any` types.
 *
 * Once filled out, we encourage you to share your work with the
 * community by sending a pull request to:
 * https://github.com/flowtype/flow-typed
 */

declare module 'path-to-regexp' {
  declare type Path = string | RegExp | Array<string | RegExp>;
  declare function pathToRegexp(
    path: Path,
    keys?: Key[],
    options?: TokensToRegexpOptions & ParseOptions
  ): RegExp
}
