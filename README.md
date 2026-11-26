# BlackbirdWorks Portfolio

Static portfolio website for the **BlackbirdWorks** GitHub organization, published to [blackbirdworks.dev](https://blackbirdworks.dev/).

## Structure

- `site/` — Static HTML, CSS, JavaScript, SVG favicon, `CNAME`, and `.nojekyll` published directly to GitHub Pages.
- `.github/workflows/deploy.yml` — GitHub Actions workflow that uploads `site/` and deploys it to GitHub Pages on pushes to `main`.

## Local Preview

```bash
python3 -m http.server -d site 4173
```

Then open <http://127.0.0.1:4173/>.
