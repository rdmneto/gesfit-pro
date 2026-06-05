import {
  Banknote,
  CheckCircle2,
  Dumbbell,
  Megaphone,
  PackagePlus,
  Send,
  XCircle,
} from "lucide-react";
import { useState, useEffect } from "react";
import { collection, addDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useSessionStore } from "../store/session";
import { useClassProducts, usePendingPurchases } from "../lib/hooks";
import { creditEnrollmentClasses } from "../lib/enrollments";
import { moneyFromCents } from "../lib/format";
import type { ClassProductType, PurchaseStatus, ClassProduct, ClassPurchase, PromotionalPackage } from "../types/domain";

const statusLabel: Record<PurchaseStatus, string> = {
  awaiting_payment: "Aguardando pagamento",
  payment_submitted: "Comprovante enviado",
  paid: "Pagamento confirmado",
  rejected: "Pagamento recusado",
};

export function PackagesPage() {
  const teamId = useSessionStore((state) => state.claims.teamId);
  const user = useSessionStore((state) => state.user);

  const { data: dbProducts, loading: loadingProducts } = useClassProducts(teamId);
  const { data: dbPurchases, loading: loadingPurchases } = usePendingPurchases(teamId);

  const activeProducts = dbProducts ?? [];
  const purchases = dbPurchases ?? [];

  // Form states for new offer
  const [productType, setProductType] = useState<ClassProductType>("single");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [classesCount, setClassesCount] = useState("");
  const [description, setDescription] = useState("");
  const [orientador, setOrientador] = useState(user?.displayName || "");
  
  // Promo states
  const [promoName, setPromoName] = useState("");
  const [promoPrice, setPromoPrice] = useState("");
  const [promoClasses, setPromoClasses] = useState("");
  const [promoQty, setPromoQty] = useState("");
  const [promos, setPromos] = useState<PromotionalPackage[]>([]);

  useEffect(() => {
    if (user?.displayName && !orientador) {
      setOrientador(user.displayName);
    }
  }, [user, orientador]);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSaveProduct() {
    if (!name || !price || !classesCount) {
      setError("Por favor, preencha nome, valor e quantidade de aulas.");
      return;
    }

    const priceNum = parseFloat(price.replace(",", "."));
    if (isNaN(priceNum)) {
      setError("Preço inválido.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    const newProduct: Omit<ClassProduct, "id"> = {
      teamId: teamId || "",
      trainerId: user?.uid || "",
      name,
      type: productType,
      classesCount: parseInt(classesCount, 10),
      priceCents: Math.round(priceNum * 100),
      active: true,
      publicVisible: true,
      description,
    };

    if (!db) {
      setError("Banco de dados indisponível no momento.");
      setSaving(false);
      return;
    }

    try {
      await addDoc(collection(db, "classProducts"), newProduct);
      setSaving(false);
      setMessage("Oferta cadastrada com sucesso!");
      setName("");
      setPrice("");
      setClassesCount("");
      setDescription("");
    } catch (err: any) {
      console.error(err);
      setError("Erro ao salvar produto: " + err.message);
      setSaving(false);
    }
  }

  async function handleSavePromo() {
    if (!promoName || !promoPrice || !promoClasses || !promoQty) {
      setError("Preencha todos os campos da promoção.");
      return;
    }

    const priceNum = parseFloat(promoPrice.replace(",", "."));
    if (isNaN(priceNum)) {
      setError("Preço promocional inválido.");
      return;
    }

    const newPromo = {
      id: `promo-${Date.now()}`,
      teamId: teamId || "",
      trainerId: user?.uid || "",
      name: promoName,
      type: "package" as const,
      classesCount: parseInt(promoClasses, 10),
      priceCents: Math.round(priceNum * 100),
      active: true,
      publicVisible: false,
      description: "Oferta promocional limitada.",
      promotional: true as const,
      audience: "all_students" as const,
      offeredQuantity: parseInt(promoQty, 10),
      soldQuantity: 0,
      availableUntilRemoved: true,
    };

    setPromos((prev) => [newPromo, ...prev]);
    setPromoName("");
    setPromoPrice("");
    setPromoClasses("");
    setPromoQty("");
    setMessage("Promoção criada com sucesso!");
    setTimeout(() => setMessage(""), 3000);
  }

  function handleRemovePromo(id: string) {
    setPromos((prev) => prev.filter((p) => p.id !== id));
    setMessage("Promoção removida.");
    setTimeout(() => setMessage(""), 3000);
  }

  async function handleReviewPurchase(purchase: ClassPurchase, status: "paid" | "rejected") {
    if (!db) {
      setError("Banco de dados indisponível no momento.");
      return;
    }

    try {
      const ref = doc(db, "classPurchases", purchase.id);
      await updateDoc(ref, {
        status,
        reviewedAt: new Date().toISOString(),
        reviewedBy: user?.uid || "",
      });

      // Pagamento confirmado → credita as aulas no saldo do vínculo do aluno.
      if (status === "paid") {
        const trainerId = purchase.trainerId || teamId || "";
        if (purchase.studentId && trainerId && purchase.classesCount > 0) {
          try {
            await creditEnrollmentClasses(db, purchase.studentId, trainerId, purchase.classesCount);
          } catch (creditErr) {
            console.error("Falha ao creditar aulas no vínculo:", creditErr);
          }
        }
      }

      setMessage(
        status === "paid"
          ? `Compra confirmada! ${purchase.classesCount} aula(s) creditada(s).`
          : "Compra recusada.",
      );
      setTimeout(() => setMessage(""), 3000);
    } catch (err: any) {
      console.error(err);
      setError("Erro ao revisar compra: " + err.message);
    }
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-8 animate-fade-in">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-emerald-800">
            Área Comercial
          </p>
          <h1 className="text-3xl font-black text-stone-950" style={{ fontFamily: "var(--font-display)" }}>
            Planos, Pacotes e Promoções
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
            Gerencie suas ofertas de aula avulsa e pacotes de créditos. Acompanhe os comprovantes de PIX enviados pelos alunos para liberar os créditos.
          </p>
        </div>
      </div>

      {message && (
        <div className="mt-4 rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 text-sm font-semibold text-emerald-800 animate-slide-up">
          {message}
        </div>
      )}
      {error && (
        <div className="mt-4 rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-sm font-semibold text-rose-800 animate-slide-up">
          {error}
        </div>
      )}

      {/* Grid: Cadastro de Ofertas e Ofertas Ativas */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="card p-5">
          <div className="flex items-center gap-2">
            <PackagePlus aria-hidden="true" className="text-emerald-800" size={20} />
            <h2 className="text-lg font-black text-stone-950">Cadastrar aula ou pacote</h2>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="text-xs font-bold uppercase tracking-wide text-stone-500">Tipo de venda</span>
              <select
                className="focus-ring mt-1.5 h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm"
                value={productType}
                onChange={(event) => setProductType(event.target.value as ClassProductType)}
              >
                <option value="single">Aula avulsa</option>
                <option value="package">Pacote de aulas</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-stone-500">Nome do plano/pacote</span>
              <input
                className="focus-ring mt-1.5 h-11 w-full rounded-xl border border-stone-200 px-3 text-sm"
                placeholder={productType === "single" ? "Aula avulsa funcional" : "Pacote 8 aulas"}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-stone-500">Valor em R$</span>
              <input
                className="focus-ring mt-1.5 h-11 w-full rounded-xl border border-stone-200 px-3 text-sm"
                placeholder={productType === "single" ? "65,00" : "440,00"}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-stone-500">Quantidade de aulas</span>
              <input
                className="focus-ring mt-1.5 h-11 w-full rounded-xl border border-stone-200 px-3 text-sm"
                placeholder={productType === "single" ? "1" : "8"}
                type="number"
                value={classesCount}
                onChange={(e) => setClassesCount(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-stone-500">Orientador responsável</span>
              <input
                className="focus-ring mt-1.5 h-11 w-full rounded-xl border border-stone-200 px-3 text-sm"
                value={orientador}
                onChange={(e) => setOrientador(e.target.value)}
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-bold uppercase tracking-wide text-stone-500">Descrição curta</span>
              <textarea
                className="focus-ring mt-1.5 min-h-24 w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm"
                placeholder="Explique regras de uso, validade combinada e diferenciais do pacote."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              className="focus-ring btn btn-primary px-5 h-11"
              disabled={saving}
              onClick={handleSaveProduct}
            >
              <Banknote aria-hidden="true" size={16} />
              {saving ? "Salvando..." : "Salvar oferta"}
            </button>
          </div>
        </section>

        <section className="card p-5">
          <div className="flex items-center gap-2">
            <Dumbbell aria-hidden="true" className="text-emerald-800" size={20} />
            <h2 className="text-lg font-black text-stone-950">Ofertas cadastradas</h2>
          </div>
          <div className="mt-4 max-h-[460px] overflow-y-auto pr-1 space-y-3">
            {loadingProducts && (
              <p className="text-sm text-stone-400">Carregando ofertas...</p>
            )}
            {activeProducts.length === 0 ? (
              <p className="text-sm text-stone-400 italic py-8 text-center bg-stone-50 rounded-xl border border-dashed border-stone-200">
                Nenhuma oferta ativa cadastrada.
              </p>
            ) : (
              activeProducts.map((product) => (
                <article key={product.id} className="rounded-xl border border-stone-200 p-4 hover:border-stone-300 transition-colors bg-stone-50/50">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-stone-900">{product.name}</p>
                      <p className="mt-0.5 text-xs text-stone-500">
                        {product.classesCount} aula{product.classesCount > 1 ? "s" : ""}
                      </p>
                    </div>
                    <span className="rounded-lg bg-emerald-50 px-2 py-0.5 text-2xs font-bold uppercase tracking-wider text-emerald-800 border border-emerald-100">
                      {product.type === "single" ? "Avulsa" : "Pacote"}
                    </span>
                  </div>
                  <p className="mt-3 text-2xl font-black text-stone-950">{moneyFromCents(product.priceCents)}</p>
                  <p className="mt-1.5 text-xs leading-5 text-stone-600 line-clamp-2">{product.description}</p>
                </article>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Grid: Promoção e Promoções Ativas */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="card p-5">
          <div className="flex items-center gap-2">
            <Megaphone aria-hidden="true" className="text-emerald-800" size={20} />
            <h2 className="text-lg font-black text-stone-950">Criar pacote promocional</h2>
          </div>
          <p className="mt-1 text-xs text-stone-400">
            Disponível temporariamente na vitrine pública até que o estoque acabe ou você delete.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-stone-500">Nome da promoção</span>
              <input
                className="focus-ring mt-1.5 h-11 w-full rounded-xl border border-stone-200 px-3 text-sm"
                placeholder="Junho em Movimento"
                value={promoName}
                onChange={(e) => setPromoName(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-stone-500">Valor promocional (R$)</span>
              <input
                className="focus-ring mt-1.5 h-11 w-full rounded-xl border border-stone-200 px-3 text-sm"
                placeholder="299,00"
                value={promoPrice}
                onChange={(e) => setPromoPrice(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-stone-500">Qtd de aulas</span>
              <input
                className="focus-ring mt-1.5 h-11 w-full rounded-xl border border-stone-200 px-3 text-sm"
                placeholder="6"
                type="number"
                value={promoClasses}
                onChange={(e) => setPromoClasses(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-stone-500">Total pacotes ofertados</span>
              <input
                className="focus-ring mt-1.5 h-11 w-full rounded-xl border border-stone-200 px-3 text-sm"
                placeholder="20"
                type="number"
                value={promoQty}
                onChange={(e) => setPromoQty(e.target.value)}
              />
            </label>
          </div>
          <button
            type="button"
            className="focus-ring btn btn-primary mt-5 px-5 h-11"
            onClick={handleSavePromo}
          >
            <Send aria-hidden="true" size={16} />
            Criar e enviar promoção
          </button>
        </section>

        <section className="card p-5">
          <div className="flex items-center gap-2">
            <Megaphone aria-hidden="true" className="text-emerald-800" size={20} />
            <h2 className="text-lg font-black text-stone-950">Promoções ativas</h2>
          </div>
          <div className="mt-4 space-y-3 max-h-[320px] overflow-y-auto pr-1">
            {promos.length === 0 ? (
              <p className="text-sm text-stone-400 italic py-8 text-center">Nenhuma promoção ativa no momento.</p>
            ) : (
              promos.map((promo) => {
                const remaining = Math.max(promo.offeredQuantity - promo.soldQuantity, 0);
                return (
                  <article
                    key={promo.id}
                    className="grid gap-3 rounded-xl border border-stone-200 p-4 sm:grid-cols-[1fr_auto] bg-stone-50/50"
                  >
                    <div>
                      <p className="font-bold text-stone-900">{promo.name}</p>
                      <p className="mt-0.5 text-xs text-stone-600">
                        {promo.classesCount} aulas por {moneyFromCents(promo.priceCents)}
                      </p>
                      <p className="mt-2 text-2xs font-semibold tracking-wider text-stone-400 uppercase">
                        {promo.audience === "all_students"
                          ? "Público: Todos os alunos"
                          : "Público: Alunos selecionados"}
                      </p>
                    </div>
                    <div className="flex flex-col justify-between items-start sm:items-end">
                      <span className="rounded bg-amber-50 px-2 py-0.5 text-2xs font-bold text-amber-800 border border-amber-100">
                        {remaining} restantes
                      </span>
                      <button
                        type="button"
                        className="focus-ring mt-2 inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 text-xs font-bold text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-colors"
                        onClick={() => handleRemovePromo(promo.id)}
                      >
                        <XCircle aria-hidden="true" size={13} />
                        Remover
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>
      </div>

      {/* Conferência de comprovantes enviados pelos alunos */}
      <div className="mt-6">
        <section className="card p-5">
          <div className="flex items-center gap-2">
            <CheckCircle2 aria-hidden="true" className="text-emerald-800" size={20} />
            <h2 className="text-lg font-black text-stone-950">Conferência do professor</h2>
          </div>
          <p className="mt-1 text-xs text-stone-400">
            Aprovações pendentes de PIX para liberação imediata de créditos de aulas.
          </p>
          <div className="mt-4 space-y-3 max-h-[350px] overflow-y-auto pr-1">
            {loadingPurchases && (
              <p className="text-sm text-stone-400">Carregando compras...</p>
            )}
            {purchases.length === 0 ? (
              <p className="text-sm text-stone-400 italic py-8 text-center bg-stone-50 rounded-xl border border-dashed border-stone-200">
                Nenhum comprovante pendente de conferência.
              </p>
            ) : (
              purchases.map((purchase) => (
                <article
                  key={purchase.id}
                  className="grid gap-3 rounded-xl border border-stone-200 p-4 sm:grid-cols-[1fr_auto] bg-stone-50/50"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-stone-950 truncate">{purchase.productName}</p>
                    <p className="mt-0.5 text-xs text-stone-600">
                      {purchase.classesCount} aula{purchase.classesCount > 1 ? "s" : ""} -{" "}
                      <span className="font-bold text-stone-900">{moneyFromCents(purchase.amountCents)}</span>
                    </p>
                    <p className="mt-1 text-xs text-stone-500 italic truncate">
                      {purchase.proofFileName
                        ? `Doc: ${purchase.proofFileName}`
                        : "Sem comprovante anexado"}
                    </p>
                    <span className="mt-2 inline-flex rounded bg-stone-150 px-2 py-0.5 text-2xs font-bold text-stone-600 border border-stone-200">
                      {statusLabel[purchase.status] || purchase.status}
                    </span>
                  </div>
                  <div className="flex flex-row sm:flex-col gap-2 justify-end">
                    <button
                      type="button"
                      className="focus-ring inline-flex h-8 items-center justify-center gap-1 rounded-lg bg-emerald-700 px-3 text-xs font-bold text-white hover:bg-emerald-600 transition-colors"
                      onClick={() => handleReviewPurchase(purchase, "paid")}
                    >
                      <CheckCircle2 aria-hidden="true" size={13} />
                      Confirmar
                    </button>
                    <button
                      type="button"
                      className="focus-ring inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-stone-200 bg-white px-3 text-xs font-bold text-stone-700 hover:bg-stone-50 transition-colors"
                      onClick={() => handleReviewPurchase(purchase, "rejected")}
                    >
                      <XCircle aria-hidden="true" size={13} />
                      Recusar
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
