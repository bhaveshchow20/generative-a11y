# generative-a11y

[![CI](https://github.com/bhaveshchow20/generative-a11y/actions/workflows/ci.yml/badge.svg)](https://github.com/bhaveshchow20/generative-a11y/actions/workflows/ci.yml)
[![CodeQL](https://github.com/bhaveshchow20/generative-a11y/actions/workflows/codeql.yml/badge.svg)](https://github.com/bhaveshchow20/generative-a11y/actions/workflows/codeql.yml)

Plug-and-play accessibility infrastructure for generative AI applications.

The project is in its initial development phase. Public APIs and framework
integrations will be introduced incrementally, with every change validated by
the same checks contributors run locally.

## Development

Use the Node.js version in `.nvmrc` and install dependencies from the lockfile:

```sh
npm ci
npm run check
```

`npm run check` verifies formatting, linting, types, tests, the production
build, and the published package shape.

See [CONTRIBUTING.md](CONTRIBUTING.md) before proposing a change. Security
issues should follow the private reporting process in
[SECURITY.md](SECURITY.md).
