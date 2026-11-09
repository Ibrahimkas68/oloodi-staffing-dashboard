(function () {
  if (window.SB) return;
  var START = 840, END = 1200, REQ = 3;
  var pad = function (n) { return String(n).padStart(2, '0'); };
  var fmt = function (m) { return m == null ? null : pad(Math.floor(m / 60) % 24) + ':' + pad(m % 60); };
  var dur = function (d) { var h = Math.floor(d / 60), m = d % 60; return h ? h + 'h' + (m ? ' ' + m + 'm' : '') : m + ' min'; };
  var list = function (a) { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; };

  var P = {
    uninvited: { label: 'Uninvited', bg: '#E5E6E1', fg: '#45474A' },
    invited: { label: 'Invited', bg: '#E9E5F7', fg: '#4A3A96' },
    accepted: { label: 'Accepted', bg: '#DFF0C8', fg: '#2C5210' },
    declined: { label: 'Declined', bg: '#F7DEDA', fg: '#8E2A1C' },
    cancelled: { label: 'Cancelled', bg: '#F4E6CC', fg: '#74470A' }
  };
  var A = {
    not_started: { label: 'Not started', border: '#A9ABA5', fg: '#4F5153' },
    checked_in: { label: 'Checked in', border: '#141517', fg: '#141517' },
    checked_out: { label: 'Checked out', border: '#6B6D70', fg: '#2E3033' }
  };
  var TK = {
    success: { bg: '#63B33B', fg: '#0B1702', g: '\u2713' },
    neutral: { bg: '#5A5C60', fg: '#F4F4F1', g: 'i' },
    conflict: { bg: '#E8A93B', fg: '#1F1300', g: '!' },
    network: { bg: '#E36A5C', fg: '#1F0703', g: '!' }
  };

  function W(id, name, first, initials, pr, pos) {
    return { id: id, name: name, first: first, initials: initials, pr: pr, pos: pos, p: 'uninvited', a: 'not_started', invitedAt: null, respondedAt: null, inAt: null, outAt: null };
  }
  function base() {
    return [W('amina', 'Amina El Idrissi', 'Amina', 'AE', 'she', 'her'), W('youssef', 'Youssef Benali', 'Youssef', 'YB', 'he', 'his'), W('salma', 'Salma Haddad', 'Salma', 'SH', 'she', 'her')];
  }
  var uid = 0;
  function ev(t, wid, verb) { return { id: 'e' + (++uid), t: t, wid: wid, verb: verb }; }
  function model(now, ws, act, version, recovery) {
    return { now: now, workers: ws, activity: act, version: version, metrics: { delay: 38, recovery: recovery }, conn: 'live', dataFrom: now, syncedAgo: 2, lastChange: null };
  }
  function scenario(name) {
    var ws = base(), a = ws[0], y = ws[1], s = ws[2];
    if (name === 'empty') return model(660, ws, [], 1, null);
    [a, y, s].forEach(function (w) { w.p = 'invited'; w.invitedAt = 605; });
    if (name === 'end') {
      a.p = y.p = s.p = 'accepted';
      a.respondedAt = 612; y.respondedAt = 640; s.respondedAt = 678;
      a.a = y.a = s.a = 'checked_out';
      a.inAt = 842; y.inAt = 846; s.inAt = 861;
      a.outAt = 1198; y.outAt = 1201; s.outAt = 1195;
      return model(1204, ws, [
        ev(1201, 'youssef', 'checked out'), ev(1198, 'amina', 'checked out'), ev(1195, 'salma', 'checked out'),
        ev(861, 'salma', 'checked in'), ev(846, 'youssef', 'checked in'), ev(842, 'amina', 'checked in'),
        ev(678, 'salma', 'accepted'), ev(640, 'youssef', 'accepted'), ev(612, 'amina', 'accepted'),
        ev(605, 'salma', 'was invited'), ev(605, 'youssef', 'was invited'), ev(605, 'amina', 'was invited')
      ], 31, 2.1);
    }
    a.p = 'accepted'; a.respondedAt = 612; a.a = 'checked_in'; a.inAt = 842;
    y.p = 'declined'; y.respondedAt = 640;
    s.p = 'accepted'; s.respondedAt = 678;
    return model(872, ws, [
      ev(842, 'amina', 'checked in'), ev(678, 'salma', 'accepted'), ev(640, 'youssef', 'declined'),
      ev(612, 'amina', 'accepted'), ev(605, 'salma', 'was invited'), ev(605, 'youssef', 'was invited'), ev(605, 'amina', 'was invited')
    ], 12, 2.1);
  }
  function variant(v) {
    var m = scenario('mid'), s = m.workers[2];
    Object.assign(s, { p: 'uninvited', a: 'not_started', invitedAt: null, respondedAt: null, inAt: null, outAt: null });
    m.activity = m.activity.filter(function (e) { return e.wid !== 'salma'; });
    if (v !== 'uninvited') { s.p = 'invited'; s.invitedAt = 605; m.now = 700; }
    if (v === 'declined') { s.p = 'declined'; s.respondedAt = 640; }
    if (['accepted', 'checked_in', 'checked_out', 'cancelled'].indexOf(v) > -1) { s.p = 'accepted'; s.respondedAt = 678; m.now = 820; }
    if (v === 'cancelled') { s.p = 'cancelled'; s.respondedAt = 790; m.now = 795; }
    if (v === 'checked_in' || v === 'checked_out') { s.a = 'checked_in'; s.inAt = 842; m.now = 872; }
    if (v === 'checked_out') { s.a = 'checked_out'; s.outAt = 1198; m.now = 1199; }
    return m;
  }

  function readiness(m) {
    var ws = m.workers, acc = ws.filter(function (w) { return w.p === 'accepted'; }), filled = acc.length;
    if (filled === REQ && acc.every(function (w) { return w.a === 'checked_out'; })) {
      var last = Math.max.apply(null, acc.map(function (w) { return w.outAt; }));
      return { complete: true, parts: ['Shift complete', filled + ' of ' + REQ + ' places filled', 'everyone checked out by ' + fmt(last)] };
    }
    var parts = [filled + ' of ' + REQ + ' places filled'];
    if (m.now < START) parts.push('starts in ' + dur(START - m.now));
    else if (m.now < END) parts.push('ends in ' + dur(END - m.now));
    else parts.push('shift ended');
    var first = function (w) { return w.first; };
    var waiting = acc.filter(function (w) { return w.a === 'not_started'; }).map(first);
    var invited = ws.filter(function (w) { return w.p === 'invited'; }).map(first);
    var uninv = ws.filter(function (w) { return w.p === 'uninvited'; }).length;
    if (waiting.length) parts.push(list(waiting) + ' accepted, not checked in yet');
    else if (uninv === ws.length) parts.push('no one invited yet');
    else if (invited.length) parts.push(list(invited) + (invited.length > 1 ? ' have' : ' has') + ' not replied yet');
    else if (filled < REQ) parts.push((REQ - filled) + (REQ - filled > 1 ? ' places' : ' place') + ' still open');
    else parts.push('everyone is on site');
    return { complete: false, parts: parts };
  }
  function derive(m) {
    var ws = m.workers, filled = ws.filter(function (w) { return w.p === 'accepted'; }).length;
    return {
      filled: filled, remaining: REQ - filled,
      checkedIn: ws.filter(function (w) { return w.a === 'checked_in'; }).length,
      checkedOut: ws.filter(function (w) { return w.a === 'checked_out'; }).length,
      readiness: readiness(m),
      segs: [0, 1, 2].map(function (i) { return { bg: i < filled ? '#141517' : '#DCDDD7' }; })
    };
  }
  function row(w) {
    var pp = P[w.p], aa = A[w.a];
    var t = function (v) { return v == null ? '\u2014' : fmt(v); }, c = function (v) { return v == null ? '#8A8C8E' : '#141517'; };
    return {
      id: w.id, name: w.name, first: w.first, initials: w.initials,
      pLabel: pp.label, pBg: pp.bg, pFg: pp.fg, aLabel: aa.label, aBorder: aa.border, aFg: aa.fg,
      isNS: w.a === 'not_started', isIn: w.a === 'checked_in', isOut: w.a === 'checked_out', canInvite: w.p === 'uninvited',
      tInv: t(w.invitedAt), cInv: c(w.invitedAt), tResp: t(w.respondedAt), cResp: c(w.respondedAt),
      tIn: t(w.inAt), cIn: c(w.inAt), tOut: t(w.outAt), cOut: c(w.outAt)
    };
  }

  function act(m, wid, type, src) {
    var w = m.workers.find(function (x) { return x.id === wid; }), T = m.now, n = Object.assign({}, w), verb, title;
    var no = function (kind, t) { return { ok: false, m: m, kind: kind, title: t }; };
    switch (type) {
      case 'invite':
        if (w.p !== 'uninvited') return no('neutral', w.first + ' is already invited');
        n.p = 'invited'; n.invitedAt = T; verb = 'was invited'; title = 'Invite sent to ' + w.first; break;
      case 'accept':
        if (w.p !== 'invited' && w.p !== 'cancelled') return no('neutral', w.first + ' already replied');
        verb = w.p === 'cancelled' ? 'accepted again' : 'accepted';
        n.p = 'accepted'; n.respondedAt = T; title = "You're on the shift. See you at 14:00"; break;
      case 'decline':
        if (w.p !== 'invited') return no('conflict', w.first + " can't decline now");
        n.p = 'declined'; n.respondedAt = T; verb = 'declined'; title = 'Declined. Thanks for letting us know'; break;
      case 'cancel':
        if (!(w.p === 'accepted' && w.a === 'not_started')) return no('conflict', w.first + " can't cancel after checking in");
        n.p = 'cancelled'; n.respondedAt = T; verb = 'cancelled ' + w.pos + ' spot'; title = 'Your spot was released'; break;
      case 'checkin':
        if (w.a === 'checked_in') return no('neutral', 'Already checked in at ' + fmt(w.inAt));
        if (w.a === 'checked_out') return no('conflict', w.first + ' already checked out, so ' + w.pr + " can't check in again");
        if (w.p !== 'accepted') return no('conflict', w.first + " hasn't accepted, so " + w.pr + " can't check in");
        n.a = 'checked_in'; n.inAt = T; verb = 'checked in'; title = 'Checked in at ' + fmt(T); break;
      case 'checkout':
        if (w.a === 'checked_out') return no('neutral', 'Already checked out at ' + fmt(w.outAt));
        if (w.a !== 'checked_in') return no('conflict', w.first + " isn't checked in, so " + w.pr + " can't check out");
        n.a = 'checked_out'; n.outAt = T; verb = 'checked out'; title = 'Checked out at ' + fmt(T); break;
    }
    var e = ev(T, wid, verb); e.live = true;
    return {
      ok: true, kind: 'success', title: title,
      m: Object.assign({}, m, {
        workers: m.workers.map(function (x) { return x.id === wid ? n : x; }),
        activity: [e].concat(m.activity), version: m.version + 1, now: T + 1, syncedAgo: 0,
        metrics: Object.assign({}, m.metrics, { delay: 24 + Math.round(Math.random() * 36) }),
        lastChange: { wid: wid, src: src }
      })
    };
  }

  function avatar(R, w, size) {
    return R.createElement('span', { style: { width: size, height: size, borderRadius: 999, background: '#DCDDD7', color: '#141517', fontSize: Math.round(size * 0.4), fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 } }, w.initials);
  }
  function timelineEl(R, m) {
    var by = {}; m.workers.forEach(function (w) { by[w.id] = w; });
    if (!m.activity.length) return R.createElement('div', { style: { padding: '16px 0', color: '#4F5153', fontSize: 15, lineHeight: 1.45 } }, 'No activity yet. Invites, replies and check-ins will appear here as they happen.');
    return R.createElement('div', { style: { display: 'flex', flexDirection: 'column' } }, m.activity.map(function (it) {
      var w = by[it.wid];
      return R.createElement('div', { key: it.id, style: { display: 'grid', gridTemplateColumns: '44px 26px minmax(0,1fr)', gap: 10, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #E5E6E1', animation: it.live ? 'sbSlideIn 180ms cubic-bezier(.2,.8,.2,1) both' : 'none' } },
        R.createElement('span', { style: { fontSize: 15, color: '#4F5153', fontVariantNumeric: 'tabular-nums' } }, fmt(it.t)),
        avatar(R, w, 26),
        R.createElement('span', { style: { fontSize: 15, color: '#141517', lineHeight: 1.35 } }, R.createElement('strong', { style: { fontWeight: 600 } }, w.first), ' ' + it.verb));
    }));
  }
  function toastsEl(R, items, place) {
    return R.createElement('div', { style: { display: 'flex', flexDirection: place === 'bottom' ? 'column-reverse' : 'column', gap: 8 } }, (items || []).map(function (t) {
      var k = TK[t.kind] || TK.neutral;
      return R.createElement('div', { key: t.id, role: 'status', style: { display: 'grid', gridTemplateColumns: '24px minmax(0,1fr)', gap: 12, alignItems: 'start', padding: '12px 14px', background: '#141517', color: '#F4F4F1', borderRadius: 16, boxShadow: '0 8px 24px rgba(3,4,5,.24)', animation: (place === 'bottom' ? 'sbToastUp' : 'sbToastIn') + ' 180ms cubic-bezier(.2,.8,.2,1) both' } },
        R.createElement('span', { style: { width: 24, height: 24, borderRadius: 999, background: k.bg, color: k.fg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 } }, k.g),
        R.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 2, paddingTop: 2 } },
          R.createElement('span', { style: { fontSize: 15, fontWeight: 600, lineHeight: 1.35 } }, t.title),
          t.sub ? R.createElement('span', { style: { fontSize: 13, color: '#B5B7B2', lineHeight: 1.35 } }, t.sub) : null));
    }));
  }
  function num(R, v) {
    return R.createElement('span', { key: String(v), style: { display: 'inline-block', animation: 'sbPop 200ms cubic-bezier(.2,.8,.2,1) both' } }, v);
  }

  var css = '@keyframes sbPop{from{opacity:0;transform:translateY(10px) scale(.94)}to{opacity:1;transform:none}}' +
    '@keyframes sbSlideIn{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:none}}' +
    '@keyframes sbToastIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}' +
    '@keyframes sbToastUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}' +
    '@keyframes sbFade{from{opacity:0}to{opacity:1}}' +
    '@keyframes sbPulse{0%{opacity:.75;transform:scale(1)}100%{opacity:0;transform:scale(2.6)}}' +
    '@keyframes sbSpin{to{transform:rotate(360deg)}}' +
    '@media (prefers-reduced-motion: reduce){*,*::before,*::after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition:none!important}[data-recent="true"]{box-shadow:inset 0 0 0 2px #9DDA4F}}';
  var st = document.createElement('style'); st.id = 'sb-motion'; st.textContent = css; document.head.appendChild(st);

  window.SB = { fmt: fmt, P: P, A: A, scenario: scenario, variant: variant, derive: derive, row: row, act: act, timelineEl: timelineEl, toastsEl: toastsEl, num: num, START: START, END: END, REQ: REQ };
})();
