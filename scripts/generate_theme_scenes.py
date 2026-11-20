#!/usr/bin/env python3
"""Generate the header "scene" art (v2.2.2) — app/src/main/assets/theme-scene-*.svg.

A quiet, generic waterfront skyline (no real landmark copied) + one motif per theme,
drawn in light at low opacity and faded out toward the brand text on the left.
Every file shares the same 360x64 viewBox and building list so overlays line up:
  default/spring/summer/autumn/winter  seasonal scenes
  newyear (Jan 1-3) / christmas (Dec 24-25)  occasion scenes (replace the season scene)
  night  lit-window overlay used after 20:00 KST
CSS places them identically: right 2px bottom 0 / auto 58px.
Motifs live in the clear gap between the subtitle and the 알림함 button (x≈214–272).
Run: python3 scripts/generate_theme_scenes.py [output_dir]
"""
import math, pathlib, sys

OUT = pathlib.Path(__file__).resolve().parent.parent / 'app/src/main/assets'
W, H, BASE = 360, 64, 56
BLDS = [(150,10,12),(162,8,20),(172,12,16),(186,9,24),(197,14,30),(213,10,22),(225,13,38),(240,9,27),
        (251,12,44),(265,10,30),(277,16,20),(295,9,33),(306,13,39),(321,10,26),(333,12,34),(347,13,22)]
TOWER = '<path d="M281 56 L283.5 9 L286.5 9 L289 56 Z"/><rect x="284.6" y="2" width=".9" height="8"/>'
SKY_ALPHA = .085

def skyline():
    return ''.join(f'<rect x="{x}" y="{BASE-h}" width="{w}" height="{h}" rx="1.2"/>' for x, w, h in BLDS) + TOWER

def caps():
    return ''.join(f'<rect x="{x+.5}" y="{BASE-h-1.4}" width="{w-1}" height="2.2" rx="1.1"/>' for x, w, h in BLDS) + \
        '<path d="M282.6 13.5 L287.4 13.5 L286.9 10 L283.1 10 Z"/>'

WAVES = ('<path d="M140 59.5 C170 57.5 196 61.5 226 59.5 S286 57.5 316 59.5 S352 61 360 59.5" stroke-width="1.1"/>'
         '<path d="M168 62.6 C198 61 224 64 254 62.6 S314 61 344 62.6" stroke-width=".9"/>')

def frame(body):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" '
            'preserveAspectRatio="xMaxYMax meet" aria-hidden="true">\n'
            '<defs><linearGradient id="fade" gradientUnits="userSpaceOnUse" x1="176" y1="0" x2="262" y2="0">'
            '<stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity="1"/>'
            f'</linearGradient><mask id="m"><rect width="{W}" height="{H}" fill="url(#fade)"/></mask></defs>\n'
            f'<g mask="url(#m)">{body}</g></svg>\n')

def scene(motif, snow=False, wave_alpha=.22):
    body = f'<g fill="#FFFFFF" fill-opacity="{SKY_ALPHA}">{skyline()}</g>'
    if snow:
        body += f'<g fill="#FFFFFF" fill-opacity=".26">{caps()}</g>'
    body += f'<g fill="none" stroke="#FFFFFF" stroke-opacity="{wave_alpha}" stroke-linecap="round">{WAVES}</g>'
    return frame(body + f'<g transform="translate(8 0)">{motif}</g>')

def star4(cx, cy, s, fill, op):
    q = s * .18
    return (f'<path d="M{cx} {cy-s} Q{cx+q} {cy-q} {cx+s} {cy} Q{cx+q} {cy+q} {cx} {cy+s} '
            f'Q{cx-q} {cy+q} {cx-s} {cy} Q{cx-q} {cy-q} {cx} {cy-s} Z" fill="{fill}" fill-opacity="{op}"/>')

def flower(cx, cy, r, fill, center, op):
    petals = ''.join(f'<circle cx="{cx+r*math.cos(a):.2f}" cy="{cy+r*math.sin(a):.2f}" r="{r*.78:.2f}"/>'
                     for a in [i*2*math.pi/5 - math.pi/2 for i in range(5)])
    return (f'<g fill="{fill}" fill-opacity="{op}">{petals}</g>'
            f'<circle cx="{cx}" cy="{cy}" r="{r*.42:.2f}" fill="{center}" fill-opacity="{min(1, op+.1)}"/>')

