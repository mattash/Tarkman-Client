"""Check opaque proposal color pairs. Does not validate rendered UI or native assets."""
import json
from pathlib import Path

BASE = Path(__file__).resolve().parent
tokens = json.loads((BASE / 'foundations.tokens.json').read_text())


def luminance(value):
    channels = [int(value[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    linear = [v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in channels]
    return sum(v * weight for v, weight in zip(linear, (0.2126, 0.7152, 0.0722)))


pairs = [(fg, bg, 4.5) for bg in ('canvas', 'surface', 'raised', 'overlay') for fg in ('text', 'muted')]
pairs += [('onPrimary', bg, 4.5) for bg in ('primary', 'hover', 'pressed')]
pairs += [('onSelection', 'selection', 4.5), ('onDisabled', 'disabled', 4.5)]
pairs += [(role, role + 'Surface', 4.5) for role in ('success', 'warning', 'danger', 'info')]
pairs += [('control', bg, 3) for bg in ('canvas', 'surface', 'raised', 'overlay')]
pairs += [('focus', bg, 3) for bg in ('canvas', 'surface', 'raised', 'overlay')]
rows = []
for theme, colors in tokens['themes'].items():
    for foreground, background, minimum in pairs:
        light, dark = sorted((luminance(colors[foreground]), luminance(colors[background])), reverse=True)
        ratio = (light + 0.05) / (dark + 0.05)
        rows.append({'theme': theme, 'foreground': foreground, 'background': background,
                     'ratio': round(ratio, 3), 'minimum': minimum, 'passes': ratio >= minimum})
report = {'scope': 'Opaque token pairs only; divider intentionally excluded. Disabled contrast is a product target, not a WCAG requirement.',
          'pairs': rows, 'passed': sum(row['passes'] for row in rows), 'total': len(rows)}
(BASE / 'foundation-contrast.json').write_text(json.dumps(report, indent=2) + '\n')
print(f"{report['passed']}/{report['total']} proposed color pairs meet their target.")
for row in rows:
    if not row['passes']:
        print(row)
raise SystemExit(0 if all(row['passes'] for row in rows) else 1)
