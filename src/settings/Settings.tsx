import React, { useState } from "react";
import { getState, setState, useStore } from "../store";
import { AppBar, Row, Toggle } from "../ui";
import { Constructor } from "../constructor/Constructor";

/** Вкладка «Ещё»: настройки + вход в Конструктор (как в Android-версии). */
export function MoreTab(props: { showToast: (t: string) => void }) {
  const state = useStore();
  const [screen, setScreen] = useState<"main" | "constructor">("main");

  if (screen === "constructor") {
    return <Constructor onExit={() => setScreen("main")} showToast={props.showToast} />;
  }

  return (
    <>
      <AppBar title="Ещё" />
      <Row title="Конструктор" subtitle="Вкладки, модули панелей, свои кнопки" onClick={() => setScreen("constructor")} />
      <Row
        title="Светлая тема"
        right={<Toggle checked={state.theme === "light"} onChange={(v) => setState({ theme: v ? "light" : "dark" })} />}
      />
      <Row
        title="Пол голоса озвучки"
        right={
          <select value={state.voiceGender} onChange={(e) => setState({ voiceGender: e.target.value as any })} style={{ width: 130 }}>
            <option value="auto">Авто</option>
            <option value="male">Мужской</option>
            <option value="female">Женский</option>
            <option value="neutral">Средний</option>
          </select>
        }
      />
      <Row
        title="Возраст голоса"
        right={
          <select value={state.voiceAge} onChange={(e) => setState({ voiceAge: e.target.value as any })} style={{ width: 130 }}>
            <option value="baby">Младенец</option>
            <option value="child">Ребёнок</option>
            <option value="teen">Подросток</option>
            <option value="adult">Взрослый</option>
            <option value="elder">Пожилой</option>
          </select>
        }
      />
      <Row
        title="Порядок чтения"
        right={
          <select value={state.readerDir} onChange={(e) => setState({ readerDir: e.target.value as any })} style={{ width: 130 }}>
            <option value="rtl">Манга (RTL)</option>
            <option value="ltr">Комикс (LTR)</option>
            <option value="vertical">Вебтун</option>
          </select>
        }
      />
      <div className="card">
        <div className="muted" style={{ marginBottom: 8 }}>AI-чат: OpenAI-совместимый эндпоинт (ключ хранится только локально)</div>
        <input className="input" placeholder="https://api.example.com/v1" value={state.ai.url} onChange={(e) => setState({ ai: { ...state.ai, url: e.target.value } })} />
        <input className="input" placeholder="API-ключ" style={{ marginTop: 8 }} value={state.ai.key} onChange={(e) => setState({ ai: { ...state.ai, key: e.target.value } })} />
        <input className="input" placeholder="Модель" style={{ marginTop: 8 }} value={state.ai.model} onChange={(e) => setState({ ai: { ...state.ai, model: e.target.value } })} />
      </div>
      <div className="card muted">
        Yomikai PWA — веб-двойник Android-читалки yomikai (репозиторий sj0404-collab/yomikai).
        Устанавливается на домашний экран как приложение, работает оффлайн (оболочка и библиотека).
      </div>
    </>
  );
}
