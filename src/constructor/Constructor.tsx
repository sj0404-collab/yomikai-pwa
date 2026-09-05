import React, { useState } from "react";
import { getState, setState, useStore, TABS, MODULES, CustomAction, resetConstructor, isTabHidden } from "../store";
import { AppBar, Row, Toggle, Dialog } from "../ui";

/** «Конструктор» PWA — зеркало экрана конструктора Android-версии. */
export function Constructor(props: { onExit: () => void; showToast: (t: string) => void }) {
  const state = useStore();
  const [editor, setEditor] = useState<CustomAction | null>(null);
  const [creating, setCreating] = useState(false);

  const ordered = (() => {
    const list = TABS.map((t) => ({ ...t }));
    const order = state.tabOrder;
    if (!order.length) return list;
    return list.sort((a, b) => {
      const ia = order.indexOf(a.id);
      const ib = order.indexOf(b.id);
      return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
    });
  })();

  const move = (id: string, delta: number) => {
    const ids: string[] = ordered.map((t) => t.id);
    const i = ids.indexOf(id);
    const j = i + delta;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    setState({ tabOrder: ids });
  };

  return (
    <>
      <AppBar title="Конструктор" back={props.onExit} />
      <div className="card muted">Вкладки нижней панели: скрыть/показать и переставить.</div>
      {ordered.map((t, i) => (
        <Row
          key={t.id}
          title={t.title + ((t as any).pinned ? " (закреплена)" : "")}
          right={
            <>
              <button className="chip" onClick={() => move(t.id, -1)} disabled={i === 0}>↑</button>
              <button className="chip" onClick={() => move(t.id, 1)} disabled={i === ordered.length - 1}>↓</button>
              <Toggle
                checked={!isTabHidden(t.id)}
                disabled={Boolean((t as any).pinned)}
                onChange={(v) =>
                  setState({ hiddenTabs: v ? state.hiddenTabs.filter((x) => x !== t.id) : [...state.hiddenTabs, t.id] })
                }
              />
            </>
          }
        />
      ))}
      <div className="card muted">Модули панелей читалки и браузера.</div>
      {MODULES.map((m) => (
        <Row
          key={m.id}
          title={m.title}
          right={
            <Toggle
              checked={!state.hiddenModules.includes(m.id)}
              onChange={(v) =>
                setState({
                  hiddenModules: v
                    ? state.hiddenModules.filter((x) => x !== m.id)
                    : [...state.hiddenModules, m.id],
                })
              }
            />
          }
        />
      ))}
      <div className="card muted">Мои кнопки действий (замкнутый список эффектов).</div>
      {state.actions.map((a) => (
        <Row
          key={a.id}
          title={a.title}
          subtitle={`${a.placement} · ${a.effect}${a.value ? " = " + a.value : ""}`}
          right={
            <>
              <button className="chip" onClick={() => setEditor(a)}>✎</button>
              <button className="chip" onClick={() => setState({ actions: state.actions.filter((x) => x.id !== a.id) })}>🗑</button>
            </>
          }
        />
      ))}
      <div className="row">
        <button className="chip on" onClick={() => setCreating(true)}>+ Создать кнопку</button>
        <button className="chip" onClick={() => { resetConstructor(); props.showToast("Модули и порядок сброшены"); }}>Сбросить модули и порядок</button>
      </div>
      {(creating || editor) && (
        <ActionEditor
          initial={editor}
          onClose={() => { setCreating(false); setEditor(null); }}
          onSave={(spec) => {
            const rest = state.actions.filter((x) => x.id !== spec.id);
            setState({ actions: [...rest, spec] });
            setCreating(false);
            setEditor(null);
            props.showToast("Кнопка сохранена");
          }}
        />
      )}
    </>
  );
}

function ActionEditor(props: { initial: CustomAction | null; onClose: () => void; onSave: (a: CustomAction) => void }) {
  const [title, setTitle] = useState(props.initial?.title ?? "");
  const [placement, setPlacement] = useState<CustomAction["placement"]>(props.initial?.placement ?? "floating_menu");
  const [effect, setEffect] = useState<CustomAction["effect"]>(props.initial?.effect ?? "theme");
  const [value, setValue] = useState(props.initial?.value ?? "");
  return (
    <Dialog title={props.initial ? "Кнопка «" + props.initial.title + "»" : "Новая кнопка"} onClose={props.onClose}>
      <input className="input" placeholder="Название" value={title} onChange={(e) => setTitle(e.target.value)} />
      <select value={placement} onChange={(e) => setPlacement(e.target.value as any)}>
        <option value="floating_menu">Плавающее меню читалки</option>
        <option value="ocr_card">Карточка результата OCR</option>
      </select>
      <select value={effect} onChange={(e) => setEffect(e.target.value as any)}>
        <option value="theme">Переключить тему</option>
        <option value="voice_preset">Пресет голоса (значение: male/female/neutral/auto)</option>
        <option value="reader_dir">Порядок чтения (rtl/ltr/vertical)</option>
        <option value="tts_stop">Остановить озвучку</option>
      </select>
      <input className="input" placeholder="Значение (если нужно)" value={value} onChange={(e) => setValue(e.target.value)} />
      <button
        className="chip on"
        onClick={() =>
          props.onSave({
            id: props.initial?.id ?? "act_" + Date.now(),
            title: title.trim() || "Кнопка",
            placement,
            effect,
            value,
          })
        }
      >
        Сохранить
      </button>
    </Dialog>
  );
}
