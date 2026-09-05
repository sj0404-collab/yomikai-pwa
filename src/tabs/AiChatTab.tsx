import React, { useRef, useState } from "react";
import { getState, setState, useStore } from "../store";
import { AppBar } from "../ui";

type Msg = { role: "user" | "assistant"; text: string };

/**
 * AI-чат PWA: любой OpenAI-совместимый эндпоинт (url + key + model) из настроек.
 * Ключ хранится только локально в браузере.
 */
export function AiChatTab() {
  const state = useStore();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const send = async () => {
    const t = text.trim();
    if (!t || busy) return;
    setText("");
    const next = [...msgs, { role: "user" as const, text: t }];
    setMsgs(next);
    const { url, key, model } = state.ai;
    if (!url) {
      setMsgs([...next, { role: "assistant", text: "В AI-настройках (Ещё → AI-чат) укажите url эндпоинта, ключ и модель." }]);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(url.replace(/\/$/, "") + "/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(key ? { Authorization: "Bearer " + key } : {}),
        },
        body: JSON.stringify({
          model: model || "gpt-4o-mini",
          messages: next.map((m) => ({ role: m.role, content: m.text })),
        }),
      });
      const json = await res.json();
      const reply = json?.choices?.[0]?.message?.content ?? ("Ошибка ответа: " + res.status);
      setMsgs([...next, { role: "assistant", text: reply }]);
    } catch (e: any) {
      setMsgs([...next, { role: "assistant", text: "Ошибка запроса: " + (e?.message ?? e) }]);
    } finally {
      setBusy(false);
      setTimeout(() => boxRef.current?.scrollTo({ top: 9e9 }), 50);
    }
  };

  return (
    <>
      <AppBar title="AI-чат" />
      <div ref={boxRef} style={{ minHeight: "60vh" }}>
        {msgs.length === 0 && (
          <div className="card muted">
            Напишите сообщение. Эндпоинт, ключ и модель задаются: Ещё → «AI-чат (эндпоинт)».
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={"chat-msg" + (m.role === "user" ? " me" : "")}>{m.text}</div>
        ))}
        {busy && <div className="chat-msg muted">Агент думает…</div>}
      </div>
      <div className="row" style={{ position: "sticky", bottom: 0, background: "var(--bg)" }}>
        <input className="input" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Сообщение агенту…" />
        <button className="sfab" onClick={send}>➤</button>
      </div>
    </>
  );
}
