import React, { useState, useSyncExternalStore } from "react";
import { getState, setState, subscribe, resetAll } from "../store";
import { ruVoices, speakText } from "../tts";
import { TAB_META, type TabId, type TabsCfg, type CustomButton } from "../tabs";

// «Ещё»: настройки (тема, TTS, голос) + Конструктор вкладок (порядок, видимость,
// свои кнопки) + сброс данных.
export default function More({ cfg, setCfg }: { cfg: TabsCfg; setCfg: (c: TabsCfg) => void }) {
  const s = useSyncExternalStore(subscribe, getState);
  const [voicesTick, setVoicesTick] = useState(0);
  const voices = ruVoices();
  if (voices.length === 0 && voicesTick === 0) setTimeout(() => setVoicesTick(1), 600);

  const move = (t: TabId, d: number) => {
    const o = [...cfg.order];
    const i = o.indexOf(t);
    const j = i + d;
    if (i < 0 || j < 0 || j >= o.length) return;
    [o[i], o[j]] = [o[j], o[i]];
    setCfg({ ...cfg, order: o });
  };
  const toggleHide = (t: TabId) => {
    const hidden = cfg.hidden.includes(t) ? cfg.hidden.filter((x) => x !== t) : [...cfg.hidden, t];
    // «Ещё» спрятать нельзя — иначе конструктор не открыть
    if (t === "more") return;
    setCfg({ ...cfg, hidden });
  };
  const applyCustom = (b: CustomButton) => {
    switch (b.effect) {
      case "theme":
        setState((st) => (st.settings.theme = st.settings.theme === "dark" ? "light" : "dark"));
        document.documentElement.dataset.theme = getState().settings.theme;
        return "Тема переключена";
      case "voice-female":
        speakText("Женский голос активирован.", { gender: "female" });
        return "Озвучка: женский";
      case "voice-male":
        speakText("Мужской голос активирован.", { gender: "male" });
        return "Озвучка: мужской";
      case "voice-narrator":
        speakText("Голос рассказчика активирован.", { gender: "neutral" });
        return "Озвучка: нарратор";
      case "mode-vertical":
        setState((st) => (st.settings.readerMode = "vertical"));
        return "Читалка: вертикаль";
      case "mode-rtl":
        setState((st) => (st.settings.readerMode = "rtl"));
        return "Читалка: справа налево";
      case "mode-ltr":
        setState((st) => (st.settings.readerMode = "ltr"));
        return "Читалка: слева направо";
      case "stop-tts":
        speechSynthesis.cancel();
        return "Озвучка остановлена";
      default:
        return "Неизвестный эффект";
    }
  };

  return (
    <>
      <div className="topbar">
        <h1>Ещё</h1>
      </div>
      <div className="screen">
        <div className="panel">
          <b>Оформление</b>
          <div className="chips" style={{ marginTop: 6 }}>
            {(["dark", "light"] as const).map((th) => (
              <button
                key={th}
                className={"chip" + (s.settings.theme === th ? " active" : "")}
                onClick={() => {
                  setState((st) => (st.settings.theme = th));
                  document.documentElement.dataset.theme = th;
                }}
              >
                {th === "dark" ? "Тёмная" : "Светлая"}
              </button>
            ))}
          </div>
        </div>

        <div className="panel">
          <b>Озвучка (Web Speech)</b>
          <div className="muted" style={{ margin: "4px 0" }}>
            Скорость ×{s.settings.rate.toFixed(2)} · Тон ×{s.settings.pitch.toFixed(2)}
          </div>
          <input type="range" min={0.5} max={2} step={0.05} value={s.settings.rate} onChange={(e) => setState((st) => (st.settings.rate = +e.target.value))} />
          <input type="range" min={0.5} max={2} step={0.05} value={s.settings.pitch} onChange={(e) => setState((st) => (st.settings.pitch = +e.target.value))} />
          <div style={{ height: 6 }} />
          <select value={s.settings.voiceURI} onChange={(e) => setState((st) => (st.settings.voiceURI = e.target.value))}>
            <option value="">Голос: авто (русский)</option>
            {voices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.name} ({v.lang})
              </option>
            ))}
          </select>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn ghost" onClick={() => speakText("Проверка озвучки. Раз, два, три.")}>
              ▶ Проба
            </button>
            <button className="btn ghost" onClick={() => speechSynthesis.cancel()}>
              ■ Стоп
            </button>
            <span className="muted">{voices.length} русск. голосов в системе</span>
          </div>
        </div>

        <div className="panel">
          <b>Конструктор вкладок</b>
          <div className="muted" style={{ margin: "4px 0 8px" }}>Порядок, видимость и свои кнопки нижней панели.</div>
          {cfg.order.map((t) => (
            <div key={t} className="list-item">
              <span style={{ fontSize: 18 }}>{TAB_META[t].ico}</span>
              <div className="grow">
                <div className="t">{TAB_META[t].label}</div>
              </div>
              <button className="btn ghost" onClick={() => move(t, -1)}>↑</button>
              <button className="btn ghost" onClick={() => move(t, 1)}>↓</button>
              <button className={"chip" + (cfg.hidden.includes(t) ? "" : " active")} onClick={() => toggleHide(t)} disabled={t === "more"}>
                {cfg.hidden.includes(t) ? "скрыта" : "видна"}
              </button>
            </div>
          ))}
          <div className="hr" />
          <b>Свои кнопки</b>
          {cfg.customButtons.map((b, i) => (
            <div key={b.id} className="list-item">
              <div className="grow">
                <div className="t">{b.title}</div>
                <div className="muted">{b.effect}</div>
              </div>
              <button className="btn ghost" onClick={() => alert(applyCustom(b))}>▶</button>
              <button className="btn ghost" onClick={() => setCfg({ ...cfg, customButtons: cfg.customButtons.filter((_, j) => j !== i) })}>
                ✕
              </button>
            </div>
          ))}
          <button
            className="btn ghost"
            style={{ marginTop: 8 }}
            onClick={() => {
              const title = prompt("Название кнопки:");
              if (!title) return;
              const effects = ["theme", "voice-female", "voice-male", "voice-narrator", "mode-vertical", "mode-rtl", "mode-ltr", "stop-tts"];
              const eff = prompt("Эффект (" + effects.join(", ") + "):", "theme");
              if (!eff || !effects.includes(eff)) return;
              setCfg({ ...cfg, customButtons: [...cfg.customButtons, { id: "c" + Date.now(), title, effect: eff }] });
            }}
          >
            ＋ Кнопка
          </button>
        </div>

        <div className="panel">
          <b>Данные</b>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn danger" onClick={() => confirm("Сбросить всю библиотеку/историю/настройки?") && resetAll()}>
              Сбросить всё
            </button>
            <span className="muted">Библиотека: {s.library.length} · История: {s.history.length}</span>
          </div>
        </div>
        <div className="muted">yomikai PWA · веб-двойник APK · состояние в localStorage</div>
      </div>
    </>
  );
}
