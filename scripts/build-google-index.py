"""Generate the native Google RPC fallback from the same public frontend."""
from pathlib import Path
root = Path(__file__).resolve().parent.parent
html = (root / 'index.html').read_text()
# Base must precede every relative script/style URL, not just the inline app.
html = html.replace('<head>', '<head><base href="https://j1mwyyzz430.github.io/star-team/" target="_top">', 1)
html = html.replace('<base target="_top">', '')
(root / 'google-backend' / 'Index.html').write_text(html)
