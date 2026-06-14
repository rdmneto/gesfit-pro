import { useState, useEffect, useMemo } from "react";
import {
  Building2,
  CalendarClock,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  Home,
  Image,
  LogOut,
  MapPin,
  Minus,
  Package,
  Palette,
  Plus,
  Search,
  Timer,
  ToggleRight,
  Trees,
  Video,
  X,
} from "lucide-react";
import { doc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../lib/firebase";
import { useSessionStore } from "../store/session";
import { useTeam } from "../lib/hooks";
import { PackagesPage } from "./PackagesPage";
import { DEFAULT_AVAILABILITY, trainingModalities } from "../data/catalog";
import { CITY_NAMES, DEFAULT_CITY } from "../data/cities";
import { gymTypeIcon, searchGyms } from "../data/gyms";
import type { GymLocation, TrainerAvailabilityDay } from "../types/domain";

/** Banner padrão exibido na prévia enquanto o treinador não envia uma imagem própria. */
const DEFAULT_BANNER_URL =
  "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?auto=format&fit=crop&w=1600&q=80";
const DEFAULT_PHOTO_URL =
  "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=900&q=80";

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

export function TrainerWorkspacePage() {
  const teamId = useSessionStore((state) => state.claims.teamId);
  const logout = useSessionStore((state) => state.logout);
  const { data: dbTeam, loading: teamLoading } = useTeam(teamId);

  // Time padrão (treinador sem perfil salvo ainda) — apenas defaults editáveis.
  const team = dbTeam ?? {
    name: "",
    branding: {
      primaryColor: "#0f766e",
      secondaryColor: "#f59e0b",
      welcomeMessage: "",
      bio: "",
      bannerPhotoURL: DEFAULT_BANNER_URL,
      trainerPhotoURL: DEFAULT_PHOTO_URL,
    },
  };

  // Sub-tab state
  const [activeSubTab, setActiveSubTab] = useState<
    "cadastro" | "estilos" | "locais" | "agenda" | "pacotes"
  >("cadastro");

  // Profile States
  const [name, setName] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [city, setCity] = useState(DEFAULT_CITY);
  const [contactPhone, setContactPhone] = useState("");
  const [primaryColor, setPrimaryColor] = useState("");
  const [secondaryColor, setSecondaryColor] = useState("");
  const [bio, setBio] = useState("");
  const [showAgenda, setShowAgenda] = useState(true);
  const [showPrices, setShowPrices] = useState(true);
  const [showPhotos, setShowPhotos] = useState(true);
  const [modalities, setModalities] = useState<string[]>([]);
  const [trainerPhotoURL, setTrainerPhotoURL] = useState("");
  const [bannerPhotoURL, setBannerPhotoURL] = useState("");

  // Locations / Special visits States
  const [selectedGyms, setSelectedGyms] = useState<GymLocation[]>([]);
  const [acceptsHome, setAcceptsHome] = useState(false);
  const [acceptsCondo, setAcceptsCondo] = useState(false);
  const [gymSearch, setGymSearch] = useState("");
  const [showGymPicker, setShowGymPicker] = useState(false);

  // Availability state (includes travelMinutes)
  const [availability, setAvailability] = useState<TrainerAvailabilityDay[]>(
    DEFAULT_AVAILABILITY,
  );

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (!dbTeam) return;
    setName(dbTeam.name || "");
    setWelcomeMessage(dbTeam.branding?.welcomeMessage || "");
    setCity(dbTeam.city || DEFAULT_CITY);
    setContactPhone(dbTeam.contactPhone || "");
    setPrimaryColor(dbTeam.branding?.primaryColor || "#0f766e");
    setSecondaryColor(dbTeam.branding?.secondaryColor || "#f59e0b");
    setBio(dbTeam.branding?.bio || "");
    setShowAgenda(dbTeam.publicProfile?.showAgenda ?? true);
    setShowPrices(dbTeam.publicProfile?.showPrices ?? true);
    setShowPhotos(dbTeam.publicProfile?.showPhotos ?? true);
    setModalities(dbTeam.trainingModalities || []);
    setTrainerPhotoURL(dbTeam.branding?.trainerPhotoURL || "");
    setBannerPhotoURL(dbTeam.branding?.bannerPhotoURL || "");

    // Load locations
    setSelectedGyms(dbTeam.worksAt || []);
    setAcceptsHome(dbTeam.acceptsHomeVisit ?? false);
    setAcceptsCondo(dbTeam.acceptsCondoGym ?? false);

    // Load availability (fall back to default template if not set in DB yet)
    setAvailability(dbTeam.availability || DEFAULT_AVAILABILITY);
  }, [dbTeam]);

  // Gym Search Memo (restrito à cidade de atuação do treinador)
  const filteredGyms = useMemo(
    () => searchGyms(gymSearch, city).filter((g) => g.type === "gym"),
    [gymSearch, city],
  );

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

  const totalSlotMinutes = (day: TrainerAvailabilityDay) =>
    (day.classDurationMinutes ?? 50) + (day.travelMinutes ?? 0);

  async function handleFileUpload(file: File, type: "trainer" | "banner" | "gallery") {
    if (!db || !storage || !teamId) return;
    try {
      setSaving(true);
      setSaveError("");
      // Caminho dentro de `branding/` para casar com as Storage Rules.
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const fileRef = ref(storage, `teams/${teamId}/branding/${type}_${Date.now()}_${safeName}`);
      // Corre contra um timeout para o botão nunca ficar preso em "Salvando…"
      // caso o upload trave (ex.: CORS do bucket não liberado para o domínio).
      const snapshot = await withTimeout(
        uploadBytes(fileRef, file),
        30000,
        "Tempo esgotado ao enviar a imagem. Verifique a configuração de CORS do Storage.",
      );
      const url = await getDownloadURL(snapshot.ref);

      if (type === "trainer") {
        setTrainerPhotoURL(url);
        await updateDoc(doc(db, "teams", teamId), {
          "branding.trainerPhotoURL": url
        });
      } else if (type === "banner") {
        setBannerPhotoURL(url);
        await updateDoc(doc(db, "teams", teamId), {
          "branding.bannerPhotoURL": url
        });
      } else {
        await updateDoc(doc(db, "teams", teamId), {
          "branding.heroPhotoURL": url
        });
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error(err);
      setSaveError("Erro ao enviar imagem: " + err.message);
      setTimeout(() => setSaveError(""), 5000);
    } finally {
      setSaving(false);
    }
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>, type: "trainer" | "banner" | "gallery") {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!storage || !teamId) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const url = e.target?.result as string;
        if (type === "trainer") setTrainerPhotoURL(url);
        else if (type === "banner") setBannerPhotoURL(url);
      };
      reader.readAsDataURL(file);
      return;
    }

    await handleFileUpload(file, type);
  }

  const handleModalityChange = (modality: string, checked: boolean) => {
    setModalities((prev) =>
      checked ? [...prev, modality] : prev.filter((m) => m !== modality)
    );
  };

  async function handleSave() {
    if (!db || !teamId) {
      setSaveError("Não foi possível salvar agora. Tente novamente mais tarde.");
      setTimeout(() => setSaveError(""), 5000);
      return;
    }

    try {
      setSaving(true);
      setSaveError("");
      
      await updateDoc(doc(db, "teams", teamId), {
        name,
        branding: {
          primaryColor,
          secondaryColor,
          welcomeMessage,
          bio,
          trainerPhotoURL,
          bannerPhotoURL
        },
        trainingModalities: modalities,
        city,
        contactPhone,
        publicProfile: {
          showAgenda,
          showPrices,
          showPhotos
        },
        worksAt: selectedGyms,
        acceptsHomeVisit: acceptsHome,
        acceptsCondoGym: acceptsCondo,
        availability, // save full availability (with travelMinutes)
        publicListing: true,
      });
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error("Error saving customization:", err);
      setSaveError("Erro ao salvar: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  if (teamLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-700" />
          <p className="text-sm text-stone-400">Carregando ambiente...</p>
        </div>
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-emerald-800">
            Área do treinador
          </p>
          <h1 className="mt-2 text-3xl font-black text-stone-950" style={{ fontFamily: "var(--font-display)" }}>
            Ajustes
          </h1>
          <p className="mt-2 max-w-3xl leading-6 text-stone-500">
            Configure seu cadastro, estilos de treino, academias, agenda e pacotes/promoções.
          </p>
        </div>
        <button
          type="button"
          onClick={() => logout()}
          className="focus-ring inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-stone-200 px-4 text-sm font-bold text-stone-600 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
        >
          <LogOut size={16} />
          Sair
        </button>
      </div>

      {/* Visual Public Banner Preview — reflete a paleta escolhida ao vivo */}
      <section className="mt-6 overflow-hidden rounded-xl border border-stone-200 bg-white">
        <div
          className="relative h-56 bg-stone-900"
          style={{
            backgroundImage: `linear-gradient(90deg, ${primaryColor || "#0f766e"}F0, ${primaryColor || "#0f766e"}55), url(${bannerPhotoURL || team.branding.bannerPhotoURL})`,
            backgroundPosition: "center",
            backgroundSize: "cover",
          }}
        >
          {/* faixa de destaque na cor secundária */}
          <span
            className="absolute left-0 top-0 h-full w-1.5"
            style={{ backgroundColor: secondaryColor || "#f59e0b" }}
          />
          <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between gap-4">
            <div className="flex items-end gap-4">
              <img
                className="h-24 w-24 rounded-xl border-4 border-white object-cover shadow-lg"
                src={trainerPhotoURL || team.branding.trainerPhotoURL}
                alt=""
              />
              <div className="pb-1 text-white">
                <p className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-widest text-white/80">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: secondaryColor || "#f59e0b" }}
                  />
                  Prévia pública
                </p>
                <h2 className="text-3xl font-black">{name || team.name}</h2>
              </div>
            </div>
            {/* botão de exemplo na cor primária (igual ao da vitrine) */}
            <span
              className="hidden h-10 items-center rounded-md px-4 text-sm font-bold text-white shadow sm:inline-flex"
              style={{ backgroundColor: primaryColor || "#0f766e" }}
            >
              Contratar
            </span>
          </div>
        </div>
      </section>
      <p className="mt-2 text-xs text-stone-400">
        As cores acima são aplicadas na sua vitrine pública (banner, botões e destaques).
      </p>

      {/* Sub-tabs Navigation */}
      <div className="mt-6 flex gap-1 overflow-x-auto border-b border-stone-200">
        {([
          { id: "cadastro", label: "Meu cadastro", icon: Palette },
          { id: "estilos", label: "Estilos de treino", icon: Check },
          { id: "locais", label: "Academias", icon: MapPin },
          { id: "agenda", label: "Agenda", icon: CalendarClock },
          { id: "pacotes", label: "Pacotes e promoções", icon: Package },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={[
              "focus-ring -mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-3.5 text-sm font-bold transition-all",
              activeSubTab === id
                ? "border-emerald-700 text-emerald-950 font-black"
                : "border-transparent text-stone-500 hover:text-stone-800",
            ].join(" ")}
            onClick={() => setActiveSubTab(id)}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab Contents */}
      <div className="mt-6">
        {/* ── Sub-tab: MEU CADASTRO ────────────────────────────────────── */}
        {activeSubTab === "cadastro" && (
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
              <section className="card p-5">
                <div className="flex items-center gap-2">
                  <Palette aria-hidden="true" className="text-emerald-800" size={20} />
                  <h2 className="text-lg font-black text-stone-950">Paleta e identidade</h2>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field label="Nome público" value={name} onChange={setName} placeholder={team.name} />
                  <Field label="Mensagem da landing" value={welcomeMessage} onChange={setWelcomeMessage} placeholder={team.branding.welcomeMessage} />
                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-wide text-stone-500">Cidade de atuação</span>
                    <select
                      className="focus-ring mt-1.5 h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                    >
                      {CITY_NAMES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                  <Field
                    label="WhatsApp de contato"
                    value={contactPhone}
                    onChange={setContactPhone}
                    placeholder="+55 85 99999-9999"
                  />
                  <ColorField label="Cor primária" value={primaryColor} onChange={setPrimaryColor} />
                  <ColorField label="Cor secundária" value={secondaryColor} onChange={setSecondaryColor} />
                  <label className="block sm:col-span-2">
                    <span className="text-xs font-bold uppercase tracking-wide text-stone-500">Bio pública</span>
                    <textarea
                      className="focus-ring mt-1.5 min-h-28 w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm"
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder={team.branding.bio}
                    />
                  </label>
                </div>
              </section>

              <section className="card p-5">
                <div className="flex items-center gap-2">
                  <Image aria-hidden="true" className="text-emerald-800" size={20} />
                  <h2 className="text-lg font-black text-stone-950">Fotos e banner</h2>
                </div>
                <div className="mt-4 grid gap-3">
                  <UploadField
                    icon={Camera}
                    label="Foto do treinador"
                    body="Imagem quadrada para perfil, cards e área do aluno."
                    onChange={(e) => handleFileChange(e, "trainer")}
                  />
                  <UploadField
                    icon={Video}
                    label="Banner estilo YouTube"
                    body="Imagem horizontal para topo da landing e painel."
                    onChange={(e) => handleFileChange(e, "banner")}
                  />
                  <UploadField
                    icon={Image}
                    label="Fotos da galeria"
                    body="Fotos que podem aparecer na landing quando a divulgação estiver ativa."
                    onChange={(e) => handleFileChange(e, "gallery")}
                  />
                </div>
              </section>
            </div>

            <section className="card p-5">
              <div className="flex items-center gap-2">
                <ToggleRight aria-hidden="true" className="text-emerald-800" size={20} />
                <h2 className="text-lg font-black text-stone-950">Divulgação na landing</h2>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <Switch label="Mostrar agenda disponível" checked={showAgenda} onChange={setShowAgenda} />
                <Switch label="Mostrar valores de aulas e pacotes" checked={showPrices} onChange={setShowPrices} />
                <Switch label="Mostrar fotos do treinador/equipe" checked={showPhotos} onChange={setShowPhotos} />
              </div>
            </section>
          </div>
        )}

        {/* ── Sub-tab: ESTILOS DE TREINO ───────────────────────────────── */}
        {activeSubTab === "estilos" && (
          <section className="card p-5">
            <div className="flex items-center gap-2">
              <Check aria-hidden="true" className="text-emerald-800" size={20} />
              <h2 className="text-lg font-black text-stone-950">Modalidades de treino</h2>
            </div>
            <p className="mt-1 text-xs text-stone-400">Selecione os estilos de treino que você oferece.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {trainingModalities.map((modality) => {
                const isChecked = modalities.includes(modality);
                return (
                  <label
                    key={modality}
                    className={[
                      "flex min-h-12 items-center gap-3 rounded-xl border px-4 text-sm font-bold cursor-pointer transition-colors",
                      isChecked
                        ? "border-emerald-200 bg-emerald-50 text-emerald-950 animate-pulse-once"
                        : "border-stone-200 bg-stone-50/50 text-stone-600 hover:border-stone-300",
                    ].join(" ")}
                  >
                    <input
                      checked={isChecked}
                      onChange={(e) => handleModalityChange(modality, e.target.checked)}
                      type="checkbox"
                      className="rounded border-stone-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                    />
                    {modality}
                  </label>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Sub-tab 2: LOCAIS ─────────────────────────────────────────── */}
        {activeSubTab === "locais" && (
          <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
            <div className="space-y-4">
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

                {/* Gym Selection List */}
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
                            <p className="truncate text-2xs opacity-70">{gym.address}</p>
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

                {/* Gym Search Bar & Results */}
                {showGymPicker && (
                  <div className="mt-3 animate-slide-up">
                    <div className="flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3">
                      <Search className="text-stone-400" size={16} />
                      <input
                        className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-stone-400"
                        placeholder="Buscar por nome ou bairro…"
                        value={gymSearch}
                        onChange={(e) => setGymSearch(e.target.value)}
                      />
                    </div>
                    <div className="mt-2 max-h-60 overflow-y-auto rounded-xl border border-stone-200 bg-white">
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
            </div>

            <section className="card p-5">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50">
                  <Home aria-hidden="true" className="text-emerald-700" size={16} />
                </div>
                <h2 className="text-lg font-black text-stone-950">Tipos especiais de atendimento</h2>
              </div>
              <p className="mt-1 text-xs text-stone-400">
                Determina os filtros visíveis e as regras especiais na vitrine.
              </p>

              <div className="mt-4 space-y-3">
                <ToggleRow
                  id="toggle-home"
                  icon={Home}
                  label="Atendimento domiciliar"
                  description="Eu me desloco até a residência ou trabalho do aluno"
                  checked={acceptsHome}
                  onChange={setAcceptsHome}
                  color="emerald"
                />
                <ToggleRow
                  id="toggle-condo"
                  icon={Building2}
                  label="Academia do condomínio"
                  description="Atendo na academia privativa do condomínio do aluno"
                  checked={acceptsCondo}
                  onChange={setAcceptsCondo}
                  color="violet"
                />
              </div>
            </section>
          </div>
        )}

        {/* ── Sub-tab 3: AGENDA E GRADE (Horários e Deslocamento) ────── */}
        {activeSubTab === "agenda" && (
          <div className="space-y-6">
            <section className="card p-5">
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <CalendarClock aria-hidden="true" className="text-emerald-800" size={20} />
                    <h2 className="text-lg font-black text-stone-950">Grade de atendimento e deslocamento</h2>
                  </div>
                  <p className="mt-1.5 max-w-3xl text-sm leading-6 text-stone-500">
                    Ative os dias de trabalho, configure horários de início/fim e defina a duração das aulas bem como o tempo necessário para se deslocar entre um aluno e outro.
                  </p>
                </div>
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-2 text-sm font-bold text-emerald-950 shrink-0">
                  {availability.filter((day) => day.active).length} dias ativos
                </div>
              </div>

              {/* Travel time visuals explanation */}
              <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-stone-50 px-4 py-3 text-xs border border-stone-200">
                <div className="flex items-center gap-1.5 font-bold text-stone-600">
                  <Clock className="text-emerald-700" size={14} />
                  <span>Aula</span>
                </div>
                <div className="h-3 w-16 rounded bg-emerald-400" />
                <span className="text-stone-300 font-bold">|</span>
                <div className="flex items-center gap-1.5 font-bold text-stone-600">
                  <Timer className="text-amber-600" size={14} />
                  <span>Deslocamento</span>
                </div>
                <div className="h-3 w-8 rounded bg-amber-300" />
                <span className="text-stone-300 font-bold">=</span>
                <span className="font-black text-stone-700">Slot bloqueado na agenda do treinador</span>
              </div>

              <div className="mt-5 space-y-4">
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

            {/* Weekly preview grids */}
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
              <div className="flex items-center gap-2">
                <Clock aria-hidden="true" className="text-emerald-800" size={18} />
                <h3 className="font-bold text-stone-800">Prévia de horários gerados</h3>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {availability
                  .filter((day) => day.active)
                  .map((day) => (
                    <article key={day.weekday} className="rounded-xl border border-stone-200 bg-white p-3">
                      <p className="text-sm font-black capitalize text-stone-900">{WEEKDAY_LABELS[day.weekday]}</p>
                      <p className="mt-1 text-2xs text-stone-500 font-medium">
                        Manhã: {day.morningStartTime} – {day.morningEndTime}
                      </p>
                      <p className="text-2xs text-stone-500 font-medium">
                        Tarde: {day.afternoonStartTime} – {day.afternoonEndTime}
                      </p>
                      <div className="mt-3.5 flex flex-wrap gap-1">
                        {previewSlots(day).map((slot) => (
                          <span
                            key={slot}
                            className="rounded bg-emerald-50 border border-emerald-100 px-2 py-0.5 text-2xs font-bold text-emerald-900"
                          >
                            {slot}
                          </span>
                        ))}
                      </div>
                    </article>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Sub-tab: PACOTES E PROMOÇÕES ─────────────────────────────── */}
        {activeSubTab === "pacotes" && (
          <div className="-mx-4">
            <PackagesPage />
          </div>
        )}
      </div>

      {saveSuccess && activeSubTab !== "pacotes" && (
        <div className="mt-6 rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm font-bold text-emerald-800 animate-fade-in">
          Configurações e personalização salvas com sucesso!
        </div>
      )}
      {saveError && activeSubTab !== "pacotes" && (
        <div className="mt-6 rounded-xl bg-rose-50 border border-rose-200 p-4 text-sm font-bold text-rose-800 animate-fade-in">
          {saveError}
        </div>
      )}

      {/* Floating Save Button — pacotes/promoções têm salvamento próprio */}
      {activeSubTab !== "pacotes" && (
        <div className="sticky bottom-20 md:bottom-4 mt-6 flex justify-end">
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="focus-ring inline-flex h-12 items-center justify-center rounded-xl bg-stone-950 px-6 font-bold text-white shadow-xl hover:bg-stone-850 disabled:opacity-50 transition-all border border-stone-800"
          >
            {saving ? "Salvando..." : "Salvar configurações"}
          </button>
        </div>
      )}
    </section>
  );
}

// ── Sub-componentes ──────────────────────────────────────────────────────────

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-wide text-stone-500">{label}</span>
      <input
        className="focus-ring mt-1.5 h-11 w-full rounded-xl border border-stone-200 px-3 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-wide text-stone-500">{label}</span>
      <div className="mt-1.5 flex h-11 items-center gap-3 rounded-xl border border-stone-200 bg-white px-3 text-sm">
        <input
          className="h-7 w-10 rounded border-0 p-0 cursor-pointer bg-transparent"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          type="color"
        />
        <span className="text-xs font-black text-stone-700">{value}</span>
      </div>
    </label>
  );
}

function UploadField({
  icon: Icon,
  label,
  body,
  onChange,
}: {
  icon: typeof Camera;
  label: string;
  body: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="flex items-center gap-3 rounded-xl border border-stone-200 bg-stone-50/50 p-4 cursor-pointer hover:border-stone-300 transition-colors">
      <Icon aria-hidden="true" className="text-emerald-850" size={22} />
      <div className="min-w-0 flex-1">
        <p className="font-bold text-sm text-stone-900">{label}</p>
        <p className="text-xs leading-5 text-stone-500">{body}</p>
      </div>
      <input
        className="max-w-44 text-xs font-medium text-stone-500"
        type="file"
        onChange={onChange}
        accept="image/*"
      />
    </label>
  );
}

function Switch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-xl border border-stone-200 p-4 cursor-pointer hover:border-stone-300 transition-colors bg-stone-50/30">
      <span className="font-bold text-sm text-stone-800">{label}</span>
      <input
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
        type="checkbox"
      />
    </label>
  );
}

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
        checked
          ? color === "emerald"
            ? "border-emerald-250 bg-emerald-50/70"
            : "border-violet-250 bg-violet-50/70"
          : "border-stone-200 bg-white hover:border-stone-300",
      ].join(" ")}
    >
      <Icon
        size={18}
        className={checked ? (color === "emerald" ? "text-emerald-700" : "text-violet-700") : "text-stone-400"}
      />
      <div className="flex-1">
        <p className="text-sm font-bold text-stone-900">{label}</p>
        <p className="mt-0.5 text-xs text-stone-500 leading-4">{description}</p>
      </div>
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
            checked ? activeClass : "bg-stone-350",
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
          ? "border-emerald-200 bg-emerald-50/60"
          : "border-stone-200 bg-stone-50/50 opacity-60",
      ].join(" ")}
    >
      <label className="flex cursor-pointer items-center gap-3 px-4 py-3.5">
        <input
          type="checkbox"
          checked={day.active}
          onChange={(e) => onUpdate({ active: e.target.checked })}
          className="h-4 w-4 rounded accent-emerald-600"
        />
        <span className="flex-1 text-sm font-bold text-stone-900">{label}</span>
        {day.active && (
          <span className="rounded bg-emerald-100 border border-emerald-200 px-2.5 py-0.5 text-2xs font-bold text-emerald-950 uppercase">
            {day.morningStartTime} – {day.afternoonEndTime}
          </span>
        )}
      </label>

      {day.active && (
        <div className="border-t border-emerald-150 px-4 pb-4 pt-3.5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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

          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-500">
                <Clock className="mr-1.5 inline text-emerald-700" size={12} />
                Duração da aula (min)
              </label>
              <input
                type="number"
                min={15}
                max={120}
                step={5}
                value={day.classDurationMinutes ?? 50}
                onChange={(e) => onUpdate({ classDurationMinutes: Number(e.target.value) })}
                className="focus-ring mt-1.5 h-11 w-full rounded-xl border border-stone-200 text-center font-bold text-sm bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-500">
                <Timer className="mr-1.5 inline text-amber-600" size={12} />
                Deslocamento (min)
              </label>
              <input
                type="number"
                min={0}
                max={60}
                step={5}
                value={day.travelMinutes ?? 0}
                onChange={(e) => onUpdate({ travelMinutes: Number(e.target.value) })}
                className="focus-ring mt-1.5 h-11 w-full rounded-xl border border-stone-200 text-center font-bold text-sm bg-white"
              />
            </div>
          </div>

          {/* Blocked slot visual progress bar */}
          <div className="mt-4 overflow-hidden rounded-xl bg-white border border-stone-200 p-3.5">
            <p className="text-2xs font-bold uppercase tracking-widest text-stone-400 mb-2">Slot bloqueado para agendamentos</p>
            <div className="flex items-center gap-1">
              <div
                className="flex h-7 items-center justify-center rounded-l-lg bg-emerald-500 px-2 text-2xs font-black text-white transition-all shadow-sm"
                style={{ width: `${((day.classDurationMinutes ?? 50) / totalSlot) * 100}%`, minWidth: 40 }}
              >
                {day.classDurationMinutes ?? 50} min
              </div>
              {(day.travelMinutes ?? 0) > 0 && (
                <div
                  className="flex h-7 items-center justify-center rounded-r-lg bg-amber-400 px-2 text-2xs font-black text-stone-900 transition-all shadow-sm"
                  style={{ width: `${((day.travelMinutes ?? 0) / totalSlot) * 100}%`, minWidth: 32 }}
                >
                  {day.travelMinutes ?? 0} min
                </div>
              )}
              <span className="ml-2 text-xs font-black text-stone-800 shrink-0">
                = {totalSlot} min
              </span>
            </div>
            <p className="mt-2 text-2xs text-stone-400 leading-4 font-medium">
              Próximo horário ficará disponível {totalSlot} minutos após o início do agendamento.
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
      <label className="block text-2xs font-bold uppercase tracking-wider text-stone-500">{label}</label>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="focus-ring mt-1.5 h-11 w-full rounded-xl border border-stone-200 px-3 text-sm bg-white"
      />
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────

/** Rejeita a promise se ela não resolver dentro de `ms` milissegundos. */
function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

function previewSlots(day: TrainerAvailabilityDay) {
  return [
    ...periodSlots(day.morningStartTime, day.morningEndTime, day.classDurationMinutes),
    ...periodSlots(day.afternoonStartTime, day.afternoonEndTime, day.classDurationMinutes),
  ].slice(0, 8);
}

function periodSlots(startTime: string | undefined | null, endTime: string | undefined | null, durationMinutes: number | undefined | null) {
  if (!startTime || !endTime || !durationMinutes || durationMinutes <= 0) return [];
  const start = minutesFromTime(startTime);
  const end = minutesFromTime(endTime);
  if (start >= end) return [];
  const slots: string[] = [];

  for (let cursor = start; cursor + durationMinutes <= end; cursor += durationMinutes) {
    slots.push(timeFromMinutes(cursor));
  }

  return slots;
}

function minutesFromTime(value: string | undefined | null) {
  if (!value) return 0;
  const parts = value.split(":");
  if (parts.length < 2) return 0;
  const [hours, minutes] = parts.map(Number);
  if (isNaN(hours) || isNaN(minutes)) return 0;
  return hours * 60 + minutes;
}

function timeFromMinutes(value: number) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