def ginkgo(x, y, s, rot, fill='#F6C866', op=.88):
    return (f'<g transform="translate({x} {y}) rotate({rot}) scale({s})"><path d="M0 0 C -5.5 -1.6 -7.2 -7.6 -4.4 -11 '
            'C -2.6 -9.6 -1.2 -9.8 0 -11.6 C 1.2 -9.8 2.6 -9.6 4.4 -11 C 7.2 -7.6 5.5 -1.6 0 0 Z" '
            f'fill="{fill}" fill-opacity="{op}"/><path d="M0 0 L0 4.2" stroke="{fill}" stroke-opacity="{op}" '
            'stroke-width=".9" stroke-linecap="round"/></g>')

def flake(cx, cy, r, op):
    angles = [i*math.pi/3 for i in range(6)]
    arms = ''.join(f'<path d="M{cx} {cy} L{cx+r*math.cos(a):.2f} {cy+r*math.sin(a):.2f}"/>' for a in angles)
    def tick(a, k):
        mx, my = cx + r*.55*math.cos(a), cy + r*.55*math.sin(a)
        return mx + r*.22*math.cos(a+k), my + r*.22*math.sin(a+k)
    ticks = ''.join(
        f'<path d="M{tick(a,1)[0]:.2f} {tick(a,1)[1]:.2f} L{cx+r*.55*math.cos(a):.2f} {cy+r*.55*math.sin(a):.2f} '
        f'L{tick(a,-1)[0]:.2f} {tick(a,-1)[1]:.2f}"/>' for a in angles)
    return (f'<g fill="none" stroke="#FFFFFF" stroke-opacity="{op}" stroke-width=".9" '
            f'stroke-linecap="round">{arms}{ticks}</g>')

def dots(spec, fill):
    return ''.join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{fill}" fill-opacity="{o}"/>' for x, y, r, o in spec)

GULLS = ('<g fill="none" stroke="#FFFFFF" stroke-opacity=".6" stroke-width="1.1" stroke-linecap="round">'
         '<path d="M211 21 q3 -3 6 0 q3 -3 6 0"/><path d="M226 30 q2 -2 4 0 q2 -2 4 0"/></g>')

