import { createPortal } from "react-dom";
import { X } from "lucide-react";

export interface WorkoutSummaryData {
  studentFirstName: string;
  focus: string;
  durationMinutes: number;
  calories: number;
}

interface Props extends WorkoutSummaryData {
  onClose: () => void;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function generateStoryCanvas(data: WorkoutSummaryData): HTMLCanvasElement {
  const W = 1080;
  const H = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // — Background gradient
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#022c22");
  bg.addColorStop(0.45, "#065f46");
  bg.addColorStop(1, "#0f4c37");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // — Subtle grid
  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 19; i++) {
    ctx.beginPath(); ctx.moveTo(i * 60, 0); ctx.lineTo(i * 60, H); ctx.stroke();
  }
  for (let i = 0; i < 33; i++) {
    ctx.beginPath(); ctx.moveTo(0, i * 60); ctx.lineTo(W, i * 60); ctx.stroke();
  }

  // — Top bar
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(0, 0, W, 130);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 52px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("GESFIT PRO", W / 2, 82);
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.font = "28px system-ui, sans-serif";
  ctx.fillText("gesfit.rpngestao.com.br", W / 2, 118);

  // — Trophy circle
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.beginPath();
  ctx.arc(W / 2, 420, 220, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(110,231,183,0.3)";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(W / 2, 420, 220, 0, Math.PI * 2);
  ctx.stroke();

  // Trophy symbol (text fallback using text art)
  ctx.font = "220px serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "#fbbf24";
  ctx.fillText("🏆", W / 2, 520);

  // — "TREINO CONCLUÍDO" label
  ctx.fillStyle = "#6ee7b7";
  ctx.font = "bold 48px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("TREINO CONCLUÍDO", W / 2, 720);

  // — Student name
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 110px system-ui, sans-serif";
  ctx.fillText(data.studentFirstName.toUpperCase(), W / 2, 850);

  // — Separator
  const sepGrad = ctx.createLinearGradient(160, 0, W - 160, 0);
  sepGrad.addColorStop(0, "transparent");
  sepGrad.addColorStop(0.3, "#6ee7b7");
  sepGrad.addColorStop(0.7, "#6ee7b7");
  sepGrad.addColorStop(1, "transparent");
  ctx.strokeStyle = sepGrad;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(160, 900);
  ctx.lineTo(W - 160, 900);
  ctx.stroke();

  // — Focus text
  const focusText = data.focus.length > 22 ? data.focus.substring(0, 22) + "…" : data.focus;
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = "bold 38px system-ui, sans-serif";
  ctx.fillText("Foco: " + focusText, W / 2, 960);

  // — Stat cards
  const cW = 290;
  const cH = 310;
  const gapC = 30;
  const totalW = cW * 3 + gapC * 2;
  const startX = (W - totalW) / 2;
  const cY = 1020;

  const stats = [
    { emoji: "⏱", value: `${data.durationMinutes}`, unit: "min", label: "Tempo", color: "#93c5fd" },
    { emoji: "🔥", value: `~${data.calories}`, unit: "kcal", label: "Calorias", color: "#fbbf24" },
    { emoji: "💪", value: String(Math.round(data.calories / 7)), unit: "pts", label: "Pontos", color: "#f472b6" },
  ];

  stats.forEach((s, i) => {
    const cx = startX + i * (cW + gapC);
    // Card
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    roundRect(ctx, cx, cY, cW, cH, 28);
    ctx.fill();
    ctx.strokeStyle = s.color + "55";
    ctx.lineWidth = 3;
    roundRect(ctx, cx, cY, cW, cH, 28);
    ctx.stroke();

    // Emoji
    ctx.font = "72px serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(s.emoji, cx + cW / 2, cY + 100);

    // Value
    ctx.font = "bold 64px system-ui, sans-serif";
    ctx.fillStyle = s.color;
    ctx.fillText(s.value, cx + cW / 2, cY + 190);

    // Unit
    ctx.font = "bold 28px system-ui, sans-serif";
    ctx.fillStyle = s.color + "99";
    ctx.fillText(s.unit, cx + cW / 2, cY + 228);

    // Label
    ctx.font = "bold 26px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.fillText(s.label.toUpperCase(), cx + cW / 2, cY + 280);
  });

  // — Bottom footer
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fillRect(0, H - 130, W, 130);
  ctx.fillStyle = "#6ee7b7";
  ctx.font = "bold 34px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Compartilhe sua conquista! 🎉", W / 2, H - 80);
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.font = "24px system-ui, sans-serif";
  ctx.fillText("#GesftPro #Treino #Fitness", W / 2, H - 40);

  return canvas;
}

export function WorkoutSummaryModal({ studentFirstName, focus, durationMinutes, calories, onClose }: Props) {
  function handleDownloadStory() {
    const canvas = generateStoryCanvas({ studentFirstName, focus, durationMinutes, calories });
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `treino-${studentFirstName.toLowerCase()}-story.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, "image/png");
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/70 animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm overflow-hidden rounded-t-3xl sm:rounded-3xl bg-gradient-to-b from-emerald-800 to-emerald-950 text-white shadow-2xl animate-slide-up">
        {/* Close */}
        <div className="relative px-6 pt-6 pb-2 text-center">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-1.5 hover:bg-white/20 transition-colors"
          >
            <X size={18} />
          </button>

          {/* Trophy */}
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-400/20 ring-4 ring-amber-400/40 text-5xl mb-4">
            🏆
          </div>

          <p className="text-xs font-bold uppercase tracking-widest text-emerald-300">
            Treino Concluído!
          </p>
          <h2 className="mt-1 text-4xl font-black tracking-tight">
            {studentFirstName}
          </h2>
          <p className="mt-1.5 text-sm font-semibold text-white/60 line-clamp-1">{focus}</p>
        </div>

        {/* Divider */}
        <div className="mx-6 my-4 h-px bg-white/10" />

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 px-6">
          <div className="rounded-2xl bg-white/10 p-3 text-center">
            <p className="text-2xl">⏱</p>
            <p className="mt-1 text-xl font-black text-blue-300">{durationMinutes}</p>
            <p className="text-[10px] font-bold text-blue-300/60">min</p>
            <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-white/40">Tempo</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-3 text-center">
            <p className="text-2xl">🔥</p>
            <p className="mt-1 text-xl font-black text-amber-300">~{calories}</p>
            <p className="text-[10px] font-bold text-amber-300/60">kcal</p>
            <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-white/40">Calorias</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-3 text-center">
            <p className="text-2xl">💪</p>
            <p className="mt-1 text-xl font-black text-pink-300">{Math.round(calories / 7)}</p>
            <p className="text-[10px] font-bold text-pink-300/60">pts</p>
            <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-white/40">Pontos</p>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3 px-6 py-5">
          <button
            type="button"
            onClick={handleDownloadStory}
            className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500 px-4 py-4 text-sm font-black text-white shadow-lg hover:opacity-90 transition-opacity"
          >
            <span className="text-base">📸</span>
            Baixar Card para Story
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white/10 px-4 py-3.5 text-sm font-bold text-white hover:bg-white/20 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
