# README Branding Design

## Goal

Give the repository a consistent monochrome identity based on the documentation
site's existing favicon and social banner while preserving the README's current
information architecture.

## Canonical logo

The current website favicon is the canonical project mark. Add a reusable copy
under `.github/assets` for repository branding. Keep its existing black rounded
square, white corner-frame strokes, and grey center dot unchanged.

## Banner

Recreate the existing website banner rather than introducing a new composition.
Preserve its bordered technical-diagram layout, large `generative-a11y`
wordmark, tagline, construction grid, and branching announcement diagram.
Replace the cream, green, and lime palette with black, grey, and white, and add
the canonical logo without weakening the wordmark or diagram hierarchy.

Create light and dark SVG variants under `.github/assets`. The README will use a
`picture` element that selects the appropriate variant from the viewer's GitHub
color scheme. Both variants must remain legible when rendered at the full README
width.

Also create a solid-background 1200 by 630 PNG from the same composition for the
repository's GitHub social preview. The checked-in file is the upload-ready
artifact; configuring the social preview in GitHub Settings remains a separate
manual repository-setting action if it cannot be changed through the available
repository tools.

## README badges

Add the corrected DeepWiki badge to the existing top-level badge row:

- Image: `https://deepwiki.com/badge.svg`
- Destination: `https://deepwiki.com/bhaveshchow20/generative-a11y`

In the Packages table, replace `Repository package` for
`@generative-a11y/devtools` with an npm version badge and npm package link that
match the other published-package rows.

Do not add a total-download badge. npm reports downloads per package, and the
project will not add an aggregation endpoint in this change.

## Verification

- Confirm the SVG assets are valid and contain accessible titles or README alt
  text as appropriate.
- Confirm every README image and destination URL is correct.
- Confirm the devtools npm badge uses the encoded scoped package name.
- Render or inspect the light banner, dark banner, and social-preview PNG.
- Run the repository's required `pnpm check` command before handoff.