MOTIFS = {
    'default': star4(236,13,4.2,'#F1D49A',.85) + star4(262,26,2.6,'#F1D49A',.7) +
               dots([(214,22,.9,.6),(250,6,.8,.55),(275,14,.7,.5),(204,9,.7,.45)], '#F1D49A'),
    'spring': '<path d="M300 -2 C 278 6 258 8 236 14 C 224 17 214 22 206 29" fill="none" stroke="#FFE4EE" '
              'stroke-opacity=".55" stroke-width="1.7" stroke-linecap="round"/><path d="M252 9 C 248 3 246 1 241 -1 '
              'M228 16 C 226 24 228 28 232 31" fill="none" stroke="#FFE4EE" stroke-opacity=".45" stroke-width="1.1" '
              'stroke-linecap="round"/>' +
              flower(272,6,3.1,'#FFD6E5','#F49DBE',.9) + flower(248,11,2.7,'#FFE1EC','#F49DBE',.85) +
              flower(231,17,3.0,'#FFD0E1','#EF8FB4',.9) + flower(212,26,2.4,'#FFE1EC','#F49DBE',.8) +
              flower(232,31,2.1,'#FFE8F0','#F49DBE',.75) +
              ''.join(f'<ellipse cx="{x}" cy="{y}" rx="1.6" ry="1" transform="rotate({a} {x} {y})" fill="#FFD6E5" '
                      'fill-opacity=".8"/>' for x, y, a in [(222,40,30),(262,30,-20),(198,44,50)]),
    'summer': '<circle cx="250" cy="13" r="6.6" fill="#FFF1BF" fill-opacity=".8"/><circle cx="250" cy="13" r="10.5" '
              'fill="#FFF1BF" fill-opacity=".14"/><g stroke="#FFF1BF" stroke-opacity=".6" stroke-width="1.2" '
              'stroke-linecap="round">' +
              ''.join(f'<path d="M{250+9.5*math.cos(a):.1f} {13+9.5*math.sin(a):.1f} L{250+12.5*math.cos(a):.1f} '
                      f'{13+12.5*math.sin(a):.1f}"/>' for a in [i*math.pi/4 for i in range(8)]) +
              '</g>' + GULLS + '<g fill="none" stroke="#BFF3F4" stroke-opacity=".4" stroke-linecap="round">'
              '<path d="M150 57.8 C176 55.6 200 59.8 228 57.8 S282 55.6 312 57.8" stroke-width="1"/></g>',
    'autumn': ginkgo(236,16,1.15,-18) + ginkgo(262,30,.95,24,'#F2B45A') + ginkgo(214,30,.85,40,'#F8D27A') +
              ginkgo(250,6,.75,-40,'#F2B45A',.8) + ginkgo(200,46,.7,70,'#F8D27A',.7) + ginkgo(274,12,.7,10,'#F6C866',.75),
    'winter': '<circle cx="252" cy="12" r="6" fill="#F4F7FF" fill-opacity=".55"/>' +
              flake(230,20,4.6,.75) + flake(270,30,3.4,.6) + flake(210,10,3,.55) + flake(244,36,2.6,.5) +
              dots([(220,32,.9,.6),(262,18,.8,.55),(200,26,.7,.5),(276,6,.8,.5)], '#FFFFFF'),
    # 1월 1–3일: the first sunrise over the bay.
    'newyear': '<ellipse cx="236" cy="56" rx="34" ry="12" fill="#FFC27A" fill-opacity=".16"/>'
               '<path d="M220 56 A16 16 0 0 1 252 56 Z" fill="#FFCB7D" fill-opacity=".85"/>'
               '<g stroke="#FFD99A" stroke-opacity=".6" stroke-width="1.2" stroke-linecap="round">' +
               ''.join(f'<path d="M{236+20*math.cos(a):.1f} {56-20*math.sin(a):.1f} L{236+27*math.cos(a):.1f} '
                       f'{56-27*math.sin(a):.1f}"/>' for a in [math.radians(d) for d in (20,45,70,90,110,135,160)]) +
               '</g>' + GULLS + '<path d="M214 58.4 L258 58.4" stroke="#FFD99A" stroke-opacity=".55" stroke-width="1.2" '
               'stroke-linecap="round"/>',
    # 12월 24–25일: a small lit tree in the clear gap.
    'christmas': '<g fill="#FFFFFF" fill-opacity=".2"><path d="M240 13 L229 29 L251 29 Z"/><path d="M240 20 L226 38 '
                 'L254 38 Z"/><path d="M240 28 L223 47 L257 47 Z"/></g><rect x="238.4" y="47" width="3.2" height="5" '
                 'fill="#FFFFFF" fill-opacity=".2"/>' + star4(240,11,4,'#FFD27F',.95) +
                 ''.join(f'<circle cx="{x}" cy="{y}" r="1" fill="{c}" fill-opacity=".9"/>' for x, y, c in
                         [(234,27,'#FFD27F'),(246,25,'#FF9C8F'),(231,36,'#9EE6B5'),(244,34,'#FFD27F'),
                          (250,43,'#FF9C8F'),(236,44,'#9EE6B5'),(228,45,'#FFD27F')]) +
                 dots([(212,20,.8,.6),(262,16,.8,.55),(268,36,.7,.5),(216,40,.7,.5)], '#FFFFFF'),
}

def night():
    lights = []
    for i, (x, w, h) in enumerate(BLDS):
        cols = [x + 2.2] if w < 10 else [x + 2.2, x + w - 3.8]
        for r, y in enumerate(range(BASE - h + 4, BASE - 3, 5)):
            for c, cx in enumerate(cols):
                if (i*7 + r*3 + c*5) % 4 == 0:
                    lights.append(f'<rect x="{cx:.1f}" y="{y}" width="1.6" height="1.3" rx=".4"/>')
    lights.append('<rect x="284.2" y="16" width="1.6" height="1.3" rx=".4"/><rect x="284.2" y="30" width="1.6" height="1.3" rx=".4"/>')
    return frame(f'<g fill="#FFD999" fill-opacity=".72">{"".join(lights)}</g>'
                 '<circle cx="285" cy="2.4" r="1.1" fill="#FF8C7A" fill-opacity=".9"/>')

FILES = {k: scene(v, snow=(k in ('winter', 'christmas')), wave_alpha=.32 if k == 'summer' else .2 if k == 'default' else .22)
         for k, v in MOTIFS.items()}
FILES['night'] = night()

if __name__ == '__main__':
    out = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else OUT
    for name, svg in FILES.items():
        (out / f'theme-scene-{name}.svg').write_text(svg)
        print(name, len(svg))
