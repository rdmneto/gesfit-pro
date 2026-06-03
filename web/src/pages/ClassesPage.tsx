import {
  Banknote,
  CalendarPlus,
  CheckCircle2,
  Clock,
  Dumbbell,
  FileUp,
  Megaphone,
  PackagePlus,
  Send,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import {
  sampleBookings,
  sampleClassProducts,
  samplePromotionalPackages,
  samplePurchases,
  sampleStudent,
} from "../data/sample";
import { moneyFromCents, shortDateTime } from "../lib/format";
import type { ClassProductType, PurchaseStatus } from "../types/domain";

const slots = [
  { time: "06:00", capacity: 4, filled: 2 },
  { time: "07:30", capacity: 4, filled: 4 },
  { time: "12:00", capacity: 3, filled: 1 },
  { time: "17:00", capacity: 5, filled: 3 },
  { time: "19:30", capacity: 5, filled: 5 },
];

const statusLabel: Record<PurchaseStatus, string> = {
  awaiting_payment: "Aguardando pagamento",
  payment_submitted: "Comprovante enviado",
  paid: "Pagamento confirmado",
  rejected: "Pagamento recusado",
};

export function ClassesPage() {
  const [productType, setProductType] = useState<ClassProductType>("single");
  const activeProducts = sampleClassProducts.filter((product) => product.active);

  return (
    <section className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-emerald-800">
            Aulas, pacotes e pagamentos
          </p>
          <h1 className="mt-2 text-3xl font-black">Controle comercial de aulas</h1>
          <p className="mt-2 max-w-3xl leading-7 text-stone-600">
            O treinador define valores de aulas avulsas, pacotes regulares e promocoes. O aluno
            confirma pagamento, anexa comprovante quando quiser e o professor valida antes de
            liberar os creditos.
          </p>
        </div>
        <button
          type="button"
          className="focus-ring inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-800 px-5 text-sm font-bold text-white hover:bg-emerald-700"
        >
          <CalendarPlus aria-hidden="true" size={18} />
          Nova aula
        </button>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <PackagePlus aria-hidden="true" className="text-emerald-800" size={22} />
            <h2 className="text-xl font-black">Cadastrar aula ou pacote</h2>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="text-sm font-semibold text-stone-700">Tipo de venda</span>
              <select
                className="focus-ring mt-2 h-11 w-full rounded-md border border-stone-300 bg-white px-3"
                value={productType}
                onChange={(event) => setProductType(event.target.value as ClassProductType)}
              >
                <option value="single">Aula avulsa</option>
                <option value="package">Pacote de aulas</option>
              </select>
            </label>
            <Field
              label="Nome"
              placeholder={productType === "single" ? "Aula avulsa funcional" : "Pacote 8 aulas"}
            />
            <Field label="Valor em reais" placeholder={productType === "single" ? "65,00" : "440,00"} />
            <Field
              label="Quantidade de aulas"
              placeholder={productType === "single" ? "1" : "8"}
              type="number"
            />
            <Field label="Orientador responsavel" placeholder="Ana Beatriz" />
            <label className="block sm:col-span-2">
              <span className="text-sm font-semibold text-stone-700">Descricao</span>
              <textarea
                className="focus-ring mt-2 min-h-24 w-full rounded-md border border-stone-300 px-3 py-2"
                placeholder="Explique regras de uso, validade combinada e diferenciais do pacote."
              />
            </label>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              className="focus-ring inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-800 px-5 text-sm font-bold text-white hover:bg-emerald-700"
            >
              <Banknote aria-hidden="true" size={18} />
              Salvar oferta
            </button>
            <button
              type="button"
              className="focus-ring inline-flex h-11 items-center justify-center rounded-md border border-stone-300 px-5 text-sm font-bold text-stone-800 hover:bg-stone-100"
            >
              Ocultar da area publica
            </button>
          </div>
        </section>

        <section className="rounded-lg border border-stone-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <Dumbbell aria-hidden="true" className="text-emerald-800" size={22} />
            <h2 className="text-xl font-black">Ofertas cadastradas</h2>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {activeProducts.map((product) => (
              <article key={product.id} className="rounded-md border border-stone-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">{product.name}</p>
                    <p className="mt-1 text-sm text-stone-600">
                      {product.classesCount} aula{product.classesCount > 1 ? "s" : ""}
                    </p>
                  </div>
                  <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-900">
                    {product.type === "single" ? "Avulsa" : "Pacote"}
                  </span>
                </div>
                <p className="mt-3 text-2xl font-black">{moneyFromCents(product.priceCents)}</p>
                <p className="mt-2 text-sm leading-6 text-stone-600">{product.description}</p>
                <p className="mt-3 text-xs font-bold text-stone-500">
                  {product.publicVisible ? "Visivel para novos alunos" : "Somente alunos ativos"}
                </p>
              </article>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-lg border border-stone-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <Megaphone aria-hidden="true" className="text-emerald-800" size={22} />
            <h2 className="text-xl font-black">Pacote promocional</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            A promocao fica disponivel ate o treinador remover ou ate esgotar a quantidade
            ofertada.
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Nome da promocao" placeholder="Junho em movimento" />
            <Field label="Valor promocional" placeholder="299,00" />
            <Field label="Quantidade de aulas" placeholder="6" type="number" />
            <Field label="Pacotes ofertados" placeholder="20" type="number" />
            <label className="block sm:col-span-2">
              <span className="text-sm font-semibold text-stone-700">Publico</span>
              <select className="focus-ring mt-2 h-11 w-full rounded-md border border-stone-300 bg-white px-3">
                <option>Enviar para todos os alunos</option>
                <option>Direcionar para alunos selecionados</option>
              </select>
            </label>
          </div>
          <button
            type="button"
            className="focus-ring mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-800 px-5 text-sm font-bold text-white hover:bg-emerald-700"
          >
            <Send aria-hidden="true" size={18} />
            Criar e enviar promocao
          </button>
        </section>

        <section className="rounded-lg border border-stone-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <Users aria-hidden="true" className="text-emerald-800" size={22} />
            <h2 className="text-xl font-black">Promocoes ativas</h2>
          </div>
          <div className="mt-4 space-y-3">
            {samplePromotionalPackages.map((promo) => {
              const remaining = Math.max(promo.offeredQuantity - promo.soldQuantity, 0);
              return (
                <article
                  key={promo.id}
                  className="grid gap-3 rounded-md border border-stone-200 p-4 sm:grid-cols-[1fr_auto]"
                >
                  <div>
                    <p className="font-bold">{promo.name}</p>
                    <p className="mt-1 text-sm text-stone-600">
                      {promo.classesCount} aulas por {moneyFromCents(promo.priceCents)}
                    </p>
                    <p className="mt-2 text-sm text-stone-600">
                      {promo.audience === "all_students"
                        ? "Enviada para todos os alunos"
                        : "Direcionada para alunos selecionados"}
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-sm font-bold text-emerald-800">{remaining} restantes</p>
                    <button
                      type="button"
                      className="focus-ring mt-2 inline-flex h-9 items-center justify-center gap-2 rounded-md border border-stone-300 px-3 text-xs font-bold text-stone-800 hover:bg-stone-100"
                    >
                      <XCircle aria-hidden="true" size={15} />
                      Remover
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-lg border border-stone-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <FileUp aria-hidden="true" className="text-emerald-800" size={22} />
            <h2 className="text-xl font-black">Contratacao pelo aluno</h2>
          </div>
          <div className="mt-4 rounded-md border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-semibold text-stone-600">Aluno</p>
            <p className="text-lg font-black">{sampleStudent.displayName}</p>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="text-sm font-semibold text-stone-700">Escolher aula ou pacote</span>
              <select className="focus-ring mt-2 h-11 w-full rounded-md border border-stone-300 bg-white px-3">
                {activeProducts.map((product) => (
                  <option key={product.id}>
                    {product.name} - {moneyFromCents(product.priceCents)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block sm:col-span-2">
              <span className="text-sm font-semibold text-stone-700">
                Anexar comprovante opcional
              </span>
              <input
                className="focus-ring mt-2 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
                type="file"
              />
            </label>
          </div>
          <button
            type="button"
            className="focus-ring mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-800 px-5 text-sm font-bold text-white hover:bg-emerald-700"
          >
            <CheckCircle2 aria-hidden="true" size={18} />
            Confirmar pagamento
          </button>
        </section>

        <section className="rounded-lg border border-stone-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <CheckCircle2 aria-hidden="true" className="text-emerald-800" size={22} />
            <h2 className="text-xl font-black">Conferencia do professor</h2>
          </div>
          <div className="mt-4 space-y-3">
            {samplePurchases.map((purchase) => (
              <article
                key={purchase.id}
                className="grid gap-3 rounded-md border border-stone-200 p-4 sm:grid-cols-[1fr_auto]"
              >
                <div>
                  <p className="font-bold">{purchase.productName}</p>
                  <p className="mt-1 text-sm text-stone-600">
                    {purchase.classesCount} aula{purchase.classesCount > 1 ? "s" : ""} -{" "}
                    {moneyFromCents(purchase.amountCents)}
                  </p>
                  <p className="mt-2 text-sm text-stone-600">
                    {purchase.proofFileName
                      ? `Comprovante: ${purchase.proofFileName}`
                      : "Sem comprovante anexado"}
                  </p>
                  <span className="mt-3 inline-flex rounded-md bg-stone-100 px-2 py-1 text-xs font-bold text-stone-700">
                    {statusLabel[purchase.status]}
                  </span>
                </div>
                <div className="flex flex-wrap items-start gap-2 sm:justify-end">
                  <button
                    type="button"
                    className="focus-ring inline-flex h-9 items-center justify-center gap-2 rounded-md bg-emerald-800 px-3 text-xs font-bold text-white hover:bg-emerald-700"
                  >
                    <CheckCircle2 aria-hidden="true" size={15} />
                    Confirmar
                  </button>
                  <button
                    type="button"
                    className="focus-ring inline-flex h-9 items-center justify-center gap-2 rounded-md border border-stone-300 px-3 text-xs font-bold text-stone-800 hover:bg-stone-100"
                  >
                    <XCircle aria-hidden="true" size={15} />
                    Recusar
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <form className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black">Cadastrar horario de aula</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Aluno/paciente" placeholder={sampleStudent.displayName} />
            <Field label="Orientador" placeholder="Ana Beatriz" />
            <Field label="Data" type="date" placeholder="2026-06-02" />
            <Field label="Hora inicio" type="time" placeholder="17:00" />
            <Field label="Duracao (min)" type="number" placeholder="60" />
            <Field label="Capacidade" type="number" placeholder="1" />
            <label className="block sm:col-span-2">
              <span className="text-sm font-semibold text-stone-700">Foco do treino</span>
              <select className="focus-ring mt-2 h-11 w-full rounded-md border border-stone-300 bg-white px-3">
                <option>Membros inferiores</option>
                <option>Peito e ombros</option>
                <option>Costas e biceps</option>
                <option>Full body</option>
              </select>
            </label>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              className="focus-ring inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-800 px-5 text-sm font-bold text-white hover:bg-emerald-700"
            >
              <UserPlus aria-hidden="true" size={18} />
              Agendar
            </button>
            <button
              type="button"
              className="focus-ring inline-flex h-11 items-center justify-center rounded-md border border-stone-300 px-5 text-sm font-bold text-stone-800 hover:bg-stone-100"
            >
              Registrar no-show
            </button>
          </div>
        </form>

        <div className="grid gap-4">
          <section className="rounded-lg border border-stone-200 bg-white p-5">
            <div className="flex items-center gap-2">
              <Clock aria-hidden="true" className="text-emerald-800" size={22} />
              <h2 className="text-xl font-black">Grade de hoje</h2>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {slots.map((slot) => {
                const full = slot.filled >= slot.capacity;
                return (
                  <article
                    key={slot.time}
                    className={[
                      "rounded-md border p-4",
                      full ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50",
                    ].join(" ")}
                  >
                    <p className="text-lg font-black">{slot.time}</p>
                    <p className="mt-1 text-sm text-stone-700">
                      {slot.filled}/{slot.capacity} vagas
                    </p>
                    <p
                      className={
                        full
                          ? "mt-3 text-sm font-bold text-red-800"
                          : "mt-3 text-sm font-bold text-emerald-800"
                      }
                    >
                      {full ? "Ocupado" : "Livre para agendar"}
                    </p>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="rounded-lg border border-stone-200 bg-white p-5">
            <div className="flex items-center gap-2">
              <Dumbbell aria-hidden="true" className="text-emerald-800" size={22} />
              <h2 className="text-xl font-black">Aulas cadastradas</h2>
            </div>
            <div className="mt-4 space-y-3">
              {sampleBookings.map((booking) => (
                <article
                  key={booking.id}
                  className="grid gap-3 rounded-md border border-stone-200 p-4 sm:grid-cols-[1fr_auto]"
                >
                  <div>
                    <p className="font-bold">{sampleStudent.displayName}</p>
                    <p className="text-sm text-stone-600">
                      {booking.focus} - {shortDateTime(booking.startsAt.toDate())}
                    </p>
                  </div>
                  <span className="max-w-max rounded-md bg-stone-100 px-2 py-1 text-xs font-bold text-stone-700">
                    {booking.status}
                  </span>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  placeholder,
  type = "text",
}: {
  label: string;
  placeholder: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-stone-700">{label}</span>
      <input
        className="focus-ring mt-2 h-11 w-full rounded-md border border-stone-300 px-3"
        placeholder={placeholder}
        type={type}
      />
    </label>
  );
}
