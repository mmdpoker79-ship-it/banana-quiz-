/* ============================================================
   🍌 کوییز موز — منطق بازی
   فقط جاوااسکریپت خالص، بدون هیچ کتابخانه‌ای
   ============================================================ */
(function () {
  'use strict';

  /* ---------- ابزارهای کمکی ---------- */
  function $(id) { return document.getElementById(id); }

  var FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
  function faNum(n) {
    return String(n).replace(/\d/g, function (d) { return FA_DIGITS[+d]; });
  }

  function shuffle(list) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function restartAnim(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth; /* ریست انیمیشن */
    el.classList.add(cls);
  }

  /* ---------- تنظیمات بازی ---------- */
  var QUESTION_COUNT = 15;  /* تعداد سوال هر بازی */
  var TIME_PER_Q = 15;      /* ثانیه برای هر سوال */
  var AUTO_NEXT_MS = 1500;  /* تاخیر خودکار رفتن به سوال بعد */

  var RANKS = [
    { min: 0,  max: 3,  cls: 'r1', emoji: '🤢', title: 'موز کپک زده', msg: 'یوه! این موز کپک زده! دوباره بازی کن و نجاتش بده.' },
    { min: 4,  max: 5,  cls: 'r2', emoji: '🟢', title: 'موز نارس',    msg: 'هنوز خامی! یک دور دیگر تلاش کن تا رسیده شوی.' },
    { min: 6,  max: 8,  cls: 'r3', emoji: '🌳', title: 'موز درختی',   msg: 'هنوز روی درخت آویزانی! بیشتر تلاش کن تا برداشت شوی.' },
    { min: 9,  max: 12, cls: 'r4', emoji: '🍌', title: 'موز رسیده',   msg: 'خوب بود! کمی دیگر، طلایی می‌شوی.' },
    { min: 13, max: 99, cls: 'r5', emoji: '👑', title: 'موز طلایی',   msg: 'فوق‌العاده! تو پادشاه موزها هستی!' }
  ];

  /* ---------- وضعیت بازی ---------- */
  var state = {
    name: '',
    nick: '',
    category: null,   /* دستهٔ انتخاب‌شده */
    questions: [],
    idx: 0,
    score: 0,
    log: [],          /* {q, chosen, correct, ok, timedOut} */
    timerId: null,
    timeLeft: TIME_PER_Q,
    locked: false,
    nextTimer: null,
    lastRank: RANKS[3],
    newRecord: false
  };

  /* ---------- ذخیره‌سازی محلی ---------- */
  function getPlayer() {
    try { return JSON.parse(localStorage.getItem('mozQuizPlayer') || 'null'); }
    catch (e) { return null; }
  }
  function getBest() {
    try { return JSON.parse(localStorage.getItem('mozQuizBest') || 'null'); }
    catch (e) { return null; }
  }

  /* ---------- جابه‌جایی بین صفحات ---------- */
  function show(screenId) {
    var screens = document.querySelectorAll('.screen');
    for (var i = 0; i < screens.length; i++) screens[i].classList.remove('active');
    $(screenId).classList.add('active');
    window.scrollTo(0, 0);
  }

  var toastTimer = null;
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    restartAnim(t, 'toast');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.add('hidden'); }, 2200);
  }

  /* ---------- صفحهٔ ورود ---------- */
  function endsWithMooz(s) { return /موز\s*$/.test(s); }

  function enterSite() {
    var name = $('player-name').value.trim();
    var nick = $('player-nick').value.trim();
    var err = $('entry-error');

    function fail(msg) {
      err.textContent = msg;
      err.classList.remove('hidden');
      restartAnim(err, 'error');
    }

    if (!name) { fail('نام را وارد کن 😅'); return; }
    if (!nick) { fail('لقب موزی‌ات را وارد کن 🍌'); return; }
    if (!endsWithMooz(nick)) {
      fail('لقب باید به «موز» ختم شود! مثلاً: کاپیتان موز');
      return;
    }

    err.classList.add('hidden');
    state.name = name;
    state.nick = nick;
    try {
      localStorage.setItem('mozQuizPlayer', JSON.stringify({ name: name, nick: nick }));
    } catch (e) { /* دسترسی محدود */ }
    goHome();
  }

  function goHome() {
    $('home-name').textContent = state.name;
    $('home-nick').textContent = state.nick;
    var best = getBest();
    $('home-best').textContent = best
      ? '🏆 بهترین امتیاز تو: ' + faNum(best.score) + ' — با لقب «' + best.nick + '»'
      : '🏆 هنوز رکوردی ثبت نشده';
    show('screen-home');
  }

  /* ---------- صفحهٔ انتخاب دسته ---------- */
  function buildCategoryGrid() {
    var grid = $('cat-grid');
    grid.innerHTML = '';
    var cats = window.QUESTION_CATEGORIES || [];
    cats.forEach(function (cat) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cat-card c-' + cat.id;

      var emoji = document.createElement('span');
      emoji.className = 'cat-emoji';
      emoji.textContent = cat.icon;

      var info = document.createElement('span');
      info.className = 'cat-info';
      var name = document.createElement('span');
      name.className = 'cat-name';
      name.textContent = cat.name;
      var meta = document.createElement('span');
      meta.className = 'cat-meta';
      meta.textContent = faNum(cat.questions.length) + ' سؤال در بانک • ۱۵ سؤال تصادفی';
      info.appendChild(name);
      info.appendChild(meta);

      var arrow = document.createElement('span');
      arrow.className = 'cat-arrow';
      arrow.textContent = '◂';

      btn.appendChild(emoji);
      btn.appendChild(info);
      btn.appendChild(arrow);
      btn.addEventListener('click', function () { startQuiz(cat.id); });
      grid.appendChild(btn);
    });
  }

  function showCategoryScreen() {
    buildCategoryGrid(); /* تعداد سوال‌ها همیشه تازه محاسبه شود */
    show('screen-category');
  }

  /* ---------- شروع بازی ---------- */
  function startQuiz(catId) {
    var cats = window.QUESTION_CATEGORIES || [];
    var cat = null;
    for (var i = 0; i < cats.length; i++) {
      if (cats[i].id === catId) { cat = cats[i]; break; }
    }
    if (!cat || !cat.questions.length) {
      toast('این دسته سوالی ندارد! فایل questions.js را بررسی کن.');
      return;
    }

    state.category = cat;
    state.questions = shuffle(cat.questions)
      .slice(0, Math.min(QUESTION_COUNT, cat.questions.length))
      .map(function (item) {
        /* ترتیب تصادفی گزینه‌ها با حفظ گزینهٔ درست */
        var opts = item.options.map(function (text, i) {
          return { text: text, correct: i === item.correct };
        });
        return { q: item.q, hint: item.hint || '', options: shuffle(opts) };
      });

    state.idx = 0;
    state.score = 0;
    state.log = [];
    $('quiz-score').textContent = faNum(0);
    $('quiz-nick').textContent = state.nick || '🍌';
    show('screen-quiz');
    renderQuestion();
  }

  /* ---------- نمایش سوال ---------- */
  function renderQuestion() {
    var total = state.questions.length;
    var item = state.questions[state.idx];

    state.locked = false;
    $('quiz-progress').textContent = (state.category ? state.category.icon + ' ' + state.category.name + ' • ' : '') +
      'سؤال ' + faNum(state.idx + 1) + ' از ' + faNum(total);
    $('progress-fill').style.width = (state.idx / total * 100) + '%';

    restartAnim($('question-card'), 'slide-in');
    $('question-text').textContent = item.q;

    var box = $('options');
    box.innerHTML = '';
    item.options.forEach(function (opt, i) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'option';

      var num = document.createElement('span');
      num.className = 'opt-num';
      num.textContent = faNum(i + 1);

      var txt = document.createElement('span');
      txt.className = 'opt-text';
      txt.textContent = opt.text;

      var mark = document.createElement('span');
      mark.className = 'mark';

      btn.appendChild(num);
      btn.appendChild(txt);
      btn.appendChild(mark);
      btn.addEventListener('click', function () { answer(i); });
      box.appendChild(btn);
    });

    $('explanation').classList.add('hidden');
    $('next-hint').classList.add('hidden');
    startTimer();
  }

  /* ---------- تایمر ---------- */
  function startTimer() {
    stopTimer();
    state.timeLeft = TIME_PER_Q;
    updateTimerUI();
    var last = Date.now();
    state.timerId = setInterval(function () {
      var now = Date.now();
      state.timeLeft -= (now - last) / 1000;
      last = now;
      if (state.timeLeft <= 0) {
        state.timeLeft = 0;
        updateTimerUI();
        stopTimer();
        answer(-1); /* وقت تمام شد */
        return;
      }
      updateTimerUI();
    }, 100);
  }

  function stopTimer() {
    if (state.timerId) { clearInterval(state.timerId); state.timerId = null; }
  }

  function updateTimerUI() {
    var fill = $('timer-fill');
    fill.style.width = (state.timeLeft / TIME_PER_Q * 100) + '%';
    fill.classList.toggle('warn', state.timeLeft <= 8 && state.timeLeft > 5);
    fill.classList.toggle('danger', state.timeLeft <= 5);
    $('timer-num').textContent = faNum(Math.ceil(state.timeLeft));
  }

  /* ---------- پاسخ دادن ---------- */
  function answer(i) {
    if (state.locked) return;
    state.locked = true;
    stopTimer();

    var total = state.questions.length;
    var item = state.questions[state.idx];
    var timedOut = (i === -1);
    var ok = !timedOut && item.options[i].correct;
    var chosenText = timedOut ? null : item.options[i].text;
    var correctText = item.options.filter(function (o) { return o.correct; })[0].text;

    /* رنگ‌بندی گزینه‌ها و قفل کردن */
    var btns = document.querySelectorAll('#options .option');
    for (var j = 0; j < btns.length; j++) {
      (function (k) {
        var btn = btns[k];
        var opt = item.options[k];
        btn.disabled = true; /* قفل فوری */
        if (opt.correct) {
          btn.classList.add('correct');
          btn.querySelector('.mark').textContent = '✅';
        } else if (k === i) {
          btn.classList.add('wrong');
          btn.querySelector('.mark').textContent = '❌';
        } else {
          btn.classList.add('dim');
        }
      })(j);
    }

    /* جملهٔ توضیح */
    var prefix = timedOut ? '⏰ وقت تمام شد! ' : (ok ? '🎉 آفرین! ' : '🤔 اشتباه بود! ');
    var exp = $('explanation');
    exp.textContent = prefix + item.hint;
    exp.classList.remove('hidden');

    /* نوار پیشرفت + امتیاز */
    if (ok) {
      state.score++;
      $('quiz-score').textContent = faNum(state.score);
      floatPlusOne();
    }
    $('progress-fill').style.width = ((state.idx + 1) / total * 100) + '%';

    /* ثبت در پرونده */
    state.log.push({
      q: item.q,
      chosen: chosenText,
      correct: correctText,
      ok: ok,
      timedOut: timedOut
    });

    /* راهنمای رفتن به سوال بعد */
    var isLast = (state.idx + 1 >= total);
    $('next-hint-text').textContent = isLast ? 'در حال آماده‌سازی پرونده…' : 'سؤال بعدی…';
    var hint = $('next-hint');
    hint.classList.remove('hidden');
    restartAnim(hint.querySelector('.next-fill'), 'next-fill');

    /* رفتن خودکار بعد از ۱.۵ ثانیه */
    clearTimeout(state.nextTimer);
    state.nextTimer = setTimeout(nextQuestion, AUTO_NEXT_MS);
  }

  function floatPlusOne() {
    var chip = document.querySelector('.score-chip');
    if (!chip) return;
    var span = document.createElement('span');
    span.className = 'float-up';
    span.textContent = '+۱';
    chip.appendChild(span);
    setTimeout(function () { if (span.parentNode) span.parentNode.removeChild(span); }, 900);
  }

  function nextQuestion() {
    clearTimeout(state.nextTimer);
    state.idx++;
    if (state.idx >= state.questions.length) {
      finishQuiz();
    } else {
      renderQuestion();
    }
  }

  /* ---------- پایان بازی: ساخت پرونده ---------- */
  function finishQuiz() {
    var total = state.questions.length;
    var correct = state.score;
    var wrong = state.log.filter(function (l) { return !l.ok && !l.timedOut; }).length;
    var timeouts = state.log.filter(function (l) { return l.timedOut; }).length;

    /* بهترین امتیاز در localStorage */
    var best = getBest();
    state.newRecord = !best || correct > best.score;
    if (state.newRecord) {
      best = { score: correct, name: state.name, nick: state.nick };
      try { localStorage.setItem('mozQuizBest', JSON.stringify(best)); } catch (e) { /* ignore */ }
    }

    /* رنک بر اساس امتیاز */
    var rank = RANKS[0];
    for (var r = 0; r < RANKS.length; r++) {
      if (correct >= RANKS[r].min && correct <= RANKS[r].max) { rank = RANKS[r]; break; }
    }
    state.lastRank = rank;

    /* پر کردن پرونده */
    $('file-no').textContent = 'شمارهٔ پرونده: MOZ-' + faNum(Math.floor(1000 + Math.random() * 9000));
    $('d-name').textContent = state.name;
    $('d-nick').textContent = state.nick;
    $('d-date').textContent = new Date().toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' });
    $('d-cat').textContent = state.category ? (state.category.icon + ' ' + state.category.name) : '—';
    $('d-correct').textContent = faNum(correct) + ' مورد ✅';
    $('d-wrong').textContent = faNum(wrong) + ' مورد ❌';
    $('d-timeout').textContent = faNum(timeouts) + ' مورد ⏰';
    $('d-score').textContent = faNum(correct) + ' از ' + faNum(total);
    $('d-best').innerHTML = faNum(best.score) + ' امتیاز' +
      (state.newRecord ? ' <span class="new-record">— 🎉 رکورد جدید!</span>' : '');

    /* مهر رنک */
    var stamp = $('rank-stamp');
    stamp.className = 'rank-stamp ' + rank.cls;
    stamp.textContent = rank.title + ' ' + rank.emoji;
    restartAnim(stamp, 'stampDrop');

    $('rank-msg').textContent = rank.msg;

    /* جزئیات پاسخ‌ها */
    buildReview();

    show('screen-result');
  }

  function buildReview() {
    var list = $('review-list');
    list.innerHTML = '';
    state.log.forEach(function (l) {
      var li = document.createElement('li');

      var head = document.createElement('div');
      head.className = 'rv-head';

      var icon = document.createElement('span');
      icon.textContent = l.ok ? '✅' : (l.timedOut ? '⏰' : '❌');

      var q = document.createElement('span');
      q.textContent = l.q;

      head.appendChild(icon);
      head.appendChild(q);
      li.appendChild(head);

      var ans = document.createElement('div');
      ans.className = 'rv-a ' + (l.ok ? 'ok' : (l.timedOut ? 'to' : 'no'));
      ans.textContent = l.ok
        ? ('پاسخ درست: ' + l.correct)
        : (l.timedOut
          ? ('وقت تمام شد — پاسخ درست: ' + l.correct)
          : ('پاسخ شما: ' + l.chosen + ' | پاسخ درست: ' + l.correct));
      li.appendChild(ans);

      list.appendChild(li);
    });
  }

  /* ---------- اشتراک‌گذاری: عکس پرونده ---------- */
  function buildShareText() {
    var total = state.questions.length;
    var best = getBest();
    return (
      '🍌 کوییز موز 🍌\n' +
      '👤 ' + state.name + ' (' + state.nick + ')\n' +
      '📂 دسته: ' + (state.category ? state.category.name : '—') + '\n' +
      '✅ امتیاز: ' + faNum(state.score) + ' از ' + faNum(total) + '\n' +
      '🏅 رنک: ' + state.lastRank.title + ' ' + state.lastRank.emoji + '\n' +
      (best ? '🏆 بهترین امتیاز: ' + faNum(best.score) + '\n' : '') +
      'ساخته‌شده توسط محمد مهدی عدالتیان'
    );
  }

  function downloadBlob(blob) {
    try {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'moz-quiz-dossier.png';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 800);
    } catch (e) { /* ignore */ }
  }

  /* عکس‌برداری واقعی از پرونده با html2canvas */
  function snapDossierImage(cb) {
    var dossier = document.querySelector('.dossier');
    var review = dossier ? dossier.querySelector('.review') : null;
    var tab = dossier ? dossier.querySelector('.dossier-tab') : null;
    if (!dossier || !window.html2canvas) { cb(null); return; }

    /* html2canvas لیست جزئیات را همیشه باز رندر می‌کند؛
       موقع عکس‌برداری مخفی‌اش می‌کنیم تا عکس تمیز باشد.
       زبانهٔ قهوه‌ای هم بیرون کادر است؛ موقع عکس‌برداری می‌آوریمش داخل کادر */
    var prevReview = review ? review.style.display : '';
    var prevTop = tab ? tab.style.top : '';
    if (review) review.style.display = 'none';
    if (tab) tab.style.top = '0px';

    window.html2canvas(dossier, {
      scale: 2,
      backgroundColor: '#FFF8E7',
      useCORS: true,
      logging: false,
      width: dossier.offsetWidth,
      height: dossier.offsetHeight,
      windowWidth: dossier.offsetWidth,
      windowHeight: dossier.offsetHeight + 40
    }).then(function (canvas) {
      if (review) review.style.display = prevReview;
      if (tab) tab.style.top = prevTop;
      canvas.toBlob(function (blob) { cb(blob || null); }, 'image/png');
    }).catch(function () {
      if (review) review.style.display = prevReview;
      if (tab) tab.style.top = prevTop;
      cb(null);
    });
  }

  /* نسخهٔ پشتیبان: رسم دستی پرونده روی بوم (بدون هیچ کتابخانه‌ای) */
  function manualDossierImage(cb) {
    try {
      var W = 720, H = 1040;
      var c = document.createElement('canvas');
      c.width = W; c.height = H;
      var x = c.getContext('2d');
      var R = function (px, py, pw, ph, pr) {
        if (x.roundRect) { x.beginPath(); x.roundRect(px, py, pw, ph, pr); }
        else { x.beginPath(); x.rect(px, py, pw, ph); }
      };

      /* پس‌زمینه و کاغذ */
      x.fillStyle = '#FFE682'; x.fillRect(0, 0, W, H);
      x.fillStyle = '#FFFDF5'; R(30, 90, W - 60, H - 180, 24); x.fill();
      x.strokeStyle = '#E3C98F'; x.lineWidth = 4; R(30, 90, W - 60, H - 180, 24); x.stroke();

      /* زبانه */
      x.fillStyle = '#5D3A1A'; R(W - 280, 62, 240, 56, 16); x.fill();
      x.fillStyle = '#FFE682'; x.textAlign = 'center'; x.direction = 'rtl';
      x.font = '900 24px Vazirmatn, Tahoma';
      x.fillText('پروندهٔ بازیکن', W - 160, 100);

      /* عنوان و شمارهٔ پرونده */
      x.fillStyle = '#3E2610'; x.textAlign = 'right';
      x.font = '900 32px Vazirmatn, Tahoma';
      x.fillText('🗂️ پروندهٔ عملکرد کوییز موز', W - 70, 190);
      x.fillStyle = '#8A6A3F'; x.font = '700 20px Vazirmatn, Tahoma';
      x.fillText($('file-no').textContent, W - 70, 232);

      /* ردیف‌ها */
      var rows = [
        ['نام و نام خانوادگی', state.name, '#3E2610'],
        ['لقب موزی', state.nick, '#3E2610'],
        ['تاریخ', new Date().toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' }), '#3E2610'],
        ['دستهٔ سؤال‌ها', state.category ? (state.category.icon + ' ' + state.category.name) : '—', '#3E2610'],
        ['پاسخ‌های درست', $('d-correct').textContent, '#1F7A33'],
        ['پاسخ‌های اشتباه', $('d-wrong').textContent, '#D93636'],
        ['بدون پاسخ (اتمام وقت)', $('d-timeout').textContent, '#C98A00'],
        ['امتیاز نهایی', $('d-score').textContent, '#3E2610'],
        ['بهترین امتیاز', $('d-best').textContent, '#B8860B']
      ];
      var y = 288;
      rows.forEach(function (r) {
        x.strokeStyle = '#E8D5A8'; x.lineWidth = 2;
        x.setLineDash([6, 6]);
        x.beginPath(); x.moveTo(70, y + 18); x.lineTo(W - 70, y + 18); x.stroke();
        x.setLineDash([]);
        x.font = '600 24px Vazirmatn, Tahoma'; x.fillStyle = '#8A6A3F'; x.textAlign = 'right';
        x.fillText(r[0], W - 70, y + 8);
        x.font = '800 26px Vazirmatn, Tahoma'; x.fillStyle = r[2]; x.textAlign = 'left';
        x.fillText(r[1], 70, y + 8);
        y += 58;
      });

      /* واترمارک موز */
      x.globalAlpha = 0.07; x.font = '260px serif'; x.textAlign = 'center';
      x.fillText('🍌', W / 2, H - 260); x.globalAlpha = 1;

      /* مهر رنک */
      x.save();
      x.translate(W / 2, H - 192);
      x.rotate(-0.1);
      var rc = { r1: '#7A8B6F', r2: '#1F7A33', r3: '#8B5E2B', r4: '#C98A00', r5: '#B8860B' }[state.lastRank.cls] || '#C98A00';
      x.fillStyle = 'rgba(255,255,255,.6)'; R(-160, -34, 320, 68, 14); x.fill();
      x.strokeStyle = rc; x.lineWidth = 5; R(-160, -34, 320, 68, 14); x.stroke();
      x.lineWidth = 1.5; R(-152, -26, 304, 52, 10); x.stroke();
      x.fillStyle = rc;
      x.font = '900 30px Vazirmatn, Tahoma'; x.textAlign = 'center'; x.direction = 'rtl';
      x.fillText(state.lastRank.title + ' ' + state.lastRank.emoji, 0, 11);
      x.restore();

      /* مهر سازنده */
      x.save();
      x.translate(190, H - 122);
      x.rotate(0.07);
      x.strokeStyle = '#2C4A6E'; x.lineWidth = 3; R(-155, -34, 310, 68, 12); x.stroke();
      x.lineWidth = 1; R(-149, -28, 298, 56, 9); x.stroke();
      x.fillStyle = '#2C4A6E'; x.textAlign = 'center'; x.direction = 'rtl';
      x.font = '600 18px Vazirmatn, Tahoma';
      x.fillText('تهیه‌کنندهٔ سایت', 0, -4);
      x.font = '800 21px Vazirmatn, Tahoma';
      x.fillText('محمد مهدی عدالتیان', 0, 22);
      x.restore();

      c.toBlob(function (blob) { cb(blob || null); }, 'image/png');
    } catch (e) { cb(null); }
  }

  function makeDossierImage(cb) {
    snapDossierImage(function (blob) {
      if (blob) { cb(blob); return; }
      manualDossierImage(cb);
    });
  }

  function shareResult() {
    var text = buildShareText();

    makeDossierImage(function (blob) {
      /* اگر حتی عکس هم ساخته نشد: فقط متن */
      if (!blob) {
        if (navigator.share) {
          navigator.share({ title: 'کوییز موز 🍌', text: text }).catch(function () { /* لغو شد */ });
        } else {
          toast('امکان ارسال عکس در این مرورگر نیست 😕');
        }
        return;
      }

      var file;
      try {
        file = new File([blob], 'moz-quiz-dossier.png', { type: 'image/png' });
      } catch (e) {
        file = blob;
      }

      /* موبایل: ارسال مستقیم عکس پرونده با شیت اشتراک سیستم */
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: 'کوییز موز 🍌', text: text })
          .catch(function () { /* لغو شد */ });
        return;
      }

      /* پشتیبان: ذخیرهٔ عکس + متن اشتراک اگر شیت داشت */
      downloadBlob(blob);
      if (navigator.share) {
        navigator.share({ title: 'کوییز موز 🍌', text: text }).catch(function () { /* لغو شد */ });
      } else {
        toast('عکس پرونده ذخیره شد! 📸 حالا از گالری بفرستش');
      }
    });
  }

  /* ---------- اتصال رویدادها و شروع ---------- */
  function init() {
    $('btn-enter').addEventListener('click', enterSite);
    $('player-name').addEventListener('keydown', function (e) { if (e.key === 'Enter') enterSite(); });
    $('player-nick').addEventListener('keydown', function (e) { if (e.key === 'Enter') enterSite(); });

    $('btn-start').addEventListener('click', showCategoryScreen);
    $('btn-logout').addEventListener('click', function () { show('screen-entry'); });

    $('btn-cat-back').addEventListener('click', goHome);

    $('btn-share').addEventListener('click', shareResult);
    $('btn-again').addEventListener('click', showCategoryScreen);
    $('btn-newplayer').addEventListener('click', function () { show('screen-entry'); });

    /* پر کردن خودکار فرم از ذخیرهٔ قبلی */
    var p = getPlayer();
    if (p) {
      $('player-name').value = p.name || '';
      $('player-nick').value = p.nick || '';
    }
    show('screen-entry');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
