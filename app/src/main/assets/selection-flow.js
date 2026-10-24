/* FirstHyundai · selection color handoff
 * Independent cosmetic effect. No navigation or filter state is changed here.
 * The chosen button always keeps the existing color defined by ui-v2.css.
 */
(function () {
  'use strict';
  if (!document || !document.addEventListener || !window.getComputedStyle) return;

  const DURATION = 490;
  const EASING = 'cubic-bezier(.22,1,.36,1)';
  const definitions = [
    ['main', '#nav .primaryNav'],
    ['shortcuts', '#nav .utilityNav'],
    ['property', '.page:not(.hidden) .propertyTypeSwitch'],
    ['apartment-modes', '.page:not(.hidden) .tradeStarter.apartmentTradeNav'],
    ['office-modes', '.page:not(.hidden) .tradeStarter:not(.apartmentTradeNav)'],
    ['trade-types', '.page:not(.hidden) .tradeTypeBar'],
    ['new-types', '.page:not(.hidden) .newTypeChips'],
    ['news-tabs', '.page:not(.hidden) .newsCategoryTabs']
  ];
  const selector = definitions.map((d) => d[1]).join(',');
  let activeGhost = null;
  let activeAnimations = [];

  function reduceMotion() {
    return !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  }
  function directButtons(group) {
    return group ? Array.from(group.children).filter((el) => el.tagName === 'BUTTON') : [];
  }
  function isChosen(button) {
    return !!button && (
      button.classList.contains('active') ||
      button.classList.contains('selected') ||
      button.getAttribute('aria-current') === 'page' ||
      button.getAttribute('aria-pressed') === 'true' ||
      button.getAttribute('aria-selected') === 'true'
    );
  }
  function shape(button) {
    const box = button.getBoundingClientRect();
    const style = window.getComputedStyle(button);
    return {
      x: box.left, y: box.top, w: box.width, h: box.height,
      radius: style.borderRadius,
      paint: style.backgroundImage && style.backgroundImage !== 'none'
        ? style.backgroundImage : style.backgroundColor
    };
  }
  function isInViewport(rect) {
    return rect.w > 0 && rect.h > 0 && rect.y + rect.h > 0 &&
      rect.y < window.innerHeight && rect.x + rect.w > 0 && rect.x < window.innerWidth;
  }
  function clearEffect() {
    activeAnimations.forEach((a) => { try { a.cancel(); } catch (_) {} });
    activeAnimations = [];
    activeGhost?.remove();
    activeGhost = null;
  }
  function showFlow(before, after, target) {
    if (typeof target.animate !== 'function' || !isInViewport(before) || !isInViewport(after)) return;
    const dx = (after.x + after.w / 2) - (before.x + before.w / 2);
    const dy = (after.y + after.h / 2) - (before.y + before.h / 2);
    if (Math.abs(dx) > window.innerWidth * 1.1 ||
        Math.abs(dy) > window.innerHeight * 0.55) return;
    clearEffect();

    // A translucent 'pigment' moves; existing selected backgrounds stay intact.
    const ghost = document.createElement('div');
    ghost.className = 'fhd-selection-flow';
    ghost.setAttribute('aria-hidden', 'true');
    Object.assign(ghost.style, {
      left: before.x + 'px', top: before.y + 'px',
      width: before.w + 'px', height: before.h + 'px',
      borderRadius: before.radius
    });
    const outgoing = document.createElement('span');
    const incoming = document.createElement('span');
    outgoing.className = 'fhd-selection-pigment fhd-selection-out';
    incoming.className = 'fhd-selection-pigment fhd-selection-in';
    outgoing.style.background = before.paint;
    incoming.style.background = after.paint;
    ghost.append(outgoing, incoming);
    document.body.appendChild(ghost);
    activeGhost = ghost;

    const move = ghost.animate([
      {transform: 'translate3d(0,0,0) scale(1)', opacity: .72, offset: 0},
      {transform: 'translate3d(' + (dx * .5) + 'px,' + (dy * .5) +
        'px,0) scale(.76,.88)', opacity: .61, offset: .53},
      {transform: 'translate3d(' + dx + 'px,' + dy + 'px,0) scale(' +
        (after.w / before.w) + ',' + (after.h / before.h) + ')',
       opacity: 0, offset: 1}
    ], {duration: DURATION, easing: EASING, fill: 'forwards'});

    const morph = incoming.animate(
      [{opacity:0}, {opacity:.2,offset:.3}, {opacity:1}],
      {duration:DURATION, easing:'ease-in-out',fill:'forwards'}
    );
    // The destination's actual color settles in without changing its palette.
    const settle = target.animate(
      [{filter:'saturate(.62) brightness(1.10)',opacity:.83},
       {filter:'saturate(1) brightness(1)',opacity:1}],
      {duration:DURATION, easing:EASING}
    );
    activeAnimations = [move, morph, settle];
    const finish = () => {
      if (activeGhost !== ghost) return;
      ghost.remove();
      activeGhost = null;
      activeAnimations = [];
    };
    move.addEventListener('finish', finish, {once:true});
    move.addEventListener('cancel', finish, {once:true});
  }

  function click(event) {
    if (reduceMotion() || event.defaultPrevented) return;
    const button = event.target?.closest?.('button');
    if (!button || button.disabled || button.closest('.hidden')) return;
    const group = button.closest(selector);
    if (!group || button.parentElement !== group) return;
    const config = definitions.find((d) => group.matches(d[1]));
    if (!config) return;
    const children = directButtons(group);
    const nextIndex = children.indexOf(button);
    const selected = children.find((b) => isChosen(b));
    if (nextIndex < 0 || !selected || selected === button) return;
    const before = shape(selected);
    if (!isInViewport(before)) return;
    // Inline onclick handlers synchronously update selected state, sometimes
    // rebuilding #nav or replacing the visible apartment/officetel section.
    // A microtask reads that NEW state after handlers without a painted frame.
    Promise.resolve().then(() => {
      const destinationGroup = document.querySelector(config[1]);
      const destination = directButtons(destinationGroup)[nextIndex];
      if (!destination || !isChosen(destination) || destination.disabled) return;
      const after = shape(destination);
      showFlow(before, after, destination);
    });
  }

  const css = document.createElement('style');
  css.textContent = [
    '.fhd-selection-flow{position:fixed;z-index:1001;overflow:hidden;',
    'pointer-events:none;contain:paint;isolation:isolate;',
    'box-shadow:0 9px 26px rgba(20,57,65,.10);',
    'will-change:transform,opacity;}',
    '.fhd-selection-pigment{position:absolute;inset:0;border-radius:inherit;',
    'background-size:cover;pointer-events:none;}',
    '.fhd-selection-out{opacity:1;}',
    '.fhd-selection-in{opacity:0;}',
    '@media(prefers-reduced-motion:reduce){.fhd-selection-flow{display:none!important;}}'
  ].join('');
  document.head.appendChild(css);
  document.addEventListener('click', click, {capture:true});
  window.FirstHyundaiSelectionFlow = {
    version:'1.0.0',
    _test: {reduceMotion, directButtons, isChosen, clearEffect}
  };
})();