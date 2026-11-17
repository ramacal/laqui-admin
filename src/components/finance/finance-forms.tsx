"use client";

import { useActionState, useState } from "react";
import type { FormState } from "@/app/panel/finanzas/actions";

type Action = (prev: FormState, form: FormData) => Promise<FormState>;
type FundKind = "CASH" | "BANK_ACCOUNT" | "DIGITAL_WALLET" | "CARD_TERMINAL" | "OTHER";

function Result({ state }: { state: FormState }) {
  if (!state) return null;
  return (
    <p className={`small ${state.ok ? "ok-text" : "error"}`} role="status">
      {state.message}
    </p>
  );
}

const KIND_OPTIONS: { value: FundKind; label: string }[] = [
  { value: "DIGITAL_WALLET", label: "Billetera virtual (Mercado Pago, Cuenta DNI, MODO…)" },
  { value: "CARD_TERMINAL", label: "Posnet / tarjetas" },
  { value: "CASH", label: "Otra caja de efectivo" },
  { value: "OTHER", label: "Otro" },
];

type FundValues = {
  name?: string;
  provider?: string | null;
  holderName?: string | null;
  cbuCvu?: string | null;
  alias?: string | null;
  merchantNumber?: string | null;
  accountNumber?: string | null;
  reference?: string | null;
  showToCustomers?: boolean;
  openingBalance?: string;
  openingDate?: string;
};

/** Fields of a payment method for its type. Used to create and to edit. */
function FundFields({ kind, values, today }: { kind: FundKind; values?: FundValues; today: string }) {
  const bankLike = kind === "BANK_ACCOUNT" || kind === "DIGITAL_WALLET";
  return (
    <>
      <label className="field">
        <span className="small muted">Nombre</span>
        <input
          name="name"
          className="input"
          required
          maxLength={60}
          defaultValue={values?.name}
          placeholder={kind === "DIGITAL_WALLET" ? "Mercado Pago" : kind === "CARD_TERMINAL" ? "Posnet Getnet" : "Caja 2"}
        />
      </label>
      {kind !== "CASH" && (
        <label className="field">
          <span className="small muted">{kind === "BANK_ACCOUNT" ? "Banco" : "Proveedor"}</span>
          <input
            name="provider"
            className="input"
            maxLength={60}
            defaultValue={values?.provider ?? ""}
            placeholder={kind === "BANK_ACCOUNT" ? "Banco Provincia" : kind === "CARD_TERMINAL" ? "Getnet" : "Mercado Pago"}
          />
        </label>
      )}
      {bankLike && (
        <>
          <label className="field">
            <span className="small muted">Titular</span>
            <input name="holderName" className="input" maxLength={80} defaultValue={values?.holderName ?? ""} />
          </label>
          <div className="grid-2">
            <label className="field">
              <span className="small muted">{kind === "BANK_ACCOUNT" ? "CBU" : "CVU"} (22 dígitos)</span>
              <input name="cbuCvu" className="input" inputMode="numeric" maxLength={30} defaultValue={values?.cbuCvu ?? ""} />
            </label>
            <label className="field">
              <span className="small muted">Alias</span>
              <input name="alias" className="input" maxLength={20} defaultValue={values?.alias ?? ""} placeholder="agencia.brujita" />
            </label>
          </div>
        </>
      )}
      {kind === "BANK_ACCOUNT" && (
        <label className="field">
          <span className="small muted">N.º de cuenta (como figura en el ticket de Lotería)</span>
          <input name="accountNumber" className="input" maxLength={30} defaultValue={values?.accountNumber ?? ""} placeholder="C.A. 12345/0" />
        </label>
      )}
      {kind === "CARD_TERMINAL" && (
        <label className="field">
          <span className="small muted">N.º de comercio / terminal</span>
          <input name="merchantNumber" className="input" maxLength={40} defaultValue={values?.merchantNumber ?? ""} />
        </label>
      )}
      <label className="field">
        <span className="small muted">Referencia para vos (opcional)</span>
        <input
          name="reference"
          className="input"
          maxLength={120}
          defaultValue={values?.reference ?? ""}
          placeholder="La cuenta que usamos para premios"
        />
      </label>
      <div className="grid-2">
        <label className="field">
          <span className="small muted">Saldo inicial ($)</span>
          <input name="openingBalance" className="input" inputMode="decimal" defaultValue={values?.openingBalance ?? "0"} />
        </label>
        <label className="field">
          <span className="small muted">al día</span>
          <input type="date" name="openingDate" className="input" defaultValue={values?.openingDate ?? today} required />
        </label>
      </div>
      {kind !== "CASH" && (
        <label className="check">
          <input type="checkbox" name="showToCustomers" defaultChecked={values?.showToCustomers} />
          <span>Mostrar estos datos a los clientes para pagar</span>
        </label>
      )}
    </>
  );
}

export function NewFundForm({ action, today }: { action: Action; today: string }) {
  const [state, formAction, pending] = useActionState(action, null);
  const [kind, setKind] = useState<FundKind>("DIGITAL_WALLET");
  return (
    <form action={formAction} className="stack-sm">
      <label className="field">
        <span className="small muted">Tipo</span>
        <select name="kind" className="input" value={kind} onChange={(e) => setKind(e.target.value as FundKind)}>
          {KIND_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <FundFields key={kind} kind={kind} today={today} />
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Guardando…" : "Agregar medio de cobro"}
      </button>
      <Result state={state} />
    </form>
  );
}

export function EditFundForm({
  action,
  kind,
  values,
  today,
}: {
  action: Action;
  kind: FundKind;
  values: FundValues;
  today: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="stack-sm">
      <FundFields kind={kind} values={values} today={today} />
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Guardando…" : "Guardar datos"}
      </button>
      <Result state={state} />
    </form>
  );
}

type Fund = { id: string; name: string };
const MOVEMENT_KINDS = [
  { value: "LOTTERY_DEBIT", label: "Lotería debita", direction: "OUT" },
  { value: "LOTTERY_CREDIT", label: "Lotería acredita", direction: "IN" },
  { value: "CUSTOMER_PAYMENT", label: "Cobro a cliente", direction: "IN" },
  { value: "PRIZE_PAYOUT", label: "Pago de premio", direction: "OUT" },
  { value: "EXPENSE", label: "Gasto", direction: "OUT" },
  { value: "ADJUSTMENT", label: "Ajuste", direction: "IN" },
  { value: "OTHER", label: "Otro", direction: "IN" },
] as const;

export function MovementForm({ action, funds, today }: { action: Action; funds: Fund[]; today: string }) {
  const [state, formAction, pending] = useActionState(action, null);
  const [kind, setKind] = useState<(typeof MOVEMENT_KINDS)[number]["value"]>("LOTTERY_DEBIT");
  const [direction, setDirection] = useState<"IN" | "OUT">("OUT");
  return (
    <form action={formAction} className="stack-sm">
      <div className="grid-2">
        <label className="field">
          <span className="small muted">Tipo</span>
          <select
            name="kind"
            className="input"
            value={kind}
            onChange={(e) => {
              const k = MOVEMENT_KINDS.find((m) => m.value === e.target.value)!;
              setKind(k.value);
              setDirection(k.direction);
            }}
          >
            {MOVEMENT_KINDS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="small muted">Medio</span>
          <select name="fundId" className="input" required>
            {funds.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <fieldset className="segmented">
        <legend className="small muted">La plata</legend>
        <label>
          <input type="radio" name="direction" value="IN" checked={direction === "IN"} onChange={() => setDirection("IN")} />
          <span>Entra</span>
        </label>
        <label>
          <input type="radio" name="direction" value="OUT" checked={direction === "OUT"} onChange={() => setDirection("OUT")} />
          <span>Sale</span>
        </label>
      </fieldset>
      <div className="grid-2">
        <label className="field">
          <span className="small muted">Monto ($)</span>
          <input name="amount" className="input" inputMode="decimal" placeholder="150.000" required />
        </label>
        <label className="field">
          <span className="small muted">Fecha</span>
          <input type="date" name="date" className="input" defaultValue={today} required />
        </label>
      </div>
      <label className="field">
        <span className="small muted">Detalle (opcional)</span>
        <input name="description" className="input" maxLength={160} placeholder="Liquidación semana 46" />
      </label>
      <label className="field">
        <span className="small muted">Referencia / n.º de comprobante (opcional)</span>
        <input name="reference" className="input" maxLength={60} />
      </label>
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Guardando…" : "Cargar movimiento"}
      </button>
      <Result state={state} />
    </form>
  );
}

export function TransferForm({ action, funds, today }: { action: Action; funds: Fund[]; today: string }) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="stack-sm">
      <div className="grid-2">
        <label className="field">
          <span className="small muted">Desde</span>
          <select name="fromFundId" className="input" required defaultValue={funds[0]?.id}>
            {funds.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="small muted">Hacia</span>
          <select name="toFundId" className="input" required defaultValue={funds[1]?.id}>
            {funds.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid-2">
        <label className="field">
          <span className="small muted">Monto ($)</span>
          <input name="amount" className="input" inputMode="decimal" required />
        </label>
        <label className="field">
          <span className="small muted">Fecha</span>
          <input type="date" name="date" className="input" defaultValue={today} required />
        </label>
      </div>
      <label className="field">
        <span className="small muted">Detalle (opcional)</span>
        <input name="description" className="input" maxLength={160} placeholder="Depósito de la caja al banco" />
      </label>
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Guardando…" : "Registrar transferencia"}
      </button>
      <Result state={state} />
    </form>
  );
}

/** Daily Lotería ticket: amount, due date, debit/credit, account and photo. */
export function SettlementForm({
  action,
  today,
  tomorrow,
  accountNumber,
}: {
  action: Action;
  today: string;
  tomorrow: string;
  accountNumber: string | null;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const askConfirm = Boolean(state && !state.ok && state.message.includes("confirmá"));
  return (
    <form action={formAction} className="stack-sm">
      <div className="grid-2">
        <label className="field">
          <span className="small muted">Fecha del ticket</span>
          <input type="date" name="issueDate" className="input" defaultValue={today} max={today} required />
        </label>
        <label className="field">
          <span className="small muted">Vencimiento (VTO)</span>
          <input type="date" name="dueDate" className="input" defaultValue={tomorrow} required />
        </label>
      </div>
      <fieldset className="segmented">
        <legend className="small muted">El saldo será</legend>
        <label>
          <input type="radio" name="direction" value="DEBIT" defaultChecked />
          <span>Debitado</span>
        </label>
        <label>
          <input type="radio" name="direction" value="CREDIT" />
          <span>Acreditado</span>
        </label>
      </fieldset>
      <div className="grid-2">
        <label className="field">
          <span className="small muted">Saldo ($)</span>
          <input name="amount" className="input" inputMode="decimal" placeholder="450.000,00" required />
        </label>
        <label className="field">
          <span className="small muted">Cuenta (C.A.)</span>
          <input name="accountNumber" className="input" maxLength={30} defaultValue={accountNumber ?? ""} placeholder="C.A. 12345/0" />
        </label>
      </div>
      <label className="field">
        <span className="small muted">Foto del ticket (opcional)</span>
        <input type="file" name="ticket" className="input file" accept="image/*,application/pdf" capture="environment" />
      </label>
      <label className="field">
        <span className="small muted">Nota (opcional)</span>
        <input name="notes" className="input" maxLength={200} />
      </label>
      {askConfirm && (
        <label className="check">
          <input type="checkbox" name="confirmAccount" />
          <span>La cuenta es distinta pero quiero guardarlo igual</span>
        </label>
      )}
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Guardando…" : "Cargar ticket"}
      </button>
      <Result state={state} />
    </form>
  );
}
