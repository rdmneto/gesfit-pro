import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Package,
  ShoppingBag,
  Star,
  XCircle,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Badge, CardHeader, EmptyState, ProgressBar, SectionHeader } from "../components/ui/Primitives";
import { Button } from "../components/ui/Button";
import { useClassProducts, useStudentPurchases, useStudent, useTeam } from "../lib/hooks";
import { moneyFromCents } from "../lib/format";
import { useSessionStore } from "../store/session";
import type { ClassProduct, PurchaseStatus } from "../types/domain";

const statusConfig: Record<PurchaseStatus, { label: string; badge: "green" | "amber" | "red" | "stone" | "blue"; icon: typeof CheckCircle2 }> = {
  awaiting_payment: { label: "Aguardando pagamento", badge: "amber", icon: Clock },
  payment_submitted: { label: "Comprovante enviado", badge: "blue", icon: Clock },
  paid: { label: "Pagamento confirmado", badge: "green", icon: CheckCircle2 },
  rejected: { label: "Pagamento recusado", badge: "red", icon: XCircle },
};

export function StudentClassesPage() {
  const user = useSessionStore((state) => state.user);
  const claims = useSessionStore((state) => state.claims);
  const teamId = claims.teamId ?? null;

  // Firestore hooks
  const { data: student } = useStudent(user?.uid ?? null);
  const { data: purchases = [], loading: purchasesLoading } = useStudentPurchases(user?.uid ?? null);
  const { data: products = [], loading: productsLoading } = useClassProducts(teamId);
  const { data: team } = useTeam(teamId);

  const [showBuyForm, setShowBuyForm] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ClassProduct | null>(null);
  const [fileAttached, setFileAttached] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const totalClasses = student?.classesQuotaMonth ?? 0;
  const usedClasses = student?.classesUsedMonth ?? 0;
  const remainingClasses = Math.max(0, totalClasses - usedClasses);
  const usagePercent = totalClasses > 0 ? (usedClasses / totalClasses) * 100 : 0;
  const isLow = remainingClasses <= 2 && totalClasses > 0;
  const isEmpty = remainingClasses === 0 && totalClasses > 0;

  const progressVariant = isEmpty ? "danger" : isLow ? "warning" : "default";

  const activeProducts = products.filter((p) => p.active && p.publicVisible);
  const packageProducts = activeProducts.filter((p) => p.type === "package");
  const singleProducts = activeProducts.filter((p) => p.type === "single");

  // Trainer's team slug for the "Ver vitrine" link
  const teamSlug = team?.slug ?? teamId ?? "";

  async function handleBuy() {
    if (!selectedProduct || !user || !db) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, "classPurchases"), {
        studentId: user.uid,
        studentName: user.displayName ?? "Aluno",
        teamId: teamId ?? "",
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        classesCount: selectedProduct.classesCount,
        amountCents: selectedProduct.priceCents,
        status: "awaiting_payment",
        submittedAt: new Date().toISOString().split("T")[0],
        proofFileName: proofFile?.name ?? null,
        createdAt: serverTimestamp(),
      });
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setShowBuyForm(false);
        setSelectedProduct(null);
        setFileAttached(false);
        setProofFile(null);
      }, 2500);
    } catch (err) {
      console.error("Erro ao enviar pedido:", err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-8 animate-fade-in">
      <SectionHeader
        eyebrow="Gestão de aulas"
        title="Minhas aulas"
        description="Acompanhe seu saldo, histórico de compras e adquira mais aulas quando precisar."
      />

      {/* ── Saldo de aulas ───────────────────────────────── */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {/* Saldo card */}
        <div
          className={[
            "card col-span-full sm:col-span-1 p-6",
            isLow ? "border-amber-200 bg-amber-50" : isEmpty ? "border-red-200 bg-red-50" : "",
          ].join(" ")}
        >
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-sm">
              <Zap size={20} className={isLow ? "text-amber-600" : "text-emerald-700"} />
            </div>
            {isLow && (
              <Badge variant="amber" icon={<AlertTriangle size={11} />}>
                {isEmpty ? "Esgotado!" : "Saldo baixo"}
              </Badge>
            )}
          </div>
          <p className="mt-4 text-sm font-semibold text-stone-500">Aulas restantes</p>
          {totalClasses === 0 ? (
            <p className="mt-1 text-2xl font-black text-stone-400">— sem plano ativo</p>
          ) : (
            <>
              <p
                className={["mt-1 text-5xl font-black", isLow ? "text-amber-700" : "text-emerald-800"].join(" ")}
                style={{ fontFamily: "var(--font-display)" }}
              >
                {remainingClasses}
              </p>
              <p className="mt-1 text-xs text-stone-400">de {totalClasses} aulas do plano atual</p>
              <div className="mt-4">
                <ProgressBar
                  value={usagePercent}
                  variant={progressVariant}
                  label={`${usedClasses} utilizadas`}
                  showValue
                />
              </div>
              {isLow && (
                <p className="mt-3 text-xs font-medium text-amber-800">
                  {isEmpty
                    ? "Você não tem mais aulas. Adquira um pacote para continuar treinando."
                    : `Restam apenas ${remainingClasses} aula${remainingClasses > 1 ? "s" : ""}. Considere renovar!`}
                </p>
              )}
            </>
          )}
        </div>

        {/* Stats */}
        <div className="card col-span-full sm:col-span-2 grid grid-cols-2 divide-x divide-[var(--color-border)] p-0 overflow-hidden">
          <StatBox label="Aulas usadas este mês" value={usedClasses} sub="de treinos realizados" icon={CheckCircle2} />
          <StatBox label="Total do plano" value={totalClasses} sub="aulas por mês" icon={Package} />
        </div>
      </div>

      {/* ── Alert comprar ────────────────────────────────── */}
      {isLow && !showBuyForm && (
        <div className={[
          "mt-4 flex flex-col gap-3 rounded-xl p-4 sm:flex-row sm:items-center sm:justify-between",
          isEmpty ? "bg-red-50 border border-red-200" : "bg-amber-50 border border-amber-200",
        ].join(" ")}>
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} className={isEmpty ? "text-red-600" : "text-amber-600"} />
            <p className={["text-sm font-semibold", isEmpty ? "text-red-800" : "text-amber-800"].join(" ")}>
              {isEmpty
                ? "Suas aulas acabaram! Adquira um pacote para voltar a treinar."
                : "Seu saldo está acabando. Não deixe a rotina parar!"}
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            icon={<ShoppingBag size={15} />}
            onClick={() => setShowBuyForm(true)}
          >
            Comprar agora
          </Button>
        </div>
      )}

      {/* ── Formulário de compra ─────────────────────────── */}
      {showBuyForm ? (
        <div className="mt-4 card p-6 animate-slide-up">
          <CardHeader icon={ShoppingBag} title="Adquirir aulas" />

          {submitted ? (
            <div className="mt-6 flex flex-col items-center gap-3 py-8 text-center animate-scale-in">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle2 size={28} className="text-emerald-700" />
              </div>
              <p className="text-lg font-black text-stone-900">Pedido enviado!</p>
              <p className="max-w-xs text-sm text-stone-500">
                O treinador vai confirmar o pagamento em breve. Suas aulas serão liberadas logo após.
              </p>
            </div>
          ) : productsLoading ? (
            <div className="mt-8 flex justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-700" />
            </div>
          ) : activeProducts.length === 0 ? (
            <EmptyState
              icon={ShoppingBag}
              title="Nenhuma oferta disponível"
              description="O treinador ainda não cadastrou pacotes ou aulas avulsas."
              className="mt-4"
            />
          ) : (
            <div className="mt-5 grid gap-6 lg:grid-cols-2">
              {/* Pacotes */}
              <div>
                {packageProducts.length > 0 && (
                  <>
                    <p className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-3">Pacotes</p>
                    <div className="space-y-2">
                      {packageProducts.map((product) => (
                        <ProductOption
                          key={product.id}
                          product={product}
                          selected={selectedProduct?.id === product.id}
                          onSelect={() => setSelectedProduct(product)}
                        />
                      ))}
                    </div>
                  </>
                )}
                {singleProducts.length > 0 && (
                  <>
                    <p className="mt-4 text-xs font-bold uppercase tracking-wider text-stone-400 mb-3">Aula avulsa</p>
                    <div className="space-y-2">
                      {singleProducts.map((product) => (
                        <ProductOption
                          key={product.id}
                          product={product}
                          selected={selectedProduct?.id === product.id}
                          onSelect={() => setSelectedProduct(product)}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Resumo + comprovante */}
              <div className="space-y-4">
                {selectedProduct ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 animate-fade-in">
                    <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Selecionado</p>
                    <p className="mt-1 text-lg font-black text-stone-900">{selectedProduct.name}</p>
                    <p className="text-2xl font-black text-emerald-800" style={{ fontFamily: "var(--font-display)" }}>
                      {moneyFromCents(selectedProduct.priceCents)}
                    </p>
                    <p className="mt-1 text-xs text-stone-500">
                      {selectedProduct.classesCount} aula{selectedProduct.classesCount > 1 ? "s" : ""}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-stone-600">{selectedProduct.description}</p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50 p-4 text-center text-sm text-stone-400">
                    Selecione um pacote ou aula ao lado
                  </div>
                )}

                <label className="block">
                  <span className="text-sm font-semibold text-stone-700">
                    Comprovante de pagamento <span className="text-stone-400 font-normal">(opcional)</span>
                  </span>
                  <div className={[
                    "mt-2 flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed p-4 transition-all",
                    fileAttached ? "border-emerald-400 bg-emerald-50" : "border-stone-200 hover:border-stone-300",
                  ].join(" ")}>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="sr-only"
                      id="proof-file"
                      onChange={(e) => {
                        const file = e.target.files?.[0] ?? null;
                        setProofFile(file);
                        setFileAttached(Boolean(file));
                      }}
                    />
                    <label htmlFor="proof-file" className="flex w-full cursor-pointer items-center gap-3">
                      {fileAttached ? (
                        <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
                      ) : (
                        <ShoppingBag size={20} className="text-stone-400 shrink-0" />
                      )}
                      <span className="text-sm text-stone-500">
                        {proofFile ? `📎 ${proofFile.name}` : "Clique para anexar PDF, JPG ou PNG"}
                      </span>
                    </label>
                  </div>
                </label>

                <div className="flex gap-3">
                  <Button
                    variant="primary"
                    disabled={!selectedProduct || submitting}
                    icon={submitting ? undefined : <CheckCircle2 size={18} />}
                    onClick={handleBuy}
                    className="flex-1"
                  >
                    {submitting ? "Enviando…" : "Confirmar pedido"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => { setShowBuyForm(false); setSelectedProduct(null); }}
                    disabled={submitting}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            variant="primary"
            icon={<ShoppingBag size={18} />}
            onClick={() => setShowBuyForm(true)}
          >
            Comprar aulas ou pacote
          </Button>
          {teamSlug && (
            <Link to={`/t/${teamSlug}`} className="btn btn-secondary focus-ring">
              Ver vitrine do treinador
              <ArrowRight size={16} />
            </Link>
          )}
        </div>
      )}

      {/* ── Histórico de compras ─────────────────────────── */}
      <section className="mt-6 card p-5">
        <CardHeader icon={Package} title="Histórico de aquisições" />
        {purchasesLoading ? (
          <div className="mt-6 flex justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-700" />
          </div>
        ) : purchases.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title="Nenhuma compra ainda"
            description="Adquira seu primeiro pacote ou aula avulsa."
            className="mt-4"
          />
        ) : (
          <div className="mt-4 space-y-3 stagger">
            {purchases.map((purchase) => {
              const cfg = statusConfig[purchase.status];
              const Icon = cfg.icon;
              return (
                <article
                  key={purchase.id}
                  className="grid gap-3 rounded-xl border border-[var(--color-border)] p-4 sm:grid-cols-[1fr_auto]"
                >
                  <div>
                    <p className="font-black text-stone-900">{purchase.productName}</p>
                    <p className="mt-1 text-sm text-stone-500">
                      {purchase.classesCount} aula{purchase.classesCount > 1 ? "s" : ""} •{" "}
                      {moneyFromCents(purchase.amountCents)}
                    </p>
                    {purchase.submittedAt && (
                      <p className="mt-1 text-xs text-stone-400">
                        Enviado em {new Date(purchase.submittedAt + "T12:00:00").toLocaleDateString("pt-BR")}
                      </p>
                    )}
                    {purchase.proofFileName && (
                      <p className="mt-1 text-xs text-emerald-700 font-semibold">
                        📎 {purchase.proofFileName}
                      </p>
                    )}
                  </div>
                  <Badge variant={cfg.badge} icon={<Icon size={11} />}>
                    {cfg.label}
                  </Badge>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Ofertas disponíveis ──────────────────────────── */}
      <section className="mt-6 card p-5">
        <CardHeader icon={Star} title="Ofertas disponíveis" />
        {productsLoading ? (
          <div className="mt-6 flex justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-700" />
          </div>
        ) : activeProducts.length === 0 ? (
          <EmptyState
            icon={Star}
            title="Nenhuma oferta disponível"
            description="O treinador ainda não cadastrou pacotes ou aulas avulsas."
            className="mt-4"
          />
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 stagger">
            {activeProducts.map((product) => (
              <article
                key={product.id}
                className={[
                  "rounded-xl border p-4 transition-all cursor-pointer",
                  selectedProduct?.id === product.id
                    ? "border-emerald-500 bg-emerald-50 shadow-md"
                    : "border-[var(--color-border)] bg-white hover:border-emerald-300 hover:shadow-sm",
                ].join(" ")}
                onClick={() => { setShowBuyForm(true); setSelectedProduct(product); }}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-black text-stone-900 text-sm">{product.name}</p>
                  <Badge variant={product.type === "package" ? "green" : "stone"}>
                    {product.type === "package" ? "Pacote" : "Avulsa"}
                  </Badge>
                </div>
                <p className="mt-2 text-2xl font-black text-emerald-800" style={{ fontFamily: "var(--font-display)" }}>
                  {moneyFromCents(product.priceCents)}
                </p>
                <p className="text-xs text-stone-400">{product.classesCount} aula{product.classesCount > 1 ? "s" : ""}</p>
                <p className="mt-2 text-xs leading-5 text-stone-500">{product.description}</p>
                <Button
                  variant="primary"
                  size="sm"
                  className="mt-3 w-full"
                  icon={<ShoppingBag size={14} />}
                  onClick={(e) => { e.stopPropagation(); setShowBuyForm(true); setSelectedProduct(product); }}
                >
                  Adquirir
                </Button>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

function StatBox({ label, value, sub, icon: Icon }: {
  label: string;
  value: number;
  sub: string;
  icon: typeof CheckCircle2;
}) {
  return (
    <div className="flex flex-col justify-center p-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50">
        <Icon size={18} className="text-emerald-700" />
      </div>
      <p className="mt-3 text-sm text-stone-500">{label}</p>
      <p className="mt-0.5 text-3xl font-black text-stone-950" style={{ fontFamily: "var(--font-display)" }}>{value}</p>
      <p className="mt-0.5 text-xs text-stone-400">{sub}</p>
    </div>
  );
}

function ProductOption({
  product,
  selected,
  onSelect,
}: {
  product: ClassProduct;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={[
        "focus-ring w-full rounded-xl border p-3 text-left transition-all",
        selected
          ? "border-emerald-500 bg-emerald-50 shadow-sm"
          : "border-[var(--color-border)] bg-white hover:border-emerald-300",
      ].join(" ")}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold text-sm text-stone-900">{product.name}</span>
        <span className="font-black text-emerald-800 text-sm">{moneyFromCents(product.priceCents)}</span>
      </div>
      <p className="mt-0.5 text-xs text-stone-400">
        {product.classesCount} aula{product.classesCount > 1 ? "s" : ""}
      </p>
    </button>
  );
}
