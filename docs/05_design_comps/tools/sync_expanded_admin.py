"""Inject the shared CSS and icon sprite into every expanded admin comp so each HTML stays self-contained
(only ../../tokens.css and Google Fonts are external). Run after editing tools/expanded_admin_shared.css or
tools/expanded_admin_sprite.svg.  Usage: python3 sync_expanded_admin.py"""
import pathlib, re
ROOT = pathlib.Path('/home/user/barber-booking/docs/05_design_comps')
css = (ROOT / 'tools/expanded_admin_shared.css').read_text().strip()
sprite = (ROOT / 'tools/expanded_admin_sprite.svg').read_text().strip()
for f in sorted((ROOT / 'expanded/admin').glob('*.html')):
    s = f.read_text()
    s2 = re.sub(r'/\* @shared:start \*/.*?/\* @shared:end \*/', lambda m: '/* @shared:start */\n' + css + '\n/* @shared:end */', s, flags=re.S)
    s2 = re.sub(r'<!-- @sprite:start -->.*?<!-- @sprite:end -->', lambda m: '<!-- @sprite:start -->\n' + sprite + '\n<!-- @sprite:end -->', s2, flags=re.S)
    if s2 != s: f.write_text(s2)
    print(f.name, 'ok' if '@shared:start' in s2 and '@sprite:start' in s2 else 'MISSING MARKERS')
