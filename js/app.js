/* ============================================================
   存款安全感测试 · 主逻辑 v2
   后端：Supabase（云端密码校验 + 全局次数统计）
   回退：SUPABASE_URL 为空时走本地 localStorage 模式
   流程：密码门 → 开始页 → 答题（可回退）→ 结果页
   支持：长图保存 / 分享链接 / 再测一次 / 好评有礼
   ============================================================ */

(function () {
  "use strict";

  var USAGE_KEY = "cka_pwd_usage_v1";
  var CURRENT_PWD_KEY = "cka_current_pwd";
  var DEVICE_KEY = "cka_device_id";

  /* ---------- 工具 ---------- */
  function getUsage() {
    try { return JSON.parse(localStorage.getItem(USAGE_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function setUsage(obj) { localStorage.setItem(USAGE_KEY, JSON.stringify(obj)); }

  function normalizePwd(s) { return (s || "").trim().toUpperCase(); }

  function showToast(msg) {
    var t = document.getElementById("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._timer);
    t._timer = setTimeout(function () { t.classList.remove("show"); }, 2200);
  }

  function showScreen(id) {
    var screens = document.querySelectorAll(".screen");
    for (var i = 0; i < screens.length; i++) screens[i].classList.remove("active");
    document.getElementById(id).classList.add("active");
    window.scrollTo(0, 0);
  }

  function b64encode(str) {
    return btoa(unescape(encodeURIComponent(str))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function b64decode(s) {
    s = s.replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    return decodeURIComponent(escape(atob(s)));
  }

  /* ---------- Supabase 访问层 ---------- */
  function sbEnabled() { return !!(SUPABASE_URL && SUPABASE_ANON_KEY); }

  function getDeviceId() {
    var d = localStorage.getItem(DEVICE_KEY);
    if (!d) {
      d = (crypto && crypto.randomUUID)
        ? crypto.randomUUID()
        : "dev-" + Date.now() + "-" + Math.random().toString(36).slice(2);
      localStorage.setItem(DEVICE_KEY, d);
    }
    return d;
  }

  function sbRPC(fn, args) {
    return fetch(SUPABASE_URL + "/rest/v1/rpc/" + fn, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": "Bearer " + SUPABASE_ANON_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(args)
    }).then(function (r) {
      if (!r.ok) throw new Error("rpc " + fn + " failed: " + r.status);
      return r.json();
    });
  }

  // 返回：{ok, remain, reason}
  function cloudCheckPassword(pwd) {
    return sbRPC("check_password", { p_code: pwd }).then(function (ok) {
      if (!ok) return { ok: false, reason: "wrong" };
      return sbRPC("get_remaining_uses", { p_code: pwd, p_device: getDeviceId() })
        .then(function (n) {
          if (n <= 0) return { ok: false, reason: "exhausted" };
          return { ok: true, remain: n };
        });
    });
  }

  function cloudConsumeUse(pwd) {
    return sbRPC("consume_test_use", { p_code: pwd, p_device: getDeviceId(), p_max: MAX_USES_PER_DEVICE })
      .then(function (n) {
        if (n === -1) return { ok: false, reason: "wrong" };
        if (n === -2) return { ok: false, reason: "exhausted" };
        return { ok: true, used: n };
      });
  }

  /* ---------- 测评计算 ---------- */
  function computeResult(answers) {
    var dims = { D1: 0, D2: 0, D3: 0, D4: 0 };
    QUESTIONS.forEach(function (q, idx) { dims[q.dim] += answers[idx]; });
    var total = answers.reduce(function (a, b) { return a + b; }, 0);
    // 归一化到 0-100：最低 12 分，最高 48 分，区间跨度 36
    var index = Math.min(100, Math.round((total - 12) / 36 * 100));

    var typeKey;
    if (total >= 40 && dims.D4 >= 10) typeKey = "beaver";
    else if (total >= 40 && dims.D4 < 10) typeKey = "squirrel";
    else if (dims.D3 <= 7 && dims.D4 > 7) typeKey = "flamingo";
    else if (dims.D3 <= 7 && dims.D4 <= 7) typeKey = "tide";
    else if (dims.D1 <= 6 && dims.D4 > 7) typeKey = "ostrich";
    else typeKey = "kite";

    return {
      total: total, index: index, dims: dims, typeKey: typeKey,
      badges: computeBadges(answers, dims)
    };
  }

  function tierLabel(index) {
    for (var i = 0; i < TIER_LABELS.length; i++) {
      if (index >= TIER_LABELS[i].min) return TIER_LABELS[i].label;
    }
    return TIER_LABELS[TIER_LABELS.length - 1].label;
  }

  /* ---------- 雷达图（SVG） ---------- */
  function radarSVG(dims) {
    var cx = 130, cy = 105, R = 78;
    // 4 轴：上 D2 应急缓冲 / 右 D3 消费决策 / 下 D4 金钱情绪 / 左 D1 现金流掌控
    var axes = [
      { key: "D2", label: "应急缓冲", ang: -90 },
      { key: "D3", label: "消费决策", ang: 0 },
      { key: "D4", label: "金钱情绪", ang: 90 },
      { key: "D1", label: "现金流掌控", ang: 180 }
    ];
    function pt(ang, r) {
      var rad = ang * Math.PI / 180;
      return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
    }
    var svg = '<svg width="260" height="150" viewBox="0 0 260 150" xmlns="http://www.w3.org/2000/svg">';
    [1, 0.66, 0.33].forEach(function (f) {
      var p = axes.map(function (a) { return pt(a.ang, R * f).join(","); }).join(" ");
      svg += '<polygon points="' + p + '" fill="none" stroke="#dfe7e1" stroke-width="1"/>';
    });
    axes.forEach(function (a) {
      var p = pt(a.ang, R);
      svg += '<line x1="' + cx + '" y1="' + cy + '" x2="' + p[0] + '" y2="' + p[1] + '" stroke="#dfe7e1" stroke-width="1"/>';
    });
    var data = axes.map(function (a) {
      return pt(a.ang, R * (dims[a.key] / 12));
    });
    var pts = data.map(function (p) { return p.join(","); }).join(" ");
    svg += '<polygon points="' + pts + '" fill="rgba(31,122,90,0.28)" stroke="#1f7a5a" stroke-width="2"/>';
    data.forEach(function (p) {
      svg += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="3" fill="#1f7a5a"/>';
    });
    axes.forEach(function (a) {
      var p = pt(a.ang, R + 15);
      var anchor = "middle", dy = 4;
      if (a.ang === 0) anchor = "start";
      if (a.ang === 180) anchor = "end";
      if (a.ang === -90) dy = 0;
      if (a.ang === 90) dy = 12;
      svg += '<text x="' + p[0] + '" y="' + (p[1] + dy) + '" text-anchor="' + anchor +
        '" font-size="11" fill="#7a847e">' + a.label + " " + dims[a.key] + "</text>";
    });
    svg += "</svg>";
    return svg;
  }

  /* ---------- 结果渲染 ---------- */
  function renderResult(result) {
    var type = TYPES[result.typeKey];

    var card = document.getElementById("resultCard");
    card.style.setProperty("--t1", type.theme[0]);
    card.style.setProperty("--t2", type.theme[1]);
    card.style.setProperty("--t3", type.theme[2]);

    document.getElementById("rcTier").textContent = tierLabel(result.index);
    document.getElementById("rcEmoji").textContent = type.emoji;
    document.getElementById("rcName").textContent = type.name;
    document.getElementById("rcSubtitle").textContent = type.subtitle;
    document.getElementById("rcPersona").textContent = type.persona;
    document.getElementById("rcIndex").innerHTML = result.index + "<small> / 100</small>";
    document.getElementById("rcBarFill").style.width = result.index + "%";
    document.getElementById("rcRadar").innerHTML = radarSVG(result.dims);
    document.getElementById("rcCopy").textContent = type.copy;
    document.getElementById("rcTheoryTitle").textContent = type.theoryTitle;
    document.getElementById("rcTheory").textContent = type.theory;
    document.getElementById("rcRiskTitle").textContent = type.riskTitle;
    document.getElementById("rcRisk").textContent = type.risk;

    var ol = document.getElementById("rcActions");
    ol.innerHTML = "";
    type.actions.forEach(function (a) {
      var li = document.createElement("li");
      li.textContent = a;
      ol.appendChild(li);
    });

    var badgesBox = document.getElementById("rcBadges");
    badgesBox.innerHTML = "";
    result.badges.forEach(function (b) {
      var span = document.createElement("span");
      span.className = "badge-chip";
      span.textContent = b.icon + " " + b.name;
      span.title = b.desc;
      badgesBox.appendChild(span);
    });

    document.getElementById("rcQuote").textContent = type.quote.replace("{index}", result.index);

    showScreen("screen-result");
  }

  /* ---------- 密码门 ---------- */
  var currentPwd = sessionStorage.getItem(CURRENT_PWD_KEY) || "";

  function localRemaining(pwd) {
    var usage = getUsage();
    return Math.max(0, MAX_USES_PER_DEVICE - (usage[pwd] || 0));
  }

  function tryUnlock() {
    var input = document.getElementById("pwdInput");
    var msg = document.getElementById("gateMsg");
    var pwd = normalizePwd(input.value);

    if (!pwd) { msg.textContent = "请输入测评密码"; msg.className = "gate-msg err"; return; }
    msg.textContent = "验证中…"; msg.className = "gate-msg";

    if (sbEnabled()) {
      cloudCheckPassword(pwd).then(function (res) {
        if (!res.ok) {
          msg.textContent = res.reason === "wrong"
            ? "密码不正确，请检查后重试"
            : "该密码的 3 次机会已用完，如需再测请购买新密码";
          msg.className = "gate-msg err";
          return;
        }
        msg.textContent = "解锁成功！剩余 " + res.remain + " 次机会";
        msg.className = "gate-msg ok";
        currentPwd = pwd;
        sessionStorage.setItem(CURRENT_PWD_KEY, pwd);
        setTimeout(gotoIntro, 500);
      }).catch(function () {
        // 云端不可达（网络受限）→ 自动降级为本地校验，保证网站始终可用
        localUnlock(pwd);
      });
      return;
    }

    localUnlock(pwd);
  }

  // 本地校验分支（云端不可用时的兜底）
  function localUnlock(pwd) {
    var msg = document.getElementById("gateMsg");
    if (PASSWORDS.indexOf(pwd) === -1) {
      msg.textContent = "密码不正确，请检查后重试";
      msg.className = "gate-msg err";
      return;
    }
    var remain = localRemaining(pwd);
    if (remain <= 0) {
      msg.textContent = "该密码的 3 次机会已用完，如需再测请购买新密码";
      msg.className = "gate-msg err";
      return;
    }
    msg.textContent = "解锁成功！剩余 " + remain + " 次机会";
    msg.className = "gate-msg ok";
    currentPwd = pwd;
    sessionStorage.setItem(CURRENT_PWD_KEY, pwd);
    setTimeout(gotoIntro, 500);
  }

  function gotoIntro() {
    var el = document.getElementById("remainCount");
    if (sbEnabled() && currentPwd) {
      sbRPC("get_remaining_uses", { p_code: currentPwd, p_device: getDeviceId() })
        .then(function (n) { el.textContent = n; })
        .catch(function () { el.textContent = localRemaining(currentPwd); });
    } else {
      el.textContent = localRemaining(currentPwd);
    }
    showScreen("screen-intro");
  }

  /* ---------- 答题流程 ---------- */
  var answers = [];
  var qIndex = 0;

  function startQuiz() {
    if (sbEnabled() && currentPwd) {
      sbRPC("get_remaining_uses", { p_code: currentPwd, p_device: getDeviceId() })
        .then(function (n) {
          if (n <= 0) { showToast("该密码次数已用完，请输入新密码"); showScreen("screen-gate"); return; }
          answers = []; qIndex = 0;
          showScreen("screen-quiz");
          renderQuestion();
        })
        .catch(function () {
          // 云端不可达 → 本地兜底
          if (localRemaining(currentPwd) <= 0) {
            showToast("该密码次数已用完，请输入新密码");
            showScreen("screen-gate");
            return;
          }
          answers = []; qIndex = 0;
          showScreen("screen-quiz");
          renderQuestion();
        });
      return;
    }
    if (!sbEnabled() && localRemaining(currentPwd) <= 0) {
      showToast("该密码次数已用完，请输入新密码");
      showScreen("screen-gate");
      return;
    }
    answers = []; qIndex = 0;
    showScreen("screen-quiz");
    renderQuestion();
  }

  function renderQuestion() {
    var q = QUESTIONS[qIndex];
    document.getElementById("progressText").textContent = (qIndex + 1) + "/" + QUESTIONS.length;
    document.getElementById("progressFill").style.width = ((qIndex) / QUESTIONS.length * 100) + "%";
    document.getElementById("qTag").textContent = "第 " + (qIndex + 1) + " 题 · 共 " + QUESTIONS.length + " 题";
    document.getElementById("qText").textContent = q.text;

    var box = document.getElementById("optionsBox");
    box.innerHTML = "";
    q.options.forEach(function (opt) {
      var btn = document.createElement("button");
      btn.className = "option-btn";
      btn.textContent = opt.t;
      btn.addEventListener("click", function () {
        var all = box.querySelectorAll(".option-btn");
        for (var i = 0; i < all.length; i++) all[i].classList.remove("picked");
        btn.classList.add("picked");
        answers[qIndex] = opt.s;
        setTimeout(function () {
          if (qIndex < QUESTIONS.length - 1) {
            qIndex++;
            renderQuestion();
          } else {
            finishQuiz();
          }
        }, 240);
      });
      if (answers[qIndex] !== undefined && answers[qIndex] === opt.s) btn.classList.add("picked");
      box.appendChild(btn);
    });

    document.getElementById("btnPrev").disabled = qIndex === 0;
  }

  function goPrev() {
    if (qIndex > 0) { qIndex--; renderQuestion(); }
  }

  function finishQuiz() {
    var result = computeResult(answers);
    lastResult = result;

    function done() {
      sessionStorage.removeItem(CURRENT_PWD_KEY);
      currentPwd = "";
      renderResult(result);
    }

    if (sbEnabled() && currentPwd) {
      cloudConsumeUse(currentPwd).then(done).catch(function () {
        // 云端失败不阻塞用户看结果，本地也记一笔
        var usage = getUsage();
        usage[currentPwd] = (usage[currentPwd] || 0) + 1;
        setUsage(usage);
        done();
      });
      return;
    }

    // 本地模式
    var usage = getUsage();
    usage[currentPwd] = (usage[currentPwd] || 0) + 1;
    setUsage(usage);
    done();
  }

  /* ---------- 分享链接 ---------- */
  var lastResult = null;

  function buildShareURL(result) {
    var payload = {
      v: 1, t: result.typeKey, i: result.index,
      d: [result.dims.D1, result.dims.D2, result.dims.D3, result.dims.D4]
    };
    var base = location.origin + location.pathname;
    return base + "#r=" + b64encode(JSON.stringify(payload));
  }

  function loadFromHash() {
    var m = location.hash.match(/#r=([A-Za-z0-9\-_]+)/);
    if (!m) return false;
    try {
      var p = JSON.parse(b64decode(m[1]));
      if (!TYPES[p.t]) return false;
      lastResult = {
        typeKey: p.t, index: p.i,
        dims: { D1: p.d[0], D2: p.d[1], D3: p.d[2], D4: p.d[3] },
        badges: computeBadges([], { D1: p.d[0], D2: p.d[1], D3: p.d[2], D4: p.d[3] })
      };
      renderResult(lastResult);
      return true;
    } catch (e) { return false; }
  }

  /* ---------- 保存长图 ---------- */
  function saveImage() {
    showToast("正在生成图片…");
    var node = document.getElementById("resultCard");
    html2canvas(node, { scale: 2, useCORS: true, backgroundColor: "#ffffff" }).then(function (canvas) {
      var dataURL = canvas.toDataURL("image/png");
      document.getElementById("resultImg").src = dataURL;
      document.getElementById("btnDownloadImg").href = dataURL;
      document.getElementById("imgModal").classList.add("active");
    }).catch(function (err) {
      console.error(err);
      showToast("生成失败，请重试");
    });
  }

  /* ---------- 复制链接 ---------- */
  function copyShareLink() {
    if (!lastResult) return;
    var url = buildShareURL(lastResult);
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); showToast("链接已复制，快去分享吧"); }
      catch (e) { showToast("复制失败，请长按地址栏复制"); }
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () {
        showToast("链接已复制，快去分享吧");
      }).catch(fallback);
    } else { fallback(); }
  }

  /* ---------- 再测一次 ---------- */
  function retake() {
    var savedPwd = sessionStorage.getItem(CURRENT_PWD_KEY) || "";
    if (sbEnabled()) {
      if (!savedPwd) { showScreen("screen-gate"); return; }
      currentPwd = savedPwd;
      sbRPC("get_remaining_uses", { p_code: savedPwd, p_device: getDeviceId() })
        .then(function (n) {
          if (n <= 0) { showToast("该密码次数已用完，请输入新密码"); showScreen("screen-gate"); return; }
          gotoIntro();
        })
        .catch(function () {
          if (localRemaining(savedPwd) <= 0) {
            showToast("该密码次数已用完，请输入新密码");
            showScreen("screen-gate");
            return;
          }
          gotoIntro();
        });
      return;
    }
    if (!savedPwd) { showScreen("screen-gate"); return; }
    currentPwd = savedPwd;
    if (localRemaining(savedPwd) <= 0) {
      showToast("该密码次数已用完，请输入新密码");
      showScreen("screen-gate");
      return;
    }
    gotoIntro();
  }

  /* ---------- 事件绑定 ---------- */
  document.getElementById("btnUnlock").addEventListener("click", tryUnlock);
  document.getElementById("pwdInput").addEventListener("keydown", function (e) {
    if (e.key === "Enter") tryUnlock();
  });
  document.getElementById("btnStart").addEventListener("click", startQuiz);
  document.getElementById("btnPrev").addEventListener("click", goPrev);
  document.getElementById("btnSaveImg").addEventListener("click", saveImage);
  document.getElementById("btnCopyLink").addEventListener("click", copyShareLink);
  document.getElementById("btnRetake").addEventListener("click", retake);

  document.getElementById("btnGift").addEventListener("click", function () {
    document.getElementById("giftModal").classList.add("active");
  });
  document.getElementById("btnCloseGiftModal").addEventListener("click", function () {
    document.getElementById("giftModal").classList.remove("active");
  });
  document.getElementById("btnCloseImgModal").addEventListener("click", function () {
    document.getElementById("imgModal").classList.remove("active");
  });
  document.getElementById("giftModal").addEventListener("click", function (e) {
    if (e.target === this) this.classList.remove("active");
  });
  document.getElementById("imgModal").addEventListener("click", function (e) {
    if (e.target === this) this.classList.remove("active");
  });

  /* ---------- 启动 ---------- */
  (function init() {
    if (!loadFromHash()) {
      showScreen("screen-gate");
    }
  })();

})();
