/* 中式梦核 — v5 cinematic scroll */
(() => {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isTouch = matchMedia("(hover: none), (pointer: coarse)").matches;
  if (isTouch) document.body.classList.add("is-touch");

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const THESIS = "你好像来过这里，但记不起是第几次。";

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
    const hoverables = "a, button, .portal, .mute, .wake__replay, .room__back, .enter__go, .frag, .echo, .memspot, .map-toggle, .map-overlay__close";
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

    // brownish noise floor (corridor air)
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

    // fluorescent 60Hz-ish buzz layer
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

    // deep drone
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
    // soft square blip through bandpass = 对讲
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
    // second ring
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

        // scrubbed captions — exclusive: only one visible, no stack overlap
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
          // non-overlapping windows: in → hold → out, then next
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
        gsap.fromTo(el, { y: 24 + (i % 3) * 8, opacity: 0 }, {
          y: 0, opacity: 1, duration: 1,
          scrollTrigger: { trigger: el, start: "top 88%", toggleActions: "play none none reverse" },
        });
      });
    }

    ScrollTrigger.create({
      trigger: "#wake",
      start: "top 80%",
      onEnter: () => lightLeak?.classList.add("is-on"),
      onLeaveBack: () => lightLeak?.classList.remove("is-on"),
    });

    ScrollTrigger.create({
      trigger: "#wake",
      start: "top 40%",
      onEnter: () => $("#wake")?.classList.add("is-bleach"),
      onLeaveBack: () => $("#wake")?.classList.remove("is-bleach"),
    });
  }

  /* ---------- corridor portal whispers ---------- */
  const whisper = $("#corridorWhisper");
  const WHISPERS = {
    cafe: "蓝光从门缝漏出来。",
    stair: "对讲灯还亮着。",
    wait: "车还没来。也许永远不来。",
  };
  let whisperTimer = null;
  $$(".portal").forEach((btn) => {
    btn.addEventListener("mouseenter", () => {
      if (!whisper) return;
      whisper.textContent = WHISPERS[btn.dataset.room] || "";
      whisper.hidden = false;
      whisper.classList.add("is-on");
      clearTimeout(whisperTimer);
    });
    btn.addEventListener("mouseleave", () => {
      whisper?.classList.remove("is-on");
      whisperTimer = setTimeout(() => { if (whisper) whisper.hidden = true; }, 400);
    });
    btn.addEventListener("click", () => openRoom(btn.dataset.room));
  });

  /* ---------- rooms ---------- */
  const room = $("#room");
  const roomBack = $("#roomBack");
  const fragLine = $("#fragLine");
  let activeRoom = null;
  let mx = 0.5, my = 0.5;

  function openRoom(id) {
    if (!room || !id) return;
    closeMap(true);
    if (toast) { toast.classList.remove("is-on"); toast.hidden = true; }
    activeRoom = id;
    $$(".room__panel").forEach((p) => {
      p.hidden = p.dataset.roomPanel !== id;
      p.classList.remove("is-rack");
      p.querySelectorAll(".room__focus").forEach((f) => {
        f.hidden = true;
        f.classList.remove("is-on");
      });
    });
    room.hidden = false;
    document.body.classList.add("is-room-open");
    lenis?.stop();
    room.classList.remove("is-leaving");
    void room.offsetWidth;
    room.classList.add("is-entering");
    ensureAudio();
    playBootClick();
    if (fragLine) { fragLine.classList.remove("is-on"); fragLine.hidden = true; }
  }

  function closeRoom() {
    if (!room) return;
    room.classList.remove("is-entering");
    room.classList.add("is-leaving");
    setTimeout(() => {
      room.hidden = true;
      room.classList.remove("is-leaving", "is-entering");
      document.body.classList.remove("is-room-open");
      lenis?.start();
      activeRoom = null;
      $$(".room__panel").forEach((p) => { p.hidden = true; p.classList.remove("is-rack"); });
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
    };
    const hide = () => {
      fragLine?.classList.remove("is-on");
      btn.classList.remove("is-on");
      const panel = btn.closest(".room__panel");
      hideFocus(panel);
      setTimeout(() => { if (fragLine && !fragLine.classList.contains("is-on")) fragLine.hidden = true; }, 400);
    };
    btn.addEventListener("mouseenter", show);
    btn.addEventListener("mouseleave", hide);
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (btn.classList.contains("is-on")) hide();
      else show();
    });
  });

  /* ---------- memory map ---------- */
  const mapOverlay = $("#mapOverlay");
  const mapToggle = $("#mapToggle");
  const mapClose = $("#mapClose");

  function openMap() {
    if (!mapOverlay) return;
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
      // scroll corridor into view then open room
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

  /* ---------- replay ---------- */
  $("#replay")?.addEventListener("click", () => {
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
