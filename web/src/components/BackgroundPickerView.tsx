import { useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Camera, ChevronRight, Image as ImageIcon, Loader2, Palette, RotateCcw, X } from "lucide-react";
import { systemBackgrounds } from "@/data/systemBackgrounds";
import { uploadMedia } from "@/services/uploadApi";
import type { AppBackground } from "@/types/background";

export function BackgroundPickerView({
  title,
  currentBackground,
  onBack,
  onSelect,
}: {
  title: string;
  currentBackground: AppBackground | null;
  onBack: () => void;
  onSelect: (background: AppBackground | null) => Promise<void> | void;
}) {
  const [systemOpen, setSystemOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const albumInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const selectBackground = async (background: AppBackground | null) => {
    setBusy(true);
    setNotice("");
    try {
      await onSelect(background);
      setNotice(background ? "背景已保存" : "已恢复默认背景");
      window.setTimeout(onBack, 260);
    } catch (error) {
      console.warn("Failed to save background.", error);
      setNotice("保存失败，请稍后再试");
    } finally {
      setBusy(false);
    }
  };

  const uploadBackground = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setNotice("");
    try {
      const asset = await uploadMedia({
        fileName: file.name,
        mimeType: file.type || "image/jpeg",
        dataBase64: await fileToBase64(file),
        purpose: "background",
      });
      await onSelect({
        id: asset.id,
        name: "自定义背景",
        url: asset.url,
        source: "upload",
        updatedAt: new Date().toISOString(),
      });
      setNotice("背景已保存");
      window.setTimeout(onBack, 260);
    } catch (error) {
      console.warn("Failed to upload background.", error);
      setNotice("上传失败，请换一张图片试试");
    } finally {
      setBusy(false);
    }
  };

  if (systemOpen) {
    return (
      <div className="app-screen-overlay fixed inset-0 z-[96] bg-[#f2f3f1]">
        <section className="mx-auto flex h-full max-w-md flex-col px-4 pb-6 pt-4">
          <BackgroundHeader title="选择背景图" onBack={() => setSystemOpen(false)} onClose={onBack} />
          <div className="mt-4 grid min-h-0 flex-1 grid-cols-2 gap-3 overflow-y-auto pb-2">
            {systemBackgrounds.map((background) => {
              const selected = currentBackground?.url === background.url;
              return (
                <button
                  key={background.id}
                  onClick={() => void selectBackground(background)}
                  disabled={busy}
                  className={`overflow-hidden rounded-lg bg-white text-left shadow-sm ring-2 ${selected ? "ring-[var(--pine)]" : "ring-white/70"}`}
                >
                  <img src={background.url} alt={background.name} className="aspect-[3/4] w-full object-cover" />
                  <span className="flex items-center justify-between px-3 py-2 text-sm font-black text-[var(--text-main)]">
                    {background.name}
                    {selected ? <span className="text-xs text-[var(--pine)]">已选</span> : null}
                  </span>
                </button>
              );
            })}
          </div>
          {notice ? <p className="mt-2 rounded-lg bg-white/78 px-3 py-2 text-center text-xs font-black text-[var(--pine)]">{notice}</p> : null}
        </section>
      </div>
    );
  }

  return (
    <div className="app-screen-overlay fixed inset-0 z-[96] bg-[#eeeeee]">
      <section className="mx-auto flex h-full max-w-md flex-col px-4 pb-8 pt-4">
        <BackgroundHeader title={title} onBack={onBack} onClose={onBack} />
        {currentBackground ? (
          <div className="mt-4 overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-black/5">
            <img src={currentBackground.url} alt={currentBackground.name} className="h-40 w-full object-cover" />
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm font-black text-[var(--text-main)]">{currentBackground.name}</span>
              <button disabled={busy} onClick={() => void selectBackground(null)} className="flex items-center gap-1 rounded-md bg-[#f2f5f3] px-3 py-2 text-xs font-black text-[var(--text-muted)]">
                <RotateCcw className="h-3.5 w-3.5" />
                恢复默认
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-4 overflow-hidden bg-white shadow-sm ring-1 ring-black/5">
          <PickerRow icon={<Palette className="h-5 w-5" />} label="选择背景图" onClick={() => setSystemOpen(true)} />
          <PickerRow icon={<ImageIcon className="h-5 w-5" />} label="从相册中选择" onClick={() => albumInputRef.current?.click()} />
          <PickerRow icon={<Camera className="h-5 w-5" />} label="拍一张" onClick={() => cameraInputRef.current?.click()} />
        </div>

        <input
          ref={albumInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            void uploadBackground(file);
          }}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            void uploadBackground(file);
          }}
        />

        {busy ? (
          <p className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-white/76 px-3 py-3 text-sm font-black text-[var(--pine)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            正在处理背景
          </p>
        ) : notice ? (
          <p className="mt-4 rounded-lg bg-white/76 px-3 py-3 text-center text-sm font-black text-[var(--pine)]">{notice}</p>
        ) : null}
      </section>
    </div>
  );
}

function BackgroundHeader({ title, onBack, onClose }: { title: string; onBack: () => void; onClose: () => void }) {
  return (
    <header className="relative flex h-14 items-center justify-center">
      <button onClick={onBack} className="absolute left-0 safe-tap flex items-center justify-center rounded-lg text-[var(--pine)]" aria-label="返回">
        <ArrowLeft className="h-6 w-6" />
      </button>
      <h1 className="display-cn text-[22px] text-[var(--text-main)]">{title}</h1>
      <button onClick={onClose} className="absolute right-0 safe-tap flex items-center justify-center rounded-lg text-[var(--pine)]" aria-label="关闭">
        <X className="h-5 w-5" />
      </button>
    </header>
  );
}

function PickerRow({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex h-20 w-full items-center gap-3 border-b border-black/5 px-4 text-left last:border-b-0">
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#f3f6f4] text-[var(--pine)]">{icon}</span>
      <span className="min-w-0 flex-1 text-[18px] font-black text-[#1f2925]">{label}</span>
      <ChevronRight className="h-6 w-6 text-black/24" />
    </button>
  );
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });
}
