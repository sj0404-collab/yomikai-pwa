import React, { useState } from "react";

// AI-чат: любой OpenAI-совместимый эндпоинт. Настройки хранятся локально.
const CFG_KEY = "yomikai-pwa-ai-v1";
type Cfg = { url: string; key: string; model: string };
type Msg = { role: "user" | "assistant"; text: string };

function loadCfg(): Cfg {
  try {
    const raw = localStorage.getItem(CFG_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* пусто */
  }
  return { url: "", key: "", model: "" };
}
function loadLog(): Msg[] {
  try {
    const raw = localStorage.getItem(CFG_KEY + "-log");
    if (raw) return JSON.parse(raw);
  } catch {
    /* пусто */
  }
  return [];
}

export default function AiChat() {
  const [cfg, setCfg] = useState<Cfg>(loadCfg);
  const [log, setLog] = useState<Msg[]>(loadLog);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [showCfg, setShowCfg] = useState(!loadCfg().url);

  const save = (c: Cfg) => {
    setCfg(c);
    localStorage.setItem(CFG_KEY, JSON.stringify(c));
  };
  const push = (m: Msg) => {
    setLog((l) => {
      const nl = [...l, m].slice(-100);
      localStorage.setItem(CFG_KEY + "-log", JSON.stringify(nl));
      return nl;
    });
  };

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    if (!cfg.url) {
      setShowCfg(true);
      return;
    }
    setInput("");
    push({ role: "user", text });
    setBusy(true);
    try {
      const r = await fetch(cfg.url.replace(/\/$/, "") + "/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(cfg.key ? { Authorization: "Bearer " + cfg.key } : {}),
        },
        body: JSON.stringify({
          model: cfg.model || undefined,
          messages: [...log, { role: "user", text: undefined, content: text }].map((m: any) => ({
            role: m.role,
            content: m.content ?? m.text,
          })),
        }),
      });
      const j = await r.json();
      const ans = j?.choices?.[0]?.message?.content || JSON.stringify(j).slice(0, 400);
      push({ role: "assistant", text: String(ans) });
    } catch (e: any) {
      push({ role: "assistant", text: "Ошибка запроса: " + (e?.message || e) + "\n(проверьте URL/ключ/модель и CORS эндпоинта)" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="topbar">
        <h1>AI-чат</h1>
        <button className="btn ghost" onClick={() => setShowCfg((x) => !x)}>
          {showCfg ? "Скрыть" : "Настройка"}
        </button>
        <button
          className="btn ghost"
          onClick={() => {
            setLog([]);
            localStorage.removeItem(CFG_KEY + "-log");
          }}
        >
          Очистить
        </button>
      </div>
      {showCfg && (
        <div className="screen" style={{ flex: "0 0 auto", maxHeight: "34dvh" }}>
          <div className="panel">
            <input type="url" placeholder="https://api.…/v1  (OpenAI-совместимый)" value={cfg.url} onChange={(e) => save({ ...cfg, url: e.target.value })} />
            <div style={{ height: 6 }} />
            <input type="password" placeholder="API-ключ (не обязателен)" value={cfg.key} onChange={(e) => save({ ...cfg, key: e.target.value })} />
            <div style={{ height: 6 }} />
            <input type="text" placeholder="Модель (напр. gpt-4o-mini)" value={cfg.model} onChange={(e) => save({ ...cfg, model: e.target.value })} />
            <div className="muted" style={{ marginTop: 6 }}>Всё хранится только в localStorage вашего браузера.</div>
          </div>
        </div>
      )}
      <div className="chat-log">
        {log.length === 0 && <div className="panel muted">Настройте эндпоинт и задайте вопрос. Чат работает с любым OpenAI-совместимым API (нужен CORS на стороне сервера).</div>}
        {log.map((m, i) => (
          <div key={i} className={"msg " + (m.role === "user" ? "me" : "ai")}>
            {m.text}
          </div>
        ))}
        {busy && <div className="msg ai muted">печатает…</div>}
      </div>
      <div className="chat-input">
        <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Сообщение…" />
        <button className="btn" onClick={send} disabled={busy}>
          ➤
        </button>
      </div>
    </>
  );
}
