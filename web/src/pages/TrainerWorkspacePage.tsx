import { CalendarClock, Camera, Check, Clock, Image, Palette, ToggleRight, Video } from "lucide-react";
import { sampleTeams, sampleTrainerAvailability, trainingModalities } from "../data/sample";
import type { TrainerAvailabilityDay } from "../types/domain";

export function TrainerWorkspacePage() {
  const team = sampleTeams[0];

  return (
    <section className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-emerald-800">
            Area do treinador
          </p>
          <h1 className="mt-2 text-3xl font-black">Personalizar ambiente</h1>
          <p className="mt-2 max-w-3xl leading-7 text-stone-600">
            Configure paleta, fotos, banner, modalidades e o que sera divulgado na landing page
            publica do seu perfil.
          </p>
        </div>
      </div>

      <section className="mt-6 overflow-hidden rounded-lg border border-stone-200 bg-white">
        <div
          className="relative h-56 bg-stone-900"
          style={{
            backgroundImage: `linear-gradient(90deg, rgba(12, 19, 16, 0.8), rgba(12, 19, 16, 0.2)), url(${team.branding.bannerPhotoURL})`,
            backgroundPosition: "center",
            backgroundSize: "cover",
          }}
        >
          <div className="absolute bottom-5 left-5 flex items-end gap-4">
            <img
              className="h-24 w-24 rounded-lg border-4 border-white object-cover shadow-lg"
              src={team.branding.trainerPhotoURL}
              alt=""
            />
            <div className="pb-1 text-white">
              <p className="text-sm font-bold uppercase tracking-wide text-emerald-100">
                Previa publica
              </p>
              <h2 className="text-3xl font-black">{team.name}</h2>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-lg border border-stone-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <Palette aria-hidden="true" className="text-emerald-800" size={22} />
            <h2 className="text-xl font-black">Paleta e identidade</h2>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Nome publico" placeholder={team.name} />
            <Field label="Mensagem da landing" placeholder={team.branding.welcomeMessage} />
            <ColorField label="Cor primaria" value={team.branding.primaryColor} />
            <ColorField label="Cor secundaria" value={team.branding.secondaryColor ?? "#f59e0b"} />
            <label className="block sm:col-span-2">
              <span className="text-sm font-semibold text-stone-700">Bio publica</span>
              <textarea
                className="focus-ring mt-2 min-h-28 w-full rounded-md border border-stone-300 px-3 py-2"
                placeholder={team.branding.bio}
              />
            </label>
          </div>
        </section>

        <section className="rounded-lg border border-stone-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <Image aria-hidden="true" className="text-emerald-800" size={22} />
            <h2 className="text-xl font-black">Fotos e banner</h2>
          </div>
          <div className="mt-5 grid gap-4">
            <UploadField
              icon={Camera}
              label="Foto do treinador"
              body="Imagem quadrada para perfil, cards e area do aluno."
            />
            <UploadField
              icon={Video}
              label="Banner estilo YouTube"
              body="Imagem horizontal para topo da landing e painel."
            />
            <UploadField
              icon={Image}
              label="Fotos da galeria"
              body="Fotos que podem aparecer na landing quando a divulgacao estiver ativa."
            />
          </div>
        </section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-lg border border-stone-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <ToggleRight aria-hidden="true" className="text-emerald-800" size={22} />
            <h2 className="text-xl font-black">Divulgacao na landing</h2>
          </div>
          <div className="mt-5 space-y-3">
            <Switch label="Mostrar agenda disponivel" checked={team.publicProfile.showAgenda} />
            <Switch label="Mostrar valores de aulas e pacotes" checked={team.publicProfile.showPrices} />
            <Switch label="Mostrar fotos do treinador/equipe" checked={team.publicProfile.showPhotos} />
          </div>
        </section>

        <section className="rounded-lg border border-stone-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <Check aria-hidden="true" className="text-emerald-800" size={22} />
            <h2 className="text-xl font-black">Modalidades de treino</h2>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {trainingModalities.map((modality) => {
              const checked = team.trainingModalities.includes(modality);
              return (
                <label
                  key={modality}
                  className={[
                    "flex min-h-12 items-center gap-3 rounded-md border px-3 text-sm font-bold",
                    checked
                      ? "border-emerald-200 bg-emerald-50 text-emerald-950"
                      : "border-stone-200 bg-stone-50 text-stone-700",
                  ].join(" ")}
                >
                  <input defaultChecked={checked} type="checkbox" />
                  {modality}
                </label>
              );
            })}
          </div>
        </section>
      </div>

      <section className="mt-4 rounded-lg border border-stone-200 bg-white p-5">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div>
            <div className="flex items-center gap-2">
              <CalendarClock aria-hidden="true" className="text-emerald-800" size={22} />
              <h2 className="text-xl font-black">Criacao de agenda</h2>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">
              Defina os dias trabalhados, horarios de atendimento e duracao padrao das aulas. Essa
              configuracao alimenta a disponibilidade exibida para alunos e a agenda do treinador.
            </p>
          </div>
          <div className="rounded-md bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-950">
            {sampleTrainerAvailability.filter((day) => day.active).length} dias ativos
          </div>
        </div>

        <div className="mt-5 grid gap-3">
          {sampleTrainerAvailability.map((day) => (
            <AvailabilityRow key={day.weekday} day={day} />
          ))}
        </div>

        <div className="mt-5 rounded-lg border border-stone-200 bg-stone-50 p-4">
          <div className="flex items-center gap-2">
            <Clock aria-hidden="true" className="text-emerald-800" size={20} />
            <h3 className="font-black">Previa da grade</h3>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {sampleTrainerAvailability
              .filter((day) => day.active)
              .map((day) => (
                <article key={day.weekday} className="rounded-md bg-white p-3">
                  <p className="text-sm font-black capitalize">{weekdayLabel(day.weekday)}</p>
                  <p className="mt-1 text-xs text-stone-600">
                    Manhã {day.morningStartTime}-{day.morningEndTime}
                  </p>
                  <p className="text-xs text-stone-600">
                    Tarde {day.afternoonStartTime}-{day.afternoonEndTime}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {previewSlots(day).map((slot) => (
                      <span
                        key={slot}
                        className="rounded bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-900"
                      >
                        {slot}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
          </div>
        </div>
      </section>

      <button
        type="button"
        className="focus-ring mt-5 inline-flex h-11 items-center justify-center rounded-md bg-emerald-800 px-5 text-sm font-bold text-white hover:bg-emerald-700"
      >
        Salvar personalizacao
      </button>
    </section>
  );
}

function AvailabilityRow({ day }: { day: TrainerAvailabilityDay }) {
  return (
    <div
      className={[
        "grid gap-4 rounded-md border p-3 xl:grid-cols-[0.9fr_1.35fr_1.35fr_0.8fr]",
        day.active ? "border-emerald-200 bg-emerald-50" : "border-stone-200 bg-stone-50",
      ].join(" ")}
    >
      <label className="flex items-center gap-3 font-bold">
        <input defaultChecked={day.active} type="checkbox" />
        <span className="capitalize">{weekdayLabel(day.weekday)}</span>
      </label>
      <fieldset className="rounded-md border border-stone-200 bg-white p-3">
        <legend className="px-1 text-sm font-black text-stone-800">Manhã</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <TimeField label="Inicio" value={day.morningStartTime} />
          <TimeField label="Fim" value={day.morningEndTime} />
        </div>
      </fieldset>
      <fieldset className="rounded-md border border-stone-200 bg-white p-3">
        <legend className="px-1 text-sm font-black text-stone-800">Tarde</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <TimeField label="Inicio" value={day.afternoonStartTime} />
          <TimeField label="Fim" value={day.afternoonEndTime} />
        </div>
      </fieldset>
      <label className="block">
        <span className="text-sm font-semibold text-stone-700">Duracao da aula</span>
        <select
          className="focus-ring mt-2 h-11 w-full rounded-md border border-stone-300 bg-white px-3"
          defaultValue={day.classDurationMinutes}
        >
          <option value={30}>30 min</option>
          <option value={45}>45 min</option>
          <option value={50}>50 min</option>
          <option value={60}>60 min</option>
          <option value={90}>90 min</option>
        </select>
      </label>
    </div>
  );
}

function TimeField({ label, value }: { label: string; value: string }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-stone-700">{label}</span>
      <input
        className="focus-ring mt-2 h-11 w-full rounded-md border border-stone-300 bg-white px-3"
        defaultValue={value}
        type="time"
      />
    </label>
  );
}

function Field({ label, placeholder }: { label: string; placeholder: string }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-stone-700">{label}</span>
      <input
        className="focus-ring mt-2 h-11 w-full rounded-md border border-stone-300 px-3"
        placeholder={placeholder}
      />
    </label>
  );
}

function ColorField({ label, value }: { label: string; value: string }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-stone-700">{label}</span>
      <div className="mt-2 flex h-11 items-center gap-3 rounded-md border border-stone-300 bg-white px-3">
        <input className="h-7 w-10 rounded border-0 p-0" defaultValue={value} type="color" />
        <span className="text-sm font-bold text-stone-700">{value}</span>
      </div>
    </label>
  );
}

function UploadField({
  icon: Icon,
  label,
  body,
}: {
  icon: typeof Camera;
  label: string;
  body: string;
}) {
  return (
    <label className="flex items-center gap-3 rounded-md border border-stone-200 bg-stone-50 p-4">
      <Icon aria-hidden="true" className="text-emerald-800" size={22} />
      <div className="min-w-0 flex-1">
        <p className="font-bold">{label}</p>
        <p className="text-sm leading-6 text-stone-600">{body}</p>
      </div>
      <input className="max-w-44 text-sm" type="file" />
    </label>
  );
}

function Switch({ label, checked }: { label: string; checked: boolean }) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-md border border-stone-200 p-4">
      <span className="font-bold">{label}</span>
      <input defaultChecked={checked} className="h-5 w-5" type="checkbox" />
    </label>
  );
}

function weekdayLabel(weekday: TrainerAvailabilityDay["weekday"]) {
  const labels: Record<TrainerAvailabilityDay["weekday"], string> = {
    segunda: "segunda",
    terca: "terca",
    quarta: "quarta",
    quinta: "quinta",
    sexta: "sexta",
    sabado: "sabado",
    domingo: "domingo",
  };

  return labels[weekday];
}

function previewSlots(day: TrainerAvailabilityDay) {
  return [
    ...periodSlots(day.morningStartTime, day.morningEndTime, day.classDurationMinutes),
    ...periodSlots(day.afternoonStartTime, day.afternoonEndTime, day.classDurationMinutes),
  ].slice(0, 8);
}

function periodSlots(startTime: string, endTime: string, durationMinutes: number) {
  const start = minutesFromTime(startTime);
  const end = minutesFromTime(endTime);
  const slots: string[] = [];

  for (let cursor = start; cursor + durationMinutes <= end; cursor += durationMinutes) {
    slots.push(timeFromMinutes(cursor));
  }

  return slots;
}

function minutesFromTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function timeFromMinutes(value: number) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
