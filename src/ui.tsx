import React, { useEffect, useState } from "react";

export function AppBar(props: { title: string; back?: () => void; right?: React.ReactNode }) {
  return (
    <div className="appbar">
      {props.back && <button onClick={props.back} aria-label="Назад">←</button>}
      <h1>{props.title}</h1>
      {props.right}
    </div>
  );
}

export function Row(props: {
  title: string;
  subtitle?: string;
  onClick?: () => void;
  right?: React.ReactNode;
}) {
  return (
    <div className="row" onClick={props.onClick} style={{ cursor: props.onClick ? "pointer" : "default" }}>
      <div className="grow">
        <div>{props.title}</div>
        {props.subtitle && <div className="muted">{props.subtitle}</div>}
      </div>
      {props.right}
    </div>
  );
}

export function Toggle(props: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <input
      type="checkbox"
      checked={props.checked}
      disabled={props.disabled}
      onChange={(e) => props.onChange(e.target.checked)}
      style={{ width: 20, height: 20 }}
    />
  );
}

export function useToast(): [string | null, (t: string) => void] {
  const [toast, setToast] = useState<string | null>(null);
  const show = (t: string) => {
    setToast(t);
    window.setTimeout(() => setToast(null), 2600);
  };
  return [toast, show];
}

export function ToastHost(props: { text: string | null }) {
  if (!props.text) return null;
  return <div className="toast">{props.text}</div>;
}

export function Dialog(props: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="dialog-back" onClick={props.onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <div className="grow" style={{ fontWeight: 600 }}>{props.title}</div>
          <button onClick={props.onClose}>✕</button>
        </div>
        {props.children}
      </div>
    </div>
  );
}

/** Иконки-заглушки в стиле material (текстовые глифы, без зависимостей). */
export const Ic = {
  library: "📚",
  local: "🗂",
  updates: "🆕",
  history: "🕘",
  browse: "🧭",
  browser: "🌐",
  ai: "🤖",
  more: "⋯",
};
