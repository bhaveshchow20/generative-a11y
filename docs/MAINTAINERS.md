# Maintainer setup

Repository files configure the automated checks. A maintainer must complete the
following one-time settings in GitHub after this pull request is merged.

## Protect `main`

Create a branch ruleset for `main` that:

- requires a pull request with at least one approval;
- dismisses stale approvals when new commits are pushed;
- requires conversation resolution;
- requires branches to be up to date;
- blocks force pushes and deletion;
- requires `Quality`, `Node 22`, `Node 24`, `Dependency review`,
  `Analyze JavaScript and TypeScript`, and `Conventional title` status checks.

Enable auto-merge and automatically delete head branches if desired.

## Security

Enable private vulnerability reporting under **Settings → Security → Code
security**. Dependabot version updates are configured in the repository;
Dependabot alerts and security updates should also be enabled in repository
settings.

## npm publishing

The package is deliberately marked `private` while its public API and final npm
name are undecided. Before the first release:

1. Confirm the npm package name or organization scope.
2. Update `name`, `repository`, and related package metadata.
3. Remove `private: true` from `package.json`.
4. Run the `Release dry run` workflow and inspect the package artifact.
5. Add a protected publishing workflow with `id-token: write`, then configure
   that exact workflow as the npm trusted publisher for the package.
6. Merge a user-visible change with a changeset and review the generated release
   pull request.

Do not add a long-lived npm token. Trusted publishing should use a short-lived
OIDC identity after the package and workflow relationship is configured.
