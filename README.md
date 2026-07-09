# DSP Calculator

A client-only Dyson Sphere Program production planner built with React, Vite, and TypeScript.

## Features

- Multiple production goals with per-minute rates
- Searchable item and building picker
- Recipe tree, summary table, machine counts, belt demand, and power estimates
- Proliferator, belt tier, machine tier, and alternate recipe settings
- Local autosave plus JSON import/export
- GitHub Pages deployment from `main`

## Development

```bash
npm install
npm run dev
```

## Verification

```bash
npm run lint
npm test
npm run build
npm run preview
npm run e2e
```

## Deployment

The app is configured for GitHub Pages at:

```text
https://stevengglandry.github.io/dsp-calculator/
```

The current repository is published from the `gh-pages` branch because the local GitHub token does not have the `workflow` scope required to push GitHub Actions workflow files. The branch contains the built `dist` output.

To redeploy manually:

```bash
npm run lint
npm test
npm run build
# copy dist contents to the gh-pages branch and push it
```

If the GitHub token is refreshed with `workflow` scope later, this can be switched to an Actions-based Pages workflow.

## Data Attribution

Dyson Sphere Program recipe data and the icon atlas are local snapshots from FactorioLab:

- Source: https://github.com/factoriolab/factoriolab/tree/main/public/data/dsp
- License: MIT, included at `public/data/dsp/FACTORIOLAB-LICENSE.txt`

This is an unofficial fan project and is not affiliated with Youthcat Studio or Gamera Games.
