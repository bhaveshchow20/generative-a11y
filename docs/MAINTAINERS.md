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
- requires `Quality`, `Node 22`, `Node 24`, `Browser accessibility`,
  `Dependency review`, `Analyze JavaScript and TypeScript`, and
  `Conventional title` status checks.

Enable auto-merge and automatically delete head branches if desired.

## Security

Enable private vulnerability reporting under **Settings → Security → Code
security**. Dependabot version updates are configured in the repository;
Dependabot alerts and security updates should also be enabled in repository
settings.

## npm publishing

The workspace root stays private; the six leaf packages are public and use the
`@generative-a11y` scope. Before the first release:

1. Create the npm organization and reserve all six package names.
2. Configure `.github/workflows/publish.yml` and the `npm-production`
   environment as the trusted publisher for every package.
3. Protect `npm-production` with required reviewer approval.
4. Run the `Release dry run` workflow and inspect every package artifact.
5. Merge the generated release pull request, then execute the manual matrix
   against that exact release-candidate commit.
6. Commit the resulting `docs/assistive-technology-results.json` without
   changing any other file, merge it, and dispatch `Publish packages` from
   `main`.

The publish job rejects missing, incomplete, older-than-30-days, or stale-source
assistive-technology evidence before it tests or publishes. Do not add a
long-lived npm token; publishing uses a short-lived OIDC identity.
