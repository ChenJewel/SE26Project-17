import { useState } from "react";
import { Check, Plus, X } from "lucide-react";

/**
 * 我的偏好标签编辑器。
 *
 * 当前标签直接写回 App/hook state；正式版应调用用户偏好接口，
 * 并用 tagId 存储选择关系，避免同名标签冲突。
 */
export function PreferenceTagEditor({
  selectedTags,
  tagOptions,
  onSave,
  onClose,
}: {
  selectedTags: string[];
  tagOptions: string[];
  onSave: (selectedTags: string[], tagOptions: string[]) => void;
  onClose: () => void;
}) {
  const [draftTags, setDraftTags] = useState(selectedTags);
  const [draftOptions, setDraftOptions] = useState(() => uniqueValues([...tagOptions, ...selectedTags]));
  const [customTag, setCustomTag] = useState("");

  const toggleTag = (tag: string) => {
    setDraftTags((current) => (current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]));
  };

  const addTag = () => {
    const nextTag = customTag.trim();
    if (!nextTag) return;
    setDraftOptions((current) => uniqueValues([...current, nextTag]));
    setDraftTags((current) => uniqueValues([...current, nextTag]));
    setCustomTag("");
  };

  return (
    <div className="fixed inset-0 z-[75] flex items-end bg-[rgba(18,30,25,0.34)] px-3 pb-3">
      <section className="mx-auto flex max-h-[82dvh] w-full max-w-md flex-col rounded-lg bg-[var(--surface)] p-4 shadow-[0_22px_54px_rgba(23,38,32,0.28)]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase text-[var(--pine)]">Tags</p>
            <h2 className="display-cn text-[22px] text-[var(--text-main)]">编辑我的偏好</h2>
          </div>
          <button onClick={onClose} className="safe-tap flex items-center justify-center rounded-lg bg-[rgba(209,228,221,0.72)] text-[var(--pine)]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-3 grid grid-cols-[1fr_auto] gap-2">
          <input
            value={customTag}
            onChange={(event) => setCustomTag(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") addTag();
            }}
            className="h-11 min-w-0 rounded-lg bg-[rgba(244,248,244,0.92)] px-4 text-sm font-bold text-[var(--text-main)] outline-none ring-1 ring-[var(--line-soft)] placeholder:text-[var(--text-faint)] focus:ring-[var(--moss)]"
            placeholder="创建新标签"
          />
          <button onClick={addTag} className="flex h-11 items-center gap-1 rounded-lg bg-[var(--pine)] px-4 text-sm font-black text-white">
            <Plus className="h-4 w-4" />
            添加
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex flex-wrap gap-2">
            {draftOptions.map((tag) => {
              const selected = draftTags.includes(tag);
              return (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-black transition ${
                    selected
                      ? "bg-[var(--pine)] text-white"
                      : "bg-white/82 text-[var(--text-muted)] ring-1 ring-[var(--line-soft)]"
                  }`}
                >
                  {selected ? <Check className="h-3.5 w-3.5" /> : null}
                  {tag}
                </button>
              );
            })}
          </div>
        </div>

        <button
          onClick={() => onSave(draftTags, draftOptions)}
          className="mt-4 h-12 rounded-lg bg-[var(--pine)] text-sm font-black text-white shadow-[0_12px_26px_rgba(63,111,96,0.22)]"
        >
          保存偏好
        </button>
      </section>
    </div>
  );
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}
