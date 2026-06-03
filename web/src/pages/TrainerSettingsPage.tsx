import {
  Building2,
  CheckCircle2,
  Clock,
  Home,
  MapPin,
  Minus,
  Plus,
  Search,
  Settings,
  Timer,
  Trees,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { GYM_CATALOG, gymTypeIcon, gymTypeLabel, searchGyms } from "../data/gyms";
import { sampleTeams, sampleTrainerAvailability } from "../data/sample";
import type { GymLocation, TrainerAvailabilityDay } from "../types/domain";

const WEEKDAY_LABELS: Record<TrainerAvailabilityDay["weekday"], string> = {
  segunda: "Segunda-feira",
  terca: "Terça-feira",
  quarta: "Quarta-feira",
  quinta: "Quinta-feira",
  sexta: "Sexta-feira",
  sabado: "Sábado",
  domingo: "Domingo",
};

const LOCATION_ICONS = {
  gym: Building2,
  home: Home,
  condo: Building2,
  outdoor: Trees,
};

function locationTypeColor(type: GymLocation["type"]) {
  return (
    {
      gym: "bg-blue-50 text-blue-700 border-blue-100",
      home: "bg-emerald-50 text-emerald-700 border-emerald-100",
      condo: "bg-violet-50 text-violet-700 border-violet-100",
      outdoor: "bg-amber-50 text-amber-700 border-amber-100",
    }[type] ?? ""
  );
}

export function TrainerSettingsPage() {
  const team = sampleTeams[0];
  const [availability, setAvailability] = useState<TrainerAvailabilityDay[]>(
    sampleTrainerAvailability,
  );
  const [selectedGyms, setSelectedGyms] = useState<GymLocation[]>(team.worksAt);
  const [acceptsHome, setAcceptsHome] = useState(team.acceptsHomeVisit);
  const [acceptsCondo, setAcceptsCondo] = useState(team.acceptsCondoGym);
  const [gymSearch, setGymSearch] = useState("");
  const [showGymPicker, setShowGymPicker] = useState(false);
  const [saved, setSaved] = useState(false);

  const filteredGyms = useMemo(() => searchGyms(gymSearch).filter((g) => g.type === "gym"), [gymSearch]);

  function toggleGym(gym: GymLocation) {
    setSelectedGyms((prev) =>
      prev.some((g) => g.id === gym.id) ? prev.filter((g) => g.id !== gym.id) : [...prev, gym],
    );
  }

  function updateDay(
    weekday: TrainerAvailabilityDay["weekday"],
    patch: Partial<TrainerAvailabilityDay>,
  ) {
    setAvailability((prev) =>
      prev.map((d) => (d.weekday === weekday ? { ...d, ...patch } : d)),
    );
  }

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  const totalSlotMinutes = (day: TrainerAvailabilityDay) =>
    day.classDurationMinutes + day.travelMinutes;

  return (
    <section className="mx-auto max-w-5xl px-4 py-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">
            Configurações
          </p>
          <h1
            className="mt-2 text-3xl font-black text-stone-950"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Agenda e locais de atendimento
          </h1>
          <p className="mt-2 text-sm leading-7 text-stone-500">
            Defina suas academias, tempo de aula e deslocamento. O sistema bloqueia
            automaticamente os slots seguintes.
          </p>
        </div>
        <button
          type="button"
          id="btn-save-settings"
          className={[
            "focus-ring inline-flex h-11 shrink-0 items-center gap-2 rounded-xl px-6 text-sm font-bold text-white transition-all",
            saved
              ? "bg-emerald-600"
              : "bg-stone-950 hover:bg-stone-800 shadow-[0_4px_16px_-2px_rgba(0,0,0,0.25)]",
          ].join(" ")}
          onClick={handleSave}
        >
          {saved ? (
            <>
              <CheckCircle2 size={18} />
              Salvo!
            </>
          ) : (
            <>
              <Settings size={18} />
              Salvar configurações
            </>
          )}
        </button>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        {/* ── COLUNA ESQUERDA: Academias ──────────────────────────────────── */}
        <div className="space-y-4">
          {/* Academias selecionadas */}
          <section className="card p-5">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-50">
                <MapPin aria-hidden="true" className="text-blue-700" size={16} />
              </div>
              <h2 className="text-lg font-black text-stone-950">Academias onde atendo</h2>
            </div>
            <p className="mt-1 text-xs text-stone-400">
              Alunos poderão filtrar treinadores por academia na vitrine pública.
            </p>

            {/* Lista selecionada */}
            <div className="mt-4 space-y-2">
              {selectedGyms.length === 0 ? (
                <p className="text-sm text-stone-400 italic">Nenhuma academia selecionada.</p>
              ) : (
                selectedGyms.map((gym) => {
                  const Icon = LOCATION_ICONS[gym.type];
                  return (
                    <div
                      key={gym.id}
                      className={[
                        "flex items-center gap-3 rounded-xl border px-4 py-3",
                        locationTypeColor(gym.type),
                      ].join(" ")}
                    >
                      <Icon size={16} className="shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold">{gym.name}</p>
                        <p className="truncate text-xs opacity-70">{gym.address}</p>
                      </div>
                      <button
                        type="button"
                        aria-label={`Remover ${gym.name}`}
                        className="focus-ring flex h-7 w-7 shrink-0 items-center justify-center rounded-lg opacity-60 hover:bg-black/10 hover:opacity-100 transition-all"
                        onClick={() => toggleGym(gym)}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <button
              type="button"
              id="btn-add-gym"
              className="focus-ring mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-stone-200 text-sm font-semibold text-stone-500 transition-all hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-700"
              onClick={() => setShowGymPicker((v) => !v)}
            >
              {showGymPicker ? <Minus size={16} /> : <Plus size={16} />}
              {showGymPicker ? "Fechar busca" : "Adicionar academia"}
            </button>

            {/* Busca de academias */}
            {showGymPicker && (
              <div className="mt-3 animate-slide-up">
                <div className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-stone-50 px-3">
                  <Search className="text-stone-400" size={16} />
                  <input
                    className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-stone-400"
                    placeholder="Buscar por nome ou bairro…"
                    value={gymSearch}
                    onChange={(e) => setGymSearch(e.target.value)}
                  />
                </div>
                <div className="mt-2 max-h-60 overflow-y-auto rounded-xl border border-[var(--color-border)] bg-white">
                  {filteredGyms.map((gym) => {
                    const isSelected = selectedGyms.some((g) => g.id === gym.id);
                    return (
                      <button
                        key={gym.id}
                        type="button"
                        className={[
                          "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-stone-50",
                          isSelected ? "bg-emerald-50" : "",
                        ].join(" ")}
                        onClick={() => toggleGym(gym)}
                      >
                        <span className="text-lg">{gymTypeIcon(gym.type)}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-stone-900">{gym.name}</p>
                          <p className="truncate text-xs text-stone-400">{gym.address}</p>
                        </div>
                        {isSelected && (
                          <CheckCircle2 className="shrink-0 text-emerald-600" size={16} />
                        )}
                      </button>
                    );
                  })}
                  {filteredGyms.length === 0 && (
                    <p className="px-4 py-6 text-center text-sm text-stone-400">
                      Nenhuma academia encontrada.
                    </p>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* Tipos especiais de atendimento */}
          <section className="card p-5">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50">
                <Home aria-hidden="true" className="text-emerald-700" size={16} />
              </div>
              <h2 className="text-lg font-black text-stone-950">Tipos especiais</h2>
            </div>
            <p className="mt-1 text-xs text-stone-400">
              Aparece como filtro na vitrine pública.
            </p>

            <div className="mt-4 space-y-3">
              <ToggleRow
                id="toggle-home"
                icon={Home}
                label="Atendimento domiciliar"
                description="Desloco até a residência do aluno"
                checked={acceptsHome}
                onChange={setAcceptsHome}
                color="emerald"
              />
              <ToggleRow
                id="toggle-condo"
                icon={Building2}
                label="Academia do condomínio"
                description="Atendo na academia do condomínio do aluno"
                checked={acceptsCondo}
                onChange={setAcceptsCondo}
                color="violet"
              />
            </div>
          </section>
        </div>

        {/* ── COLUNA DIREITA: Agenda + Deslocamento ──────────────────────── */}
        <section className="card p-5">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-50">
              <Clock aria-hidden="true" className="text-amber-700" size={16} />
            </div>
            <h2 className="text-lg font-black text-stone-950">Horários e deslocamento</h2>
          </div>
          <p className="mt-1 text-xs text-stone-400">
            O slot total bloqueado = duração da aula + tempo de deslocamento.
          </p>

          {/* Legenda visual */}
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-stone-50 px-4 py-3">
            <Clock className="text-emerald-700" size={15} />
            <span className="text-xs font-semibold text-stone-600">Aula</span>
            <div className="h-3 w-16 rounded-sm bg-emerald-400" />
            <span className="text-xs text-stone-400">+</span>
            <Timer className="text-amber-600" size={15} />
            <span className="text-xs font-semibold text-stone-600">Deslocamento</span>
            <div className="h-3 w-6 rounded-sm bg-amber-300" />
            <span className="text-xs text-stone-400">=</span>
            <span className="text-xs font-bold text-stone-700">Slot bloqueado</span>
          </div>

          <div className="mt-4 space-y-3">
            {availability.map((day) => (
              <DayAvailabilityRow
                key={day.weekday}
                day={day}
                label={WEEKDAY_LABELS[day.weekday]}
                onUpdate={(patch) => updateDay(day.weekday, patch)}
                totalSlot={totalSlotMinutes(day)}
              />
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

// ── Sub-componentes ──────────────────────────────────────────────────────────

function ToggleRow({
  id,
  icon: Icon,
  label,
  description,
  checked,
  onChange,
  color,
}: {
  id: string;
  icon: typeof Home;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  color: "emerald" | "violet";
}) {
  const activeClass = color === "emerald" ? "bg-emerald-600" : "bg-violet-600";
  return (
    <label
      htmlFor={id}
      className={[
        "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-all",
        checked ? (color === "emerald" ? "border-emerald-200 bg-emerald-50" : "border-violet-200 bg-violet-50") : "border-[var(--color-border)] bg-white hover:border-stone-300",
      ].join(" ")}
    >
      <Icon
        size={18}
        className={checked ? (color === "emerald" ? "text-emerald-700" : "text-violet-700") : "text-stone-400"}
      />
      <div className="flex-1">
        <p className="text-sm font-bold text-stone-900">{label}</p>
        <p className="mt-0.5 text-xs text-stone-500">{description}</p>
      </div>
      {/* Toggle switch */}
      <div className="relative mt-0.5 shrink-0">
        <input
          id={id}
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <div
          className={[
            "h-6 w-11 rounded-full transition-colors duration-200",
            checked ? activeClass : "bg-stone-300",
          ].join(" ")}
        />
        <div
          className={[
            "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200",
            checked ? "translate-x-5" : "translate-x-0",
          ].join(" ")}
        />
      </div>
    </label>
  );
}

function DayAvailabilityRow({
  day,
  label,
  totalSlot,
  onUpdate,
}: {
  day: TrainerAvailabilityDay;
  label: string;
  totalSlot: number;
  onUpdate: (patch: Partial<TrainerAvailabilityDay>) => void;
}) {
  return (
    <div
      className={[
        "rounded-xl border transition-all",
        day.active
          ? "border-emerald-200 bg-emerald-50"
          : "border-[var(--color-border)] bg-stone-50 opacity-60",
      ].join(" ")}
    >
      {/* Cabeçalho do dia */}
      <label className="flex cursor-pointer items-center gap-3 px-4 py-3">
        <input
          type="checkbox"
          checked={day.active}
          onChange={(e) => onUpdate({ active: e.target.checked })}
          className="h-4 w-4 rounded accent-emerald-600"
        />
        <span className="flex-1 text-sm font-bold text-stone-900">{label}</span>
        {day.active && (
          <span className="badge badge-green text-xs">
            {day.morningStartTime} – {day.afternoonEndTime}
          </span>
        )}
      </label>

      {day.active && (
        <div className="border-t border-emerald-100 px-4 pb-4 pt-3">
          {/* Horários */}
          <div className="grid grid-cols-2 gap-3">
            <TimeField
              label="Manhã — início"
              value={day.morningStartTime}
              onChange={(v) => onUpdate({ morningStartTime: v })}
            />
            <TimeField
              label="Manhã — fim"
              value={day.morningEndTime}
              onChange={(v) => onUpdate({ morningEndTime: v })}
            />
            <TimeField
              label="Tarde — início"
              value={day.afternoonStartTime}
              onChange={(v) => onUpdate({ afternoonStartTime: v })}
            />
            <TimeField
              label="Tarde — fim"
              value={day.afternoonEndTime}
              onChange={(v) => onUpdate({ afternoonEndTime: v })}
            />
          </div>

          {/* Duração + Deslocamento */}
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-600">
                <Clock className="mr-1 inline text-emerald-700" size={12} />
                Duração da aula (min)
              </label>
              <input
                type="number"
                min={15}
                max={120}
                step={5}
                value={day.classDurationMinutes}
                onChange={(e) => onUpdate({ classDurationMinutes: Number(e.target.value) })}
                className="input mt-1.5 text-center font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-600">
                <Timer className="mr-1 inline text-amber-600" size={12} />
                Deslocamento (min)
              </label>
              <input
                type="number"
                min={0}
                max={60}
                step={5}
                value={day.travelMinutes}
                onChange={(e) => onUpdate({ travelMinutes: Number(e.target.value) })}
                className="input mt-1.5 text-center font-bold"
              />
            </div>
          </div>

          {/* Visualização do slot total */}
          <div className="mt-3 overflow-hidden rounded-xl bg-white p-3">
            <p className="text-xs font-semibold text-stone-500 mb-2">Slot bloqueado por atendimento</p>
            <div className="flex items-center gap-1">
              {/* Barra de aula */}
              <div
                className="flex h-7 items-center justify-center rounded-l-lg bg-emerald-500 px-2 text-xs font-bold text-white transition-all"
                style={{ width: `${(day.classDurationMinutes / totalSlot) * 100}%`, minWidth: 40 }}
              >
                {day.classDurationMinutes}min
              </div>
              {/* Barra de deslocamento */}
              {day.travelMinutes > 0 && (
                <div
                  className="flex h-7 items-center justify-center rounded-r-lg bg-amber-400 px-2 text-xs font-bold text-stone-900 transition-all"
                  style={{ width: `${(day.travelMinutes / totalSlot) * 100}%`, minWidth: 32 }}
                >
                  {day.travelMinutes}min
                </div>
              )}
              <span className="ml-2 text-xs font-black text-stone-700 shrink-0">
                = {totalSlot} min
              </span>
            </div>
            <p className="mt-2 text-xs text-stone-400">
              Próximo horário disponível: {totalSlot} minutos após o início da aula.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function TimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-stone-600">{label}</label>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input mt-1.5"
      />
    </div>
  );
}
