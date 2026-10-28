/* 中式梦核 — v5 cinematic scroll + memory ledger */
(() => {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isTouch = matchMedia("(hover: none), (pointer: coarse)").matches;
  if (isTouch) document.body.classList.add("is-touch");

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const THESIS = "你好像来过这里，但记不起是第几次。";
  const LEDGER_KEY = "dreamcore-ledger-v2";
  const SHARD_TOTAL = 10;

  /* ---------- story copy · 没走成的那一晚 ---------- */
  const CHOICE_WHISPER = {
    cafe: {
      login: "那台机器认识你。卡号亮了一下。",
      fan: "风扇停了。聊天窗口更清楚——我马上到。",
    },
    stair: {
      intercom: "铃在空楼里散开。没有脚步。",
      up: "口袋沉了一下。一枚硬币。",
    },
    wait: {
      sit: "你坐下。形状对上了。车仍不来。",
      wipe: "雾后是空站台。字还在：走。",
    },
  };

  const AFTERMATH = {
    cafe: {
      login: {
        beat: "号挂上了。像是你的，又像借来的。有人等你登完再走。",
        hint: "回走廊。楼道那盏灯，也许认得这串号。",
      },
      fan: {
        beat: "风停了。屏幕更刺眼。有人会回来关——或者不会。",
        hint: "回走廊。还有门缝漏着光。",
      },
    },
    stair: {
      intercom: {
        beat: "再按一次。对讲里只有电流。四楼的灯颤了一下。",
        hint: "回走廊。梦还没做完。",
      },
      up: {
        beat: "你没下楼。台阶往上更暗。硬币在掌心还温。",
        hint: "回走廊。候车室也许用得着它。",
      },
    },
    wait: {
      sit: {
        beat: "蓝椅接住你。广播沙沙响。这一晚，车没有开过来。",
        hint: "回走廊。或者向下，去把字拼完。",
      },
      wipe: {
        beat: "雾开一线。外面空着。玻璃上未写完的字，露出来了。",
        hint: "回走廊。残响里也许能读全。",
      },
    },
  };

  const CORRIDOR_AFTER = {
    cafe: {
      login: "还亮着的那台，登过了。卡号跟着你。",
      fan: "风扇停了。网吧更安静。像有人刚起身。",
    },
    stair: {
      intercom: "对讲里没人接。灯还亮着。",
      up: "硬币还温。往上的灯更暗。",
    },
    wait: {
      sit: "椅子留着你的温度。车没来。",
      wipe: "雾开了。未写完的字，还在玻璃上。",
    },
  };

  const CAPTION_AFTER = {
    cafe: {
      login: "有光的门，有人登过号。",
      fan: "风停了。灯管还在响。",
    },
    stair: {
      intercom: "绿墙旁，对讲灯还亮。",
      up: "绿墙往上，口袋里有硬币。",
    },
    wait: {
      sit: "有光的门，车还没来。",
      wipe: "雾散了一线。字还没写完。",
    },
  };

  const WAKE_VARIANTS = {
    dawn: {
      lines: ["天亮了。", "你什么也没带上。", "像从没打算走。"],
    },
    forgot: {
      lines: ["几乎忘了。", "绿墙还在。", "那晚的门，没关上。"],
    },
    more: {
      lines: ["记得更多。", "三处的灯都亮过。", "还是没走到外面。"],
    },
    waiting: {
      lines: ["有人在等。", "蓝椅是空的。你不在。", "车开过了。或者没有。"],
    },
    lights: {
      lines: ["灯还没关。", "像有人刚走。", "又像你还坐在那里。"],
    },
    loop: {
      lines: [
        "卡号、硬币、未写完的字。",
        "这一次，链条接上了。",
        "天亮了。走廊还亮着。",
        "你好像还会再来。",
      ],
    },
    stay: {
      lines: ["你没有走。", "风扇关了。对讲静了。雾开了。", "梦把你送回同一扇门。"],
    },
  };

  /* ---------- memory ledger ---------- */
  function blankLedger() {
    return {
      shards: [],
      choices: {},
      visited: {},
      visitOrder: [],
      explored: {},
      exploredTokens: {},
      corridorSaid: {},
      captionSlot: null,
      hintsSaid: {},
      aftermath: {},
    };
  }

  function loadLedger() {
    try {
      const raw = sessionStorage.getItem(LEDGER_KEY);
      if (!raw) return blankLedger();
      const parsed = JSON.parse(raw);
      return {
        ...blankLedger(),
        ...parsed,
        shards: Array.isArray(parsed.shards) ? parsed.shards : [],
        choices: parsed.choices && typeof parsed.choices === "object" ? parsed.choices : {},
        visited: parsed.visited && typeof parsed.visited === "object" ? parsed.visited : {},
        visitOrder: Array.isArray(parsed.visitOrder) ? parsed.visitOrder : [],
        explored: parsed.explored && typeof parsed.explored === "object" ? parsed.explored : {},
        exploredTokens: parsed.exploredTokens && typeof parsed.exploredTokens === "object" ? parsed.exploredTokens : {},
        corridorSaid: parsed.corridorSaid && typeof parsed.corridorSaid === "object" ? parsed.corridorSaid : {},
        hintsSaid: parsed.hintsSaid && typeof parsed.hintsSaid === "object" ? parsed.hintsSaid : {},
        aftermath: parsed.aftermath && typeof parsed.aftermath === "object" ? parsed.aftermath : {},
      };
    } catch {
      return blankLedger();
    }
  }

  function saveLedger() {
    try {
      sessionStorage.setItem(LEDGER_KEY, JSON.stringify(ledger));
    } catch { /* private mode */ }
  }

  let ledger = loadLedger();

  const memoryTally = $("#memoryTally");
  const memoryCount = $("#memoryCount");
  const memoryTotal = $("#memoryTotal");
  if (memoryTotal) memoryTotal.textContent = String(SHARD_TOTAL);

  function refreshTally() {
    const n = ledger.shards.length;
    if (memoryCount) memoryCount.textContent = String(n);
    if (!memoryTally) return;
    if (n > 0) {
      memoryTally.hidden = false;
      memoryTally.classList.add("is-on");
    } else {
      memoryTally.hidden = true;
      memoryTally.classList.remove("is-on");
    }
  }

  function hasShard(id) {
    return ledger.shards.includes(id);
  }

  function collectShard(id) {
    if (!id || hasShard(id)) return false;
    ledger.shards.push(id);
    saveLedger();
    refreshTally();
    return true;
  }

  function markVisited(roomId) {
    if (!roomId) return;
    const first = !ledger.visited[roomId];
    ledger.visited[roomId] = true;
    if (first) {
      ledger.visitOrder = Array.isArray(ledger.visitOrder) ? ledger.visitOrder : [];
      if (!ledger.visitOrder.includes(roomId)) ledger.visitOrder.push(roomId);
    }
    saveLedger();
  }

  function setChoice(roomId, choice) {
    ledger.choices[roomId] = choice;
    saveLedger();
  }

  function visitedBefore(roomId, otherId) {
    const order = ledger.visitOrder || [];
    const a = order.indexOf(otherId);
    const b = order.indexOf(roomId);
    return a !== -1 && (b === -1 || a < b);
  }

  function chainComplete() {
    return hasShard("stair-ticket") && hasShard("wait-coin") && hasShard("wait-letter");
  }

  function choiceCount() {
    return Object.keys(ledger.choices).length;
  }

  /* ---------- cursor ---------- */
  const cursor = $("#cursor");
  if (!isTouch && cursor) {
    let x = 0, y = 0, tx = 0, ty = 0;
    window.addEventListener("mousemove", (e) => {
      tx = e.clientX; ty = e.clientY;
      cursor.classList.add("is-on");
    }, { passive: true });
    const tick = () => {
      x += (tx - x) * 0.18;
      y += (ty - y) * 0.18;
      cursor.style.transform = `translate(${x}px, ${y}px) translate(-50%,-50%)`;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    const hoverables = "a, button, .portal, .mute, .wake__replay, .room__back, .enter__go, .frag, .echo, .memspot, .map-toggle, .map-overlay__close, .room__choice-btn, .room__aftermath";
    document.addEventListener("mouseover", (e) => {
      if (e.target.closest(hoverables)) cursor.classList.add("is-hover");
    });
    document.addEventListener("mouseout", (e) => {
      if (e.target.closest(hoverables)) cursor.classList.remove("is-hover");
    });
  }

  /* ---------- ambient audio ---------- */
  let audioCtx = null, masterGain = null, analyser = null, muted = true;
  let dingTimer = null, eqRaf = null;
  const muteBtn = $("#mute");
  const eqCanvas = $("#eqCanvas");
  const eqCtx = eqCanvas?.getContext?.("2d");

  function ensureAudio() {
    if (audioCtx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audioCtx = new AC();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0;
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 64;
    masterGain.connect(analyser);
    analyser.connect(audioCtx.destination);

    const bufferSize = audioCtx.sampleRate * 3;
    const noiseBuf = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
    const noise = audioCtx.createBufferSource();
    noise.buffer = noiseBuf;
    noise.loop = true;
    const filter = audioCtx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 280;
    filter.Q.value = 0.4;
    const humGain = audioCtx.createGain();
    humGain.gain.value = 0.038;
    noise.connect(filter); filter.connect(humGain); humGain.connect(masterGain);
    noise.start();

    const buzz = audioCtx.createOscillator();
    buzz.type = "sawtooth";
    buzz.frequency.value = 60;
    const buzz2 = audioCtx.createOscillator();
    buzz2.type = "sine";
    buzz2.frequency.value = 120;
    const buzzFilter = audioCtx.createBiquadFilter();
    buzzFilter.type = "bandpass";
    buzzFilter.frequency.value = 120;
    buzzFilter.Q.value = 12;
    const buzzGain = audioCtx.createGain();
    buzzGain.gain.value = 0.0032;
    buzz.connect(buzzFilter);
    buzz2.connect(buzzGain);
    buzzFilter.connect(buzzGain);
    buzzGain.connect(masterGain);
    buzz.start(); buzz2.start();

    const drone = audioCtx.createOscillator();
    drone.type = "sine";
    drone.frequency.value = 55;
    const drone2 = audioCtx.createOscillator();
    drone2.type = "triangle";
    drone2.frequency.value = 82.5;
    const droneGain = audioCtx.createGain();
    droneGain.gain.value = 0.012;
    drone.connect(droneGain); drone2.connect(droneGain); droneGain.connect(masterGain);
    drone.start(); drone2.start();

    const lfo = audioCtx.createOscillator();
    lfo.frequency.value = 0.05;
    const lfoGain = audioCtx.createGain();
    lfoGain.gain.value = 0.004;
    lfo.connect(lfoGain); lfoGain.connect(droneGain.gain); lfo.start();

    scheduleDing();
    startEq();
  }

  function playDing() {
    if (!audioCtx || muted) return;
    const t = audioCtx.currentTime;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    const f = audioCtx.createBiquadFilter();
    o.type = "sine";
    o.frequency.setValueAtTime(880, t);
    o.frequency.exponentialRampToValueAtTime(440, t + 0.4);
    f.type = "lowpass"; f.frequency.value = 1600;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.06, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
    o.connect(f); f.connect(g); g.connect(masterGain);
    o.start(t); o.stop(t + 1.6);
  }

  function playIntercom() {
    if (!audioCtx || muted) return;
    const t = audioCtx.currentTime;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    const f = audioCtx.createBiquadFilter();
    o.type = "square";
    o.frequency.setValueAtTime(620, t);
    o.frequency.linearRampToValueAtTime(480, t + 0.18);
    f.type = "bandpass"; f.frequency.value = 900; f.Q.value = 4;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.045, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    o.connect(f); f.connect(g); g.connect(masterGain);
    o.start(t); o.stop(t + 0.4);
    setTimeout(() => {
      if (!audioCtx || muted) return;
      const t2 = audioCtx.currentTime;
      const o2 = audioCtx.createOscillator();
      const g2 = audioCtx.createGain();
      const f2 = audioCtx.createBiquadFilter();
      o2.type = "square";
      o2.frequency.setValueAtTime(640, t2);
      o2.frequency.linearRampToValueAtTime(500, t2 + 0.16);
      f2.type = "bandpass"; f2.frequency.value = 950; f2.Q.value = 4;
      g2.gain.setValueAtTime(0.0001, t2);
      g2.gain.exponentialRampToValueAtTime(0.038, t2 + 0.02);
      g2.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.32);
      o2.connect(f2); f2.connect(g2); g2.connect(masterGain);
      o2.start(t2); o2.stop(t2 + 0.36);
    }, 420);
  }

  function playBootClick() {
    if (!audioCtx || muted) return;
    const t = audioCtx.currentTime;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.08);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.08, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(g); g.connect(masterGain);
    o.start(t); o.stop(t + 0.14);
  }

  function playSoftChime() {
    if (!audioCtx || muted) return;
    const t = audioCtx.currentTime;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(660, t);
    o.frequency.exponentialRampToValueAtTime(990, t + 0.25);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.035, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    o.connect(g); g.connect(masterGain);
    o.start(t); o.stop(t + 1.0);
  }

  function scheduleDing() {
    if (dingTimer) clearTimeout(dingTimer);
    dingTimer = setTimeout(() => {
      if (!muted) playDing();
      scheduleDing();
    }, 16000 + Math.random() * 24000);
  }

  function startEq() {
    if (!eqCtx || !eqCanvas || eqRaf) return;
    const buf = new Uint8Array(32);
    const draw = () => {
      eqRaf = requestAnimationFrame(draw);
      eqCtx.clearRect(0, 0, eqCanvas.width, eqCanvas.height);
      if (!analyser || muted) {
        eqCtx.fillStyle = "rgba(200,232,168,0.25)";
        for (let i = 0; i < 6; i++) {
          eqCtx.fillRect(i * 6, 10, 3, 2);
        }
        return;
      }
      analyser.getByteFrequencyData(buf);
      eqCtx.fillStyle = "rgba(200,232,168,0.7)";
      for (let i = 0; i < 6; i++) {
        const v = buf[i * 4] / 255;
        const h = Math.max(2, v * 12);
        eqCtx.fillRect(i * 6, 12 - h, 3, h);
      }
    };
    draw();
  }

  function setMuted(next) {
    muted = next;
    muteBtn?.setAttribute("aria-pressed", muted ? "true" : "false");
    const label = muteBtn?.querySelector(".mute__label");
    if (label) label.textContent = muted ? "静音" : "声响";
    if (!masterGain || !audioCtx) return;
    const t = audioCtx.currentTime;
    masterGain.gain.cancelScheduledValues(t);
    masterGain.gain.linearRampToValueAtTime(muted ? 0 : 1, t + 0.4);
  }

  muteBtn?.addEventListener("click", () => {
    ensureAudio();
    audioCtx?.resume();
    setMuted(!muted);
    if (!muted) playBootClick();
  });

  /* ---------- thesis ---------- */
  const thesisEl = $("#thesis");
  const enterGo = $("#enterGo");
  const enterFlicker = $("#enterFlicker");

  function typeThesis() {
    if (!thesisEl) return Promise.resolve();
    if (reduced) {
      thesisEl.textContent = THESIS;
      enterGo?.classList.add("is-ready");
      return Promise.resolve();
    }
    enterFlicker?.classList.add("is-blink");
    return new Promise((resolve) => {
      let i = 0;
      thesisEl.innerHTML = '<span class="caret"></span>';
      const tick = () => {
        if (i <= THESIS.length) {
          thesisEl.innerHTML = THESIS.slice(0, i) + '<span class="caret"></span>';
          i++;
          setTimeout(tick, 55 + Math.random() * 40);
        } else {
          thesisEl.textContent = THESIS;
          enterGo?.classList.add("is-ready");
          resolve();
        }
      };
      setTimeout(tick, 600);
    });
  }

  enterGo?.addEventListener("click", () => {
    ensureAudio();
    playBootClick();
    const target = $("#corridor");
    if (window.lenis && target) window.lenis.scrollTo(target, { offset: 0, duration: 1.4 });
    else target?.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
  });

  /* ---------- chapter mark ---------- */
  const chapterMark = $("#chapterMark");
  const lightLeak = $("#lightLeak");

  function setChapter(name) {
    if (!chapterMark) return;
    if (!name) {
      chapterMark.classList.remove("is-on");
      return;
    }
    chapterMark.textContent = name;
    chapterMark.classList.add("is-on");
  }

  /* ---------- Lenis + ScrollTrigger ---------- */
  let lenis = null;

  function bootScroll() {
    if (typeof Lenis === "undefined" || typeof gsap === "undefined") {
      setTimeout(bootScroll, 50);
      return;
    }
    gsap.registerPlugin(ScrollTrigger);

    if (!reduced) {
      lenis = new Lenis({
        duration: 1.4,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
      });
      window.lenis = lenis;
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add((time) => lenis.raf(time * 1000));
      gsap.ticker.lagSmoothing(0);
    }

    $$(".act[data-chapter]").forEach((sec) => {
      ScrollTrigger.create({
        trigger: sec,
        start: "top 55%",
        end: "bottom 45%",
        onEnter: () => setChapter(sec.dataset.chapter),
        onEnterBack: () => setChapter(sec.dataset.chapter),
      });
    });

    const stack = $("#corridorStack");
    const detail = $(".corridor__plate--detail");
    const tile = $(".corridor__plate--tile");
    const handle = $(".corridor__plate--handle");
    const hint = $("#corridorHint");
    const caps = $$(".scrub-cap");

    if (stack) {
      if (reduced) {
        if (detail) detail.style.opacity = "0.35";
        if (tile) tile.style.opacity = "0.2";
      } else {
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: "#corridor",
            start: "top top",
            end: "bottom bottom",
            scrub: 0.7,
          },
        });
        tl.fromTo(stack, { y: "0%" }, { y: "-10%", ease: "none" }, 0)
          .fromTo(".corridor__plate--hero", { scale: 1.1 }, { scale: 1.0, ease: "none" }, 0)
          .fromTo(tile, { opacity: 0, x: "4%" }, { opacity: 0.42, x: "-2%", ease: "none" }, 0.08)
          .fromTo(detail, { opacity: 0, y: "10%" }, { opacity: 0.4, y: "-2%", ease: "none" }, 0.22)
          .fromTo(handle, { opacity: 0, scale: 1.15 }, { opacity: 0.55, scale: 1.0, ease: "none" }, 0.55)
          .fromTo(".corridor__mist", { opacity: 0.35 }, { opacity: 0.95, ease: "none" }, 0)
          .to(hint, { opacity: 0, ease: "none" }, 0.2);

        if (caps.length) {
          caps.forEach((cap) => {
            gsap.set(cap, { opacity: 0, y: 0 });
            cap.classList.remove("is-live");
          });
          const capTl = gsap.timeline({
            scrollTrigger: {
              trigger: "#corridor",
              start: "top top",
              end: "bottom bottom",
              scrub: 0.65,
              onUpdate: (self) => {
                document.body.classList.toggle("is-corridor-captioning", self.progress > 0.08 && self.progress < 0.92);
              },
            },
          });
          const slots = [
            [0.10, 0.14, 0.26, 0.30],
            [0.34, 0.38, 0.50, 0.54],
            [0.58, 0.62, 0.74, 0.78],
          ];
          caps.forEach((cap, i) => {
            const [a, b, c, d] = slots[i] || slots[slots.length - 1];
            capTl.call(() => {
              caps.forEach((other) => {
                if (other !== cap) {
                  other.classList.remove("is-live");
                  gsap.set(other, { opacity: 0 });
                }
              });
              cap.classList.add("is-live");
            }, null, a);
            capTl.fromTo(cap, { opacity: 0, y: 10 }, { opacity: 1, y: 0, ease: "none", duration: b - a }, a);
            capTl.to(cap, { opacity: 0, y: -8, ease: "none", duration: d - c }, c);
            capTl.call(() => { cap.classList.remove("is-live"); }, null, d);
          });
        }
      }
    }

    if (!reduced) {
      gsap.fromTo(".portal", { opacity: 0.08 }, {
        opacity: 0.42,
        stagger: 0.1,
        scrollTrigger: {
          trigger: "#corridor",
          start: "top top",
          end: "35% top",
          scrub: true,
        },
      });

      gsap.from(".memory__sheet", {
        y: 40, opacity: 0.4, rotate: -2,
        scrollTrigger: { trigger: "#memory", start: "top 75%", end: "top 35%", scrub: true },
      });

      $$(".echo").forEach((el, i) => {
        if (el.classList.contains("echo--story")) return;
        gsap.fromTo(el, { y: 24 + (i % 3) * 8, opacity: 0 }, {
          y: 0, opacity: 1, duration: 1,
          scrollTrigger: { trigger: el, start: "top 88%", toggleActions: "play none none reverse" },
        });
      });
    }

    ScrollTrigger.create({
      trigger: "#wake",
      start: "top 80%",
      onEnter: () => {
        lightLeak?.classList.add("is-on");
        applyWakeEnding();
      },
      onLeaveBack: () => lightLeak?.classList.remove("is-on"),
    });

    ScrollTrigger.create({
      trigger: "#wake",
      start: "top 40%",
      onEnter: () => {
        $("#wake")?.classList.add("is-bleach");
        applyWakeEnding();
      },
      onLeaveBack: () => $("#wake")?.classList.remove("is-bleach"),
    });
  }

  /* ---------- corridor portal whispers ---------- */
  const whisper = $("#corridorWhisper");
  let whisperTimer = null;
  let leaveWhisperPending = null;

  function portalWhisperFor(roomId) {
    if (roomId === "cafe") {
      if (ledger.choices.cafe === "login") return "那台机器，号还挂着。";
      if (ledger.choices.cafe === "fan") return "风扇停了。蓝光还在。";
      if (ledger.visited.stair) return "楼道之后——蓝光从门缝漏出来。";
      if (ledger.visited.wait) return "车没来。网吧倒还亮。";
      return "蓝光从门缝漏出来。";
    }
    if (roomId === "stair") {
      if (ledger.choices.cafe === "login") return "对讲灯还亮。像记得那串号。";
      if (ledger.choices.stair === "up") return "往上更暗。硬币还温。";
      if (ledger.visited.cafe && !ledger.choices.cafe) return "网吧还亮着。这边灯也没关。";
      if (ledger.visited.wait) return "站台空着。单元门的灯还亮。";
      return "对讲灯还亮着。";
    }
    if (roomId === "wait") {
      if (ledger.choices.stair === "up") return "口袋里有硬币。车还没来。";
      if (ledger.choices.cafe === "login") return "号挂着。车不会等。";
      if (ledger.visited.stair) return "对讲没人接。车也许也不来。";
      if (ledger.visited.cafe) return "蓝光还在眼里。候车室更冷。";
      return "车还没来。也许永远不来。";
    }
    return "";
  }

  function showCorridorWhisper(text, holdMs = 2800) {
    if (!whisper || !text) return;
    whisper.textContent = text;
    whisper.hidden = false;
    whisper.classList.add("is-on");
    clearTimeout(whisperTimer);
    whisperTimer = setTimeout(() => {
      whisper.classList.remove("is-on");
      setTimeout(() => { if (whisper && !whisper.classList.contains("is-on")) whisper.hidden = true; }, 400);
    }, holdMs);
  }

  $$(".portal").forEach((btn) => {
    btn.addEventListener("mouseenter", () => {
      if (!whisper || leaveWhisperPending) return;
      whisper.textContent = portalWhisperFor(btn.dataset.room);
      whisper.hidden = false;
      whisper.classList.add("is-on");
      clearTimeout(whisperTimer);
    });
    btn.addEventListener("mouseleave", () => {
      if (leaveWhisperPending) return;
      whisper?.classList.remove("is-on");
      whisperTimer = setTimeout(() => { if (whisper) whisper.hidden = true; }, 400);
    });
    btn.addEventListener("click", () => openRoom(btn.dataset.room));
  });

  /* ---------- story UI sync ---------- */
  function enterWhisperFor(roomId) {
    const base = $(`.room__panel[data-room-panel="${roomId}"] .room__whisper`)?.dataset.whisperDefault || "";
    if (roomId === "cafe") {
      if (visitedBefore("cafe", "stair") && visitedBefore("cafe", "wait")) {
        return "两处都空着。只有这台还挂着。";
      }
      if (visitedBefore("cafe", "stair")) {
        if (ledger.choices.stair === "intercom") return "对讲没人接。你才跑到还亮着的机器前。";
        if (ledger.choices.stair === "up") return "硬币还在口袋。屏幕倒认识你。";
        return "楼道的灯还亮。网吧的蓝光更亮。";
      }
      if (visitedBefore("cafe", "wait")) {
        if (ledger.choices.wait === "sit") return "你刚从空椅子起来。号还挂着。";
        return "车没来。屏幕倒还亮着。";
      }
      return base || "今晚本该走。机器还亮着。";
    }
    if (roomId === "stair") {
      if (ledger.choices.cafe === "login") {
        return "蓝光还留在眼睛里。对讲灯也亮。像同一件事。";
      }
      if (ledger.choices.cafe === "fan") {
        return "风停之后，楼道更响。有人按过。";
      }
      if (visitedBefore("stair", "cafe")) {
        return "网吧门缝漏着光。这边——对讲灯也没关。";
      }
      if (visitedBefore("stair", "wait")) {
        return "车没来。你又回到单元门。";
      }
      return base || "有人按过。灯还亮着。没人应。";
    }
    if (roomId === "wait") {
      if (ledger.choices.cafe === "login" && ledger.choices.stair === "up") {
        return "卡号和硬币都在。位子还凹着。像专等你来写完。";
      }
      if (ledger.choices.cafe === "login") {
        return "那台机器还挂着号。车不会等。";
      }
      if (ledger.choices.stair === "intercom") {
        return "对讲没人接。也许车也不会来。";
      }
      if (ledger.choices.stair === "up") {
        return "口袋里的硬币还温。蓝椅空着。";
      }
      if (visitedBefore("wait", "cafe") && !visitedBefore("wait", "stair")) {
        return "你先看见了蓝光。此刻椅子更空。";
      }
      if (visitedBefore("wait", "stair")) {
        return "楼道的回声还在。候车室更冷。";
      }
      return base || "位子还留着形状。人已经不在。";
    }
    return base;
  }

  function applyRoomWhisper(roomId) {
    const panel = $(`.room__panel[data-room-panel="${roomId}"]`);
    const el = panel?.querySelector(".room__whisper");
    if (!el) return;
    const choice = ledger.choices[roomId];
    const next = (choice && CHOICE_WHISPER[roomId]?.[choice]) || enterWhisperFor(roomId);
    el.textContent = next;
  }

  function syncAftermathUI(roomId) {
    const dock = $(`.room__aftermath[data-aftermath-for="${roomId}"]`);
    if (!dock) return;
    const choice = ledger.choices[roomId];
    const pack = choice && AFTERMATH[roomId]?.[choice];
    if (!pack || !ledger.aftermath[roomId]) {
      dock.hidden = true;
      dock.classList.remove("is-on");
      return;
    }
    const beat = dock.querySelector(".room__aftermath-beat");
    const hint = dock.querySelector(".room__aftermath-hint");
    if (beat) beat.textContent = pack.beat;
    if (hint) hint.textContent = pack.hint;
    dock.hidden = false;
    requestAnimationFrame(() => dock.classList.add("is-on"));
  }

  function showAftermath(roomId, choice) {
    const pack = AFTERMATH[roomId]?.[choice];
    if (!pack) return;
    ledger.aftermath[roomId] = true;
    saveLedger();
    const dock = $(`.room__aftermath[data-aftermath-for="${roomId}"]`);
    if (!dock) return;
    const beat = dock.querySelector(".room__aftermath-beat");
    const hint = dock.querySelector(".room__aftermath-hint");
    if (beat) beat.textContent = pack.beat;
    if (hint) hint.textContent = pack.hint;
    dock.hidden = false;
    requestAnimationFrame(() => dock.classList.add("is-on"));
  }

  function syncChoiceUI(roomId) {
    const dock = $(`.room__choice[data-choice-for="${roomId}"]`);
    if (!dock) return;
    if (ledger.choices[roomId]) {
      dock.hidden = true;
      dock.classList.remove("is-on");
      syncAftermathUI(roomId);
      return;
    }
    const explored = ledger.explored[roomId] || 0;
    if (explored >= 2) {
      const panel = $(`.room__panel[data-room-panel="${roomId}"]`);
      hideFocus(panel);
      dock.hidden = false;
      requestAnimationFrame(() => dock.classList.add("is-on"));
    } else {
      dock.hidden = true;
      dock.classList.remove("is-on");
    }
    syncAftermathUI(roomId);
  }

  function requiresMet(req) {
    if (!req) return false;
    return req.split("+").every((part) => {
      const [roomId, choice] = part.split(":");
      return roomId && choice && ledger.choices[roomId] === choice;
    });
  }

  function unlockCallbacks() {
    $$(".frag--callback").forEach((btn) => {
      const ok = requiresMet(btn.dataset.requires || "");
      if (ok) {
        btn.hidden = false;
        btn.classList.add("is-unlocked");
      } else {
        btn.hidden = true;
        btn.classList.remove("is-unlocked");
      }
    });
  }

  function markCollectedFrags() {
    $$(".frag[data-shard]").forEach((btn) => {
      if (hasShard(btn.dataset.shard)) btn.classList.add("is-collected");
      else btn.classList.remove("is-collected");
    });
  }

  function syncPortals() {
    $$(".portal").forEach((btn) => {
      const id = btn.dataset.room;
      btn.classList.toggle("is-visited", !!ledger.visited[id]);
      btn.classList.toggle("is-chosen", !!ledger.choices[id]);
    });
  }

  function syncMapMarks() {
    $$(".memspot").forEach((btn) => {
      const jump = btn.dataset.jump;
      if (!jump || !["cafe", "stair", "wait"].includes(jump)) return;
      btn.classList.toggle("is-visited", !!ledger.visited[jump]);
      btn.classList.toggle("is-chosen", !!ledger.choices[jump]);
    });
  }

  function syncCaptions() {
    const caps = $$(".scrub-cap");
    caps.forEach((cap) => {
      const base = cap.dataset.base || cap.textContent;
      cap.textContent = base;
    });
    if (ledger.captionSlot == null) return;
    const slot = caps[ledger.captionSlot];
    if (!slot) return;
    const order = ["wait", "stair", "cafe"];
    for (const roomId of order) {
      const choice = ledger.choices[roomId];
      const line = choice && CAPTION_AFTER[roomId]?.[choice];
      if (line) {
        slot.textContent = line;
        return;
      }
    }
  }

  function setEchoVisible(el, on) {
    if (!el) return;
    el.hidden = !on;
    el.classList.toggle("is-story-on", !!on);
  }

  function syncEchoes() {
    const bus = $(`.echo[data-echo-id="bus"]`);
    const cursorEcho = $(`.echo[data-echo-id="cursor"]`);
    const times = $(`.echo[data-echo-id="times"]`);
    const keys = $(`.echo[data-echo-id="keys"]`);
    const card = $(`.echo[data-echo-id="card"]`);
    const coin = $(`.echo[data-echo-id="coin"]`);
    const letter = $(`.echo[data-echo-id="letter"]`);

    if (bus) {
      const base = bus.dataset.echoBase || "站台空着。灯还亮。";
      if (ledger.choices.wait === "wipe") {
        bus.textContent = "雾开了";
        bus.dataset.echo = "雾开了。外面还是空的。字没写完。";
        bus.classList.add("is-altered");
      } else if (ledger.choices.wait === "sit") {
        bus.textContent = "有人坐过";
        bus.dataset.echo = "蓝椅上，形状对过一下。";
        bus.classList.add("is-altered");
      } else {
        bus.textContent = "车晚点了";
        bus.dataset.echo = base;
        bus.classList.remove("is-altered");
      }
    }
    if (cursorEcho) {
      const base = cursorEcho.dataset.echoBase || "光标还在跳。";
      if (ledger.choices.cafe === "login") {
        cursorEcho.textContent = "号还挂着_";
        cursorEcho.dataset.echo = "号还挂着。你登过。卡号跟着走了。";
        cursorEcho.classList.add("is-altered");
      } else if (ledger.choices.cafe === "fan") {
        cursorEcho.textContent = "风停了_";
        cursorEcho.dataset.echo = "风扇停了。光标还在。我马上到。";
        cursorEcho.classList.add("is-altered");
      } else {
        cursorEcho.textContent = "你还醒着吗_";
        cursorEcho.dataset.echo = base;
        cursorEcho.classList.remove("is-altered");
      }
    }
    if (times) {
      const n = ledger.shards.length;
      if (chainComplete()) {
        times.textContent = "接上了";
        times.dataset.echo = "卡号、硬币、未写完的字。这一次拼上了。";
        times.classList.add("is-altered");
      } else if (choiceCount() >= 2) {
        times.textContent = "还没走";
        times.dataset.echo = "记得要走。还没走到。";
        times.classList.add("is-altered");
      } else if (n >= 2) {
        times.textContent = "第几次了？";
        times.dataset.echo = "碎片多了一点。出口还是模糊。";
        times.classList.remove("is-altered");
      } else {
        times.textContent = "第几次了？";
        times.dataset.echo = times.dataset.echoBase || "数不清。也许不该数。";
        times.classList.remove("is-altered");
      }
    }
    if (keys) {
      if (ledger.choices.stair === "intercom") {
        keys.dataset.echo = "钥匙在哪一户？对讲没人答。";
        keys.classList.add("is-altered");
      } else if (ledger.choices.stair === "up") {
        keys.dataset.echo = "没带钥匙。口袋里只有硬币。";
        keys.classList.add("is-altered");
      } else {
        keys.dataset.echo = "那串钥匙，后来呢？";
        keys.classList.remove("is-altered");
      }
    }

    setEchoVisible(card, !!(ledger.choices.cafe === "login" || hasShard("stair-ticket")));
    setEchoVisible(coin, !!(ledger.choices.stair === "up" || hasShard("wait-coin")));
    setEchoVisible(letter, !!(hasShard("wait-letter") || (ledger.choices.cafe === "login" && ledger.choices.stair === "up" && ledger.choices.wait)));

    const sentence = $("#echoSentence");
    if (sentence) {
      let text = "今晚……";
      if (chainComplete() || (choiceCount() >= 3 && ledger.choices.cafe === "login")) {
        text = ledger.choices.wait === "wipe" || ledger.choices.cafe === "fan"
          ? "今晚本该走。你回来了。"
          : "今晚本该走。你没走。";
      } else if (choiceCount() >= 2 || (hasShard("stair-ticket") && hasShard("wait-coin"))) {
        text = "今晚本该走。";
      } else if (choiceCount() >= 1 || Object.keys(ledger.visited).length >= 2) {
        text = "今晚本该……";
      } else if (Object.keys(ledger.visited).length >= 1) {
        text = "今晚……";
      }
      sentence.textContent = text;
      sentence.classList.toggle("is-complete", text.includes("。") && text.length > 6);
    }

    const caption = $("#echoesCaption");
    if (caption) {
      if (chainComplete()) caption.textContent = "拼出来的句子，像你写的。";
      else if (choiceCount() >= 1) caption.textContent = "墙上的字，在跟着你改。";
      else caption.textContent = "墙上留下的，不一定是你写的。";
    }
  }

  function resolveWakeKey() {
    const n = ledger.shards.length;
    const visitedN = Object.keys(ledger.visited).length;
    const { cafe, stair, wait } = ledger.choices;

    if (chainComplete() || (cafe === "login" && stair === "up" && wait && hasShard("stair-ticket") && hasShard("wait-coin"))) {
      return "loop";
    }
    if (cafe === "fan" && stair === "up" && wait === "wipe") return "stay";
    if (wait === "sit") return "waiting";
    if (cafe === "login" || stair === "intercom") return "lights";
    if (n === 0 && visitedN === 0) return "dawn";
    if (n <= 1 && choiceCount() === 0) return "forgot";
    if (visitedN >= 2 || n >= 3 || choiceCount() >= 1) return "more";
    return "forgot";
  }

  function applyWakeEnding() {
    const key = resolveWakeKey();
    const variant = WAKE_VARIANTS[key] || WAKE_VARIANTS.dawn;
    const verses = $("#wakeVerses");
    if (!verses) return;
    const lines = variant.lines || [variant.line || "天亮了。"].filter(Boolean);
    verses.innerHTML = lines.map((line, i) => {
      const cls = i === 0 ? "wake__line" : "wake__sub";
      return `<p class="${cls}">${line}</p>`;
    }).join("");
  }

  function syncStoryUI() {
    ["cafe", "stair", "wait"].forEach((id) => {
      applyRoomWhisper(id);
      syncChoiceUI(id);
    });
    unlockCallbacks();
    markCollectedFrags();
    syncPortals();
    syncMapMarks();
    syncCaptions();
    syncEchoes();
    refreshTally();
    applyWakeEnding();
  }

  function bumpExplore(roomId, token) {
    if (!roomId || !token) return;
    const prev = Array.isArray(ledger.exploredTokens[roomId]) ? ledger.exploredTokens[roomId] : [];
    if (prev.includes(token)) return;
    ledger.exploredTokens[roomId] = [...prev, token];
    ledger.explored[roomId] = ledger.exploredTokens[roomId].length;
    saveLedger();
    syncChoiceUI(roomId);
  }

  function reactCorridor(roomId) {
    const choice = ledger.choices[roomId];
    if (!choice || ledger.corridorSaid[roomId]) return;
    const line = CORRIDOR_AFTER[roomId]?.[choice];
    if (!line) return;
    ledger.corridorSaid[roomId] = true;
    // rotate caption slot 0→1→2 across reactions
    const used = Object.keys(ledger.corridorSaid).length - 1;
    ledger.captionSlot = used % 3;
    saveLedger();
    syncCaptions();
    leaveWhisperPending = line;
  }

  function flushLeaveWhisper() {
    if (!leaveWhisperPending) return;
    const line = leaveWhisperPending;
    leaveWhisperPending = null;
    setTimeout(() => showCorridorWhisper(line, 3200), reduced ? 80 : 760);
  }

  /* ---------- soft narrative hints ---------- */
  const roomSoftHint = $("#roomSoftHint");
  let softHintTimer = null;

  function hideSoftHint() {
    clearTimeout(softHintTimer);
    softHintTimer = null;
    if (!roomSoftHint) return;
    roomSoftHint.classList.remove("is-on");
    setTimeout(() => {
      if (roomSoftHint && !roomSoftHint.classList.contains("is-on")) roomSoftHint.hidden = true;
    }, 500);
  }

  function showSoftHint(text, key, holdMs = 3200) {
    if (!roomSoftHint || !text) return;
    if (key) {
      if (ledger.hintsSaid[key]) return;
      ledger.hintsSaid[key] = true;
      saveLedger();
    }
    roomSoftHint.textContent = text;
    roomSoftHint.hidden = false;
    requestAnimationFrame(() => roomSoftHint.classList.add("is-on"));
    clearTimeout(softHintTimer);
    softHintTimer = setTimeout(() => hideSoftHint(), holdMs);
  }

  function scheduleRoomGuidance(roomId) {
    clearTimeout(softHintTimer);
    softHintTimer = setTimeout(() => {
      if (activeRoom !== roomId) return;
      if ((ledger.explored[roomId] || 0) > 0) return;
      if (roomId === "cafe") showSoftHint("点开有光的地方。", "hint-cafe-glow");
      else if (roomId === "stair") showSoftHint("对讲灯还亮着。", "hint-stair-bell");
      else if (roomId === "wait") showSoftHint("椅子还留着形状。", "hint-wait-seat");
    }, reduced ? 1600 : 4200);
  }

  /* ---------- rooms ---------- */
  const room = $("#room");
  const roomBack = $("#roomBack");
  const fragLine = $("#fragLine");
  let activeRoom = null;
  let mx = 0.5, my = 0.5;
  let leavingRoomId = null;

  function openRoom(id) {
    if (!room || !id) return;
    closeMap(true);
    if (toast) { toast.classList.remove("is-on"); toast.hidden = true; }
    leaveWhisperPending = null;
    hideSoftHint();
    activeRoom = id;
    markVisited(id);
    syncPortals();
    syncMapMarks();
    $$(".room__panel").forEach((p) => {
      p.hidden = p.dataset.roomPanel !== id;
      p.classList.remove("is-rack");
      p.querySelectorAll(".room__focus").forEach((f) => {
        f.hidden = true;
        f.classList.remove("is-on");
      });
      const after = p.querySelector(".room__aftermath");
      if (after && p.dataset.roomPanel !== id) {
        after.hidden = true;
        after.classList.remove("is-on");
      }
    });
    unlockCallbacks();
    markCollectedFrags();
    applyRoomWhisper(id);
    syncChoiceUI(id);
    syncEchoes();
    room.hidden = false;
    document.body.classList.add("is-room-open");
    lenis?.stop();
    room.classList.remove("is-leaving");
    void room.offsetWidth;
    room.classList.add("is-entering");
    ensureAudio();
    playBootClick();
    if (fragLine) { fragLine.classList.remove("is-on"); fragLine.hidden = true; }
    scheduleRoomGuidance(id);
  }

  function closeRoom() {
    if (!room) return;
    leavingRoomId = activeRoom;
    if (leavingRoomId) reactCorridor(leavingRoomId);
    hideSoftHint();
    room.classList.remove("is-entering");
    room.classList.add("is-leaving");
    setTimeout(() => {
      room.hidden = true;
      room.classList.remove("is-leaving", "is-entering");
      document.body.classList.remove("is-room-open");
      lenis?.start();
      activeRoom = null;
      $$(".room__panel").forEach((p) => { p.hidden = true; p.classList.remove("is-rack"); });
      $$(".room__aftermath").forEach((a) => { a.hidden = true; a.classList.remove("is-on"); });
      flushLeaveWhisper();
      // after a choice, gently remind the dream continues in corridor / other doors
      if (leavingRoomId && ledger.choices[leavingRoomId] && choiceCount() < 3) {
        setTimeout(() => {
          if (!activeRoom) showCorridorWhisper("还有没走完的门。", 2600);
        }, reduced ? 400 : 3600);
      }
      leavingRoomId = null;
      applyWakeEnding();
      syncEchoes();
    }, reduced ? 0 : 720);
  }

  roomBack?.addEventListener("click", closeRoom);

  if (!isTouch && !reduced) {
    window.addEventListener("mousemove", (e) => {
      mx = e.clientX / innerWidth;
      my = e.clientY / innerHeight;
      if (!activeRoom || room?.hidden) return;
      const panel = $(`.room__panel[data-room-panel="${activeRoom}"]`);
      if (!panel) return;
      panel.querySelectorAll("[data-depth]").forEach((layer) => {
        const d = parseFloat(layer.dataset.depth) || 0;
        const dx = (mx - 0.5) * d * 28;
        const dy = (my - 0.5) * d * 18;
        layer.style.transform = `translate(${dx}px, ${dy}px)`;
      });
    }, { passive: true });
  }

  function showFocus(panel, key) {
    if (!panel || !key) return;
    const focus = panel.querySelector(`.room__focus[data-focus="${key}"]`);
    if (!focus) return;
    focus.hidden = false;
    requestAnimationFrame(() => focus.classList.add("is-on"));
    panel.classList.add("is-rack");
  }
  function hideFocus(panel) {
    if (!panel) return;
    panel.classList.remove("is-rack");
    panel.querySelectorAll(".room__focus").forEach((f) => {
      f.classList.remove("is-on");
      setTimeout(() => { if (!f.classList.contains("is-on")) f.hidden = true; }, 500);
    });
  }

  $$(".frag").forEach((btn) => {
    const noteExplore = () => {
      const panel = btn.closest(".room__panel");
      const roomId = panel?.dataset.roomPanel || activeRoom;
      if (roomId) {
        bumpExplore(roomId, btn.dataset.shard || btn.dataset.line || btn.style.cssText);
        hideSoftHint();
      }
    };
    const tryCollect = () => {
      const shardId = btn.dataset.shard;
      if (shardId && collectShard(shardId)) {
        btn.classList.add("is-collected");
        ensureAudio();
        playSoftChime();
        refreshTally();
        syncEchoes();
        applyWakeEnding();
        return true;
      }
      return false;
    };
    const show = () => {
      if (!fragLine) return;
      fragLine.textContent = btn.dataset.line || "";
      fragLine.hidden = false;
      fragLine.classList.add("is-on");
      btn.classList.add("is-on");
      const panel = btn.closest(".room__panel");
      if (btn.dataset.focus) showFocus(panel, btn.dataset.focus);
      if (btn.dataset.sfx === "intercom") {
        ensureAudio();
        playIntercom();
      }
      noteExplore();
    };
    const hide = () => {
      fragLine?.classList.remove("is-on");
      btn.classList.remove("is-on");
      const panel = btn.closest(".room__panel");
      hideFocus(panel);
      setTimeout(() => { if (fragLine && !fragLine.classList.contains("is-on")) fragLine.hidden = true; }, 400);
    };
    btn.addEventListener("mouseenter", () => {
      if (isTouch) return;
      show();
    });
    btn.addEventListener("mouseleave", () => {
      if (isTouch) return;
      hide();
    });
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const shardId = btn.dataset.shard;
      const firstMeaningful = shardId && !hasShard(shardId);

      if (btn.classList.contains("is-on") && !firstMeaningful) {
        hide();
        return;
      }
      show();
      tryCollect();
    });
  });

  /* ---------- room choices ---------- */
  $$(".room__choice-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const dock = btn.closest(".room__choice");
      const roomId = dock?.dataset.choiceFor;
      const choice = btn.dataset.choice;
      if (!roomId || !choice || ledger.choices[roomId]) return;

      setChoice(roomId, choice);
      collectShard(`${roomId}-choice`);
      applyRoomWhisper(roomId);
      syncChoiceUI(roomId);
      unlockCallbacks();
      syncPortals();
      syncMapMarks();
      syncEchoes();
      ensureAudio();
      playSoftChime();
      hideSoftHint();

      if (fragLine) {
        const whisperLine = CHOICE_WHISPER[roomId]?.[choice];
        if (whisperLine) {
          fragLine.textContent = whisperLine;
          fragLine.hidden = false;
          fragLine.classList.add("is-on");
          setTimeout(() => {
            if (fragLine && fragLine.classList.contains("is-on")) {
              fragLine.classList.remove("is-on");
              setTimeout(() => {
                if (fragLine && !fragLine.classList.contains("is-on")) fragLine.hidden = true;
              }, 400);
            }
          }, reduced ? 900 : 2200);
        }
      }

      // 后果 beat — short aftermath before leaving
      setTimeout(() => showAftermath(roomId, choice), reduced ? 200 : 700);

      if (choice === "intercom") {
        playIntercom();
      } else {
        playBootClick();
      }
      applyWakeEnding();
    });
  });

  /* ---------- memory map ---------- */
  const mapOverlay = $("#mapOverlay");
  const mapToggle = $("#mapToggle");
  const mapClose = $("#mapClose");

  function openMap() {
    if (!mapOverlay) return;
    syncMapMarks();
    mapOverlay.hidden = false;
    document.body.classList.add("is-map-open");
    lenis?.stop();
    ensureAudio();
  }
  function closeMap(silent) {
    if (!mapOverlay || mapOverlay.hidden) return;
    mapOverlay.hidden = true;
    document.body.classList.remove("is-map-open");
    if (!document.body.classList.contains("is-room-open")) lenis?.start();
  }

  mapToggle?.addEventListener("click", () => {
    if (mapOverlay?.hidden === false) closeMap();
    else openMap();
  });
  mapClose?.addEventListener("click", () => closeMap());

  function jumpTo(target) {
    closeMap(true);
    const rooms = { cafe: 1, stair: 1, wait: 1 };
    if (rooms[target]) {
      const corridor = $("#corridor");
      const after = () => openRoom(target);
      if (window.lenis && corridor) {
        window.lenis.scrollTo(corridor, { offset: 0, duration: 1.1, onComplete: after });
      } else {
        corridor?.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
        setTimeout(after, reduced ? 50 : 700);
      }
      return;
    }
    const el = document.getElementById(target);
    if (!el) return;
    if (activeRoom) closeRoom();
    if (window.lenis) window.lenis.scrollTo(el, { offset: 0, duration: 1.25 });
    else el.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
  }

  $$(".memspot").forEach((btn) => {
    btn.addEventListener("click", () => jumpTo(btn.dataset.jump));
  });

  /* ---------- echoes ---------- */
  const toast = $("#echoToast");
  let toastTimer = null;
  $$(".echo").forEach((el) => {
    const fire = () => {
      if (!toast) return;
      toast.textContent = el.dataset.echo || el.textContent;
      toast.hidden = false;
      toast.classList.add("is-on");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        toast.classList.remove("is-on");
        setTimeout(() => { toast.hidden = true; }, 400);
      }, 2200);
    };
    el.addEventListener("click", fire);
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fire(); }
    });
  });

  /* ---------- replay / reset dream ---------- */
  function resetDream() {
    ledger = blankLedger();
    try {
      sessionStorage.removeItem(LEDGER_KEY);
      sessionStorage.removeItem("dreamcore-ledger-v1");
    } catch { /* */ }
    leaveWhisperPending = null;
    hideSoftHint();
    $$(".frag").forEach((b) => {
      b.classList.remove("is-collected", "is-on", "is-unlocked");
      if (b.classList.contains("frag--callback")) b.hidden = true;
    });
    $$(".room__choice").forEach((d) => { d.hidden = true; d.classList.remove("is-on"); });
    $$(".room__aftermath").forEach((d) => { d.hidden = true; d.classList.remove("is-on"); });
    $$(".room__whisper").forEach((el) => {
      el.textContent = el.dataset.whisperDefault || el.textContent;
    });
    $$(".scrub-cap").forEach((cap) => {
      cap.textContent = cap.dataset.base || cap.textContent;
    });
    $$(".echo").forEach((el) => {
      if (el.dataset.echoBase) el.dataset.echo = el.dataset.echoBase;
      el.classList.remove("is-altered", "is-story-on");
      if (el.classList.contains("echo--story")) el.hidden = true;
    });
    const sentence = $("#echoSentence");
    if (sentence) {
      sentence.textContent = "今晚……";
      sentence.classList.remove("is-complete");
    }
    const caption = $("#echoesCaption");
    if (caption) caption.textContent = "墙上留下的，不一定是你写的。";
    syncStoryUI();
  }

  $("#replay")?.addEventListener("click", () => {
    resetDream();
    $("#wake")?.classList.remove("is-bleach");
    lightLeak?.classList.remove("is-on");
    if (thesisEl) thesisEl.textContent = "";
    enterGo?.classList.remove("is-ready");
    if (lenis) lenis.scrollTo(0, { immediate: reduced });
    else window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
    setTimeout(() => typeThesis(), reduced ? 100 : 500);
  });

  /* ---------- boot ---------- */
  function waitLibs(cb, n = 0) {
    if ((typeof Lenis !== "undefined" && typeof gsap !== "undefined") || n > 80) cb();
    else setTimeout(() => waitLibs(cb, n + 1), 40);
  }

  waitLibs(() => {
    syncStoryUI();
    bootScroll();
    typeThesis();
    startEq();
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!mapOverlay?.hidden) closeMap();
      else if (activeRoom) closeRoom();
    }
  });
})();
