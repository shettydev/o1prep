"use client";

import { useState } from "react";
import type { EngineConfig } from "@/lib/types";
import { useSettings } from "@/store/settings";
import { useUI } from "@/store/ui";
import { Modal } from "./Modal";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-4 py-2">
      <span className="text-[12px] text-text-dim">{label}</span>
      {children}
    </label>
  );
}

const selectClass =
  "border border-line bg-bg-inset px-2 py-1.5 text-[12px] text-text focus:border-amber focus:outline-none min-w-[180px]";

/** Mounted only when the modal is open, so drafts init from saved/defaults once. */
function SettingsForm({ config, onClose }: { config: EngineConfig; onClose: () => void }) {
  const saved = useSettings();
  const [model, setModel] = useState(saved.model || config.default_model);
  const [effort, setEffort] = useState(saved.effort || config.default_effort);
  const [language, setLanguage] = useState(saved.language || config.default_language);

  const save = () => {
    saved.set({ model, effort: config.supports_effort ? effort : "", language });
    onClose();
  };

  return (
    <div>
      <p className="mb-3 text-[12px] text-text-dim">
        provider: <span className="text-amber">{config.provider}</span>. applies to new
        interviews and tutor chats.
      </p>

      <div className="divide-y divide-line">
        <Field label="default language">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className={selectClass}
          >
            {config.languages.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="model">
          <select value={model} onChange={(e) => setModel(e.target.value)} className={selectClass}>
            {config.models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </Field>

        {config.supports_effort && config.efforts.length > 0 && (
          <Field label="reasoning effort">
            <select
              value={effort}
              onChange={(e) => setEffort(e.target.value)}
              className={selectClass}
            >
              {config.efforts.map((ef) => (
                <option key={ef} value={ef}>
                  {ef.charAt(0).toUpperCase() + ef.slice(1)}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>

      {config.supports_effort && (
        <p className="mt-3 text-[11px] text-text-faint">
          Higher effort means deeper reasoning but slower, costlier responses.
        </p>
      )}

      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="tbtn">
          cancel
        </button>
        <button onClick={save} className="tbtn tbtn-amber">
          save
        </button>
      </div>
    </div>
  );
}

export function SettingsModal() {
  const open = useUI((s) => s.settings);
  const close = useUI((s) => s.close);
  const config = useSettings((s) => s.config);

  return (
    <Modal open={open} onClose={() => close("settings")} title="engine settings">
      {config ? (
        <SettingsForm config={config} onClose={() => close("settings")} />
      ) : (
        <div className="text-[12px] text-text-faint">loading config…</div>
      )}
    </Modal>
  );
}
