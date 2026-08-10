# Contributing

Thank you for helping make generative AI experiences more accessible.

## Ways to contribute

Contributions are not limited to runtime code. Especially useful work includes:

- testing real interactions with screen readers and other assistive technology;
- reducing a framework lifecycle into a documented, reproducible event trace;
- improving examples, API documentation, or accessibility guidance;
- reporting missing or ambiguous public lifecycle evidence in an AI framework;
- implementing focused core behavior with deterministic tests.

Use the dedicated
[assistive-technology report](https://github.com/bhaveshchow20/generative-a11y/issues/new?template=assistive_technology_report.yml)
for manual findings, including positive results.

## Before opening a pull request

1. Open or find an issue for substantial changes so the problem and proposed API
   can be discussed first.
2. Fork the repository and create a focused branch.
3. Install Node.js using `.nvmrc`, enable Corepack, then run
   `pnpm install --frozen-lockfile`.
4. Make the change with tests and documentation where appropriate.
5. Run `pnpm changeset` for a user-visible package change.
6. Run `pnpm check` before opening the pull request.

Adapters must rely on documented public framework state. If exact lifecycle
evidence is unavailable, document the reduced fidelity rather than inferring the
event or depending on a private API.

## Accessibility expectations

Changes should describe the user need they address and how behavior was tested.
When relevant, include keyboard-only and assistive-technology testing details.
Automated checks support review but do not replace manual accessibility testing.

## Pull requests

Keep pull requests focused and explain the reason for the change. CI must pass,
and maintainers may request API, test, or documentation updates before merging.

By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
