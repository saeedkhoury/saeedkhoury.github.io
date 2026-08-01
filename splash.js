/* ─────────────────────────────────────────────────────────────────────── *
 *  MARK v16                                                                *
 *                                                                          *
 *  All devices : glitch plays immediately → auto-start → SK impact       *
 *  Android     : also fires navigator.vibrate                             *
 * ─────────────────────────────────────────────────────────────────────────*/
(function () {
  'use strict';

  /* ── Stale cleanup ───────────────────────────────────────────── */
  ['sk-stage', 'sk-kf', 'sk-logo'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  });

  if (sessionStorage.getItem('sk-intro')) return;
  sessionStorage.setItem('sk-intro', '1');

  var AC = null;
  try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}

  document.body.style.overflow = 'hidden';

  /* ── CSS ─────────────────────────────────────────────────────── */
  var kf = document.createElement('style');
  kf.id = 'sk-kf';
  kf.textContent = [
    '#sk-stage{position:fixed;inset:0;z-index:9998;background:#000;overflow:hidden;transition:opacity 0.7s ease;}',
    '#sk-cvs{position:absolute;inset:0;width:100%;height:100%;z-index:9999;display:block;}',

    '#sk-logo{',
      'position:fixed;top:50%;left:50%;',
      'transform:translate(-50%,-50%);',
      'z-index:10002;color:#fff;',
      'font-family:"Space Grotesk",system-ui,sans-serif;',
      'font-weight:900;white-space:nowrap;',
      'pointer-events:none;user-select:none;text-align:center;',
      'font-size:clamp(2.4rem,5.5vw,4.2rem);opacity:0;',
    '}',
    '#sk-logo.sk-vis  { opacity:1; transition:opacity .4s ease; }',
    '#sk-logo.sk-big  { font-size:clamp(5rem,11vw,7.5rem); opacity:1; transition:font-size .3s ease; }',
    '#sk-logo.sk-zoom { font-size:clamp(5rem,11vw,7.5rem); opacity:1; animation:sk-zoom-in 1s ease-in forwards; }',

    '@keyframes sk-zoom-in{',
      '0%  {transform:translate(-50%,-50%) scale(1);  opacity:1;filter:blur(0);}',
      '100%{transform:translate(-50%,-50%) scale(18); opacity:0;filter:blur(14px);}',
    '}',

    /* Full-screen shake — strong, felt physically */
    '@keyframes sk-shk{',
      '0%  {transform:translate(0,0) scale(1)}',
      '7%  {transform:translate(-24px,16px) scale(1.04)}',
      '16% {transform:translate(22px,-20px) scale(0.96)}',
      '26% {transform:translate(-18px,17px) scale(1.02)}',
      '37% {transform:translate(15px,-13px) scale(0.98)}',
      '49% {transform:translate(-10px,9px) scale(1.01)}',
      '61% {transform:translate(7px,-6px) scale(0.99)}',
      '73% {transform:translate(-4px,3px) scale(1)}',
      '86% {transform:translate(2px,-1px) scale(1)}',
      '100%{transform:translate(0,0) scale(1)}',
    '}',
  ].join('');
  document.head.appendChild(kf);

  /* ── DOM ─────────────────────────────────────────────────────── */
  var stage = document.createElement('div');
  stage.id = 'sk-stage';

  var canvas = document.createElement('canvas');
  canvas.id = 'sk-cvs';
  stage.appendChild(canvas);
  document.body.appendChild(stage);

  var logo = document.createElement('div');
  logo.id = 'sk-logo';
  logo.textContent = 'Saeed Khoury';
  document.body.appendChild(logo);

  var W, H, ctx;
  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);
  ctx = canvas.getContext('2d');

  /* ════════════════════════════════════════════════════════════════
   *  GLITCH CANVAS
   * ════════════════════════════════════════════════════════════════ */
  var glitchActive = false;
  var glitchRaf    = null;

  /* Plain black backdrop — no colour bands, no noise */
  function drawGlitch() {
    if (!glitchActive) return;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    glitchRaf = requestAnimationFrame(drawGlitch);
  }

  /* ════════════════════════════════════════════════════════════════
   *  TEXT SCRAMBLE
   * ════════════════════════════════════════════════════════════════ */
  var CHARS = '0123456789!@#$[]{}|ABCDEFGHIJKLMNPQRSTUVWXYZabcdefghijklmnpqrstuvwxyz';

  function scrambleTo(el, from, to, dur, onDone) {
    var start = Date.now();
    var iv = setInterval(function () {
      var t = Math.min((Date.now() - start) / dur, 1);
      if (t >= 1) { el.textContent = to; clearInterval(iv); if (onDone) onDone(); return; }
      var settled = Math.round(t * to.length);
      var result  = '';
      for (var i = 0; i < to.length; i++) {
        result += i < settled ? to[i] : CHARS[Math.random() * CHARS.length | 0];
      }
      el.textContent = result;
    }, 40);
  }

  /* ════════════════════════════════════════════════════════════════
   *  SK IMPACT
   *
   *  ① Android  → navigator.vibrate two-punch
   *  ② All      → full-screen CSS shake
   *  ③ All      → white flash
   *  ④ All      → white-noise audio burst + oscillator thud
   *     (desktop + Android; iOS may block audio without prior gesture)
   * ════════════════════════════════════════════════════════════════ */
  function osc(type, f0, f1, gain, delay, dur) {
    try {
      var o = AC.createOscillator(), g = AC.createGain();
      o.connect(g); g.connect(AC.destination); o.type = type;
      var t = AC.currentTime + delay;
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(gain, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.start(t); o.stop(t + dur + 0.01);
    } catch (e) {}
  }

  function skImpact() {
    /* ① Android vibration */
    if (navigator.vibrate) navigator.vibrate([90, 40, 140]);

    /* ② Full-screen shake */
    stage.style.animation = 'sk-shk 0.45s ease-out';
    setTimeout(function () { stage.style.animation = ''; }, 480);

    /* ③ White flash */
    var fl = document.createElement('div');
    fl.style.cssText = [
      'position:fixed;inset:0;z-index:20000;background:#fff',
      'pointer-events:none;opacity:1;transition:opacity 0.22s ease-out',
    ].join(';');
    document.body.appendChild(fl);
    setTimeout(function () { fl.style.opacity = '0'; }, 20);
    setTimeout(function () { if (fl.parentNode) fl.parentNode.removeChild(fl); }, 320);

    /* ④ Audio (AC is guaranteed unlocked at this point on mobile) */
    if (!AC) return;
    try {
      (AC.state === 'suspended' ? AC.resume() : Promise.resolve()).then(function () {
        var t  = AC.currentTime;
        var sr = AC.sampleRate;

        /* White-noise burst — physically moves iPhone speaker cone */
        var bufLen = (sr * 0.12) | 0;
        var buf    = AC.createBuffer(1, bufLen, sr);
        var data   = buf.getChannelData(0);
        for (var i = 0; i < bufLen; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufLen, 2.2);
        }
        var ns = AC.createBufferSource();
        ns.buffer = buf;
        var ng = AC.createGain();
        ng.gain.setValueAtTime(1.0, t);
        ng.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        ns.connect(ng); ng.connect(AC.destination);
        ns.start(t);

        /* Sub-bass thud layers */
        osc('sine',     72, 26, 0.95, 0,    0.20);
        osc('sine',     80, 22, 0.82, 0.03, 0.18);
        /* High transient snap */
        osc('triangle', 340, 85, 0.48, 0,   0.06);
        /* Rumble tail */
        osc('sine',     44, 16, 0.55, 0.06, 0.24);
      });
    } catch (e) {}
  }

  /* ════════════════════════════════════════════════════════════════
   *  ANIMATION SEQUENCE  (called after AC is unlocked)
   * ════════════════════════════════════════════════════════════════ */
  function startAnimation() {
    setTimeout(function () { logo.classList.add('sk-vis'); }, 200);

    setTimeout(function () {
      scrambleTo(logo, 'Saeed Khoury', 'SK', 480, function () {
        logo.className = 'sk-big';
        skImpact();
      });
    }, 1500);

    setTimeout(function () { logo.className = 'sk-zoom'; }, 4500);

    setTimeout(function () {
      glitchActive = false;
      if (glitchRaf) cancelAnimationFrame(glitchRaf);
      stage.style.opacity = '0';
      document.body.style.overflow = '';
    }, 5600);

    setTimeout(function () {
      if (stage.parentNode) stage.parentNode.removeChild(stage);
      if (logo.parentNode)  logo.parentNode.removeChild(logo);
      var kfEl = document.getElementById('sk-kf');
      if (kfEl && kfEl.parentNode) kfEl.parentNode.removeChild(kfEl);
    }, 6400);
  }

  /* ════════════════════════════════════════════════════════════════
   *  GLITCH STARTS IMMEDIATELY (all devices)
   * ════════════════════════════════════════════════════════════════ */
  glitchActive = true;
  drawGlitch();

  /* ════════════════════════════════════════════════════════════════
   *  AUTO-START (all devices)
   * ════════════════════════════════════════════════════════════════ */
  startAnimation();

})();
