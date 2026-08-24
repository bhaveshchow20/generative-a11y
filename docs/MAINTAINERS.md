# Maintainer setup

Repository files configure the automated checks. Maintainers should verify that
the following repository settings remain enabled.

## Protect `main`

Keep a branch ruleset for `main` that:

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

Keep private vulnerability reporting enabled under **Settings → Security → Code
security**. Dependabot version updates are configured in the repository; keep
Dependabot alerts and security updates enabled in repository settings.

## npm publishing

The workspace root stays private; the six leaf packages are public and use the
`@generative-a11y` scope.

The initial package names and trusted-publishing configuration are in place.
Verify these settings whenever the package matrix or release workflow changes:

1. The npm organization contains all six public package names.
2. Every package trusts `.github/workflows/publish.yml` in the `npm-production`
   environment.
3. `npm-production` requires reviewer approval.

For the first functional release:

1. Run the `Release dry run` workflow and inspect every package artifact.
2. Merge the generated release pull request and dispatch `Publish packages` from
   `main`.
3. Continue the manual assistive-technology matrix after publication and only
   claim support for combinations backed by dated results.

The publish job requires a clean checkout, runs the full automated checks and
browser suite, and publishes through a short-lived OIDC identity. Do not add a
long-lived npm token. Manual assistive-technology evidence informs support
claims but does not block package publication.
