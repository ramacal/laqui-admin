// Daily Lotería settlement tickets (spec: agency-finances).
// One ticket per agency and issue day. Saving it keeps ONE movement in the agency's bank
// account, dated on the due date (VTO): Lotería debit (OUT) or credit (IN). Editing updates
// that movement; voiding voids it. The ticket photo goes to the private bucket.
import { randomBytes } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import type { SettlementDirection } from "@/generated/prisma/enums";
import { FinanceValidationError, ensureDefaultFunds, parseMoney, voidMovement } from "@/lib/finance";
import { prisma } from "@/lib/prisma";
import { dateValue, todayIn } from "@/lib/schedule";
import { keys, putFile, signedUrl } from "@/lib/storage";

const TZ = "America/Argentina/Buenos_Aires";
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "application/pdf": "pdf",
};
const MAX_BYTES = 8 * 1024 * 1024;

const normalizeAccount = (s?: string | null) => (s ?? "").toUpperCase().replace(/[^0-9A-Z/]/g, "").replace(/^CA/, "");

export type SettlementInput = {
  agencyId: string;
  issueDate: string; // YYYY-MM-DD
  dueDate: string; // VTO
  amount: string | number;
  direction: SettlementDirection;
  accountNumber?: string | null;
  notes?: string | null;
  confirmAccountMismatch?: boolean; // the user saw the warning and wants to save anyway
  userId?: string | null;
};

async function validate(input: SettlementInput) {
  if (!ISO.test(input.issueDate) || !ISO.test(input.dueDate)) throw new FinanceValidationError("Fechas inválidas.");
  if (input.dueDate < input.issueDate) throw new FinanceValidationError("El vencimiento no puede ser anterior a la fecha del ticket.");
  const amount = parseMoney(input.amount);
  if (amount.isNaN() || amount.lte(0)) throw new FinanceValidationError("El saldo tiene que ser mayor a cero.");
  if (amount.decimalPlaces() > 2) throw new FinanceValidationError("El saldo admite hasta 2 decimales.");

  await ensureDefaultFunds(input.agencyId);
  const bank = await prisma.agencyFund.findUniqueOrThrow({ where: { settlesAgencyId: input.agencyId } });
  if (dateValue(input.dueDate) < bank.openingDate)
    throw new FinanceValidationError(
      `La cuenta del legajo arranca el ${bank.openingDate.toISOString().slice(0, 10)}: corregí su saldo inicial para cargar tickets anteriores.`,
    );
  const ticketAccount = normalizeAccount(input.accountNumber);
  const bankAccount = normalizeAccount(bank.accountNumber);
  if (ticketAccount && bankAccount && ticketAccount !== bankAccount && !input.confirmAccountMismatch)
    throw new FinanceValidationError(
      `El ticket dice la cuenta ${input.accountNumber} pero la cuenta del legajo es ${bank.accountNumber}. Revisalo o confirmá para guardar igual.`,
    );
  return { amount, bank };
}

const movementData = (amount: Prisma.Decimal, direction: SettlementDirection, dueDate: string, issueDate: string) => ({
  date: dateValue(dueDate),
  direction: direction === "DEBIT" ? ("OUT" as const) : ("IN" as const),
  amount,
  kind: direction === "DEBIT" ? ("LOTTERY_DEBIT" as const) : ("LOTTERY_CREDIT" as const),
  description: `Liquidación Lotería del ${issueDate.split("-").reverse().join("/")}`,
  source: "LOTTERY_TICKET" as const,
});

export async function createSettlement(input: SettlementInput) {
  const { amount, bank } = await validate(input);
  const issueDate = dateValue(input.issueDate);
  const existing = await prisma.lotterySettlement.findUnique({
    where: { agencyId_issueDate: { agencyId: input.agencyId, issueDate } },
  });
  if (existing && !existing.voidedAt)
    throw new FinanceValidationError("Ya hay un ticket cargado para ese día. Si está mal, anulalo y cargalo de nuevo.");
  if (existing) await prisma.lotterySettlement.delete({ where: { id: existing.id } }); // replace a voided one

  return prisma.$transaction(async (tx) => {
    const movement = await tx.fundMovement.create({
      data: {
        fundId: bank.id,
        ...movementData(amount, input.direction, input.dueDate, input.issueDate),
        createdById: input.userId ?? null,
      },
    });
    return tx.lotterySettlement.create({
      data: {
        agencyId: input.agencyId,
        issueDate,
        dueDate: dateValue(input.dueDate),
        amount,
        direction: input.direction,
        accountNumber: input.accountNumber?.trim() || null,
        notes: input.notes?.trim() || null,
        movementId: movement.id,
        createdById: input.userId ?? null,
      },
    });
  });
}

export async function updateSettlement(settlementId: string, input: Omit<SettlementInput, "agencyId" | "issueDate">) {
  const current = await prisma.lotterySettlement.findUniqueOrThrow({ where: { id: settlementId } });
  if (current.voidedAt) throw new FinanceValidationError("El ticket está anulado.");
  const issueDate = current.issueDate.toISOString().slice(0, 10);
  const { amount, bank } = await validate({ ...input, agencyId: current.agencyId, issueDate });
  return prisma.$transaction(async (tx) => {
    const data = movementData(amount, input.direction, input.dueDate, issueDate);
    const movementId = current.movementId
      ? (await tx.fundMovement.update({ where: { id: current.movementId }, data: { ...data, fundId: bank.id } })).id
      : (await tx.fundMovement.create({ data: { ...data, fundId: bank.id, createdById: input.userId ?? null } })).id;
    return tx.lotterySettlement.update({
      where: { id: settlementId },
      data: {
        dueDate: dateValue(input.dueDate),
        amount,
        direction: input.direction,
        accountNumber: input.accountNumber?.trim() || null,
        notes: input.notes?.trim() || null,
        movementId,
      },
    });
  });
}

export async function voidSettlement(settlementId: string) {
  const s = await prisma.lotterySettlement.findUniqueOrThrow({ where: { id: settlementId } });
  if (s.voidedAt) return;
  if (s.movementId) await voidMovement(s.movementId, "Ticket de Lotería anulado");
  await prisma.lotterySettlement.update({ where: { id: settlementId }, data: { voidedAt: new Date() } });
}

/** Store the ticket photo/PDF privately under the agency folder. */
export async function attachTicket(settlementId: string, file: File) {
  if (!file || file.size === 0) return null;
  const ext = IMAGE_TYPES[file.type];
  if (!ext) throw new FinanceValidationError("La foto tiene que ser JPG, PNG, WEBP, HEIC o PDF.");
  if (file.size > MAX_BYTES) throw new FinanceValidationError("La foto pesa más de 8 MB.");
  const s = await prisma.lotterySettlement.findUniqueOrThrow({
    where: { id: settlementId },
    include: { agency: { select: { id: true, licenseNumber: true, province: { select: { code: true } } } } },
  });
  const id = randomBytes(8).toString("hex");
  const key = keys.settlement(s.agency, s.issueDate, id, ext);
  await putFile("private", key, new Uint8Array(await file.arrayBuffer()), file.type);
  await prisma.lotterySettlement.update({ where: { id: settlementId }, data: { ticketKey: key, ticketMime: file.type } });
  return key;
}

export const ticketLink = (key: string) => signedUrl(key, 300);

/** Latest settlements plus weekdays (Mon–Sat) of the last `days` days without a ticket. */
export async function agencySettlements(agencyId: string, days = 14) {
  const today = todayIn(TZ);
  // Only flag days since the agency started using its bank account here.
  const bank = await prisma.agencyFund.findUnique({ where: { settlesAgencyId: agencyId }, select: { openingDate: true } });
  const window = dateValue(today).getTime() - days * 86_400_000;
  const from = new Date(Math.max(window, bank?.openingDate.getTime() ?? window));
  const rows = await prisma.lotterySettlement.findMany({
    where: { agencyId },
    include: { createdBy: { select: { name: true } } },
    orderBy: { issueDate: "desc" },
    take: 60,
  });
  const loaded = new Set(rows.filter((r) => !r.voidedAt).map((r) => r.issueDate.toISOString().slice(0, 10)));
  const missing: string[] = [];
  for (let t = dateValue(today).getTime(); t >= from.getTime(); t -= 86_400_000) {
    const d = new Date(t);
    const iso = d.toISOString().slice(0, 10);
    if (d.getUTCDay() !== 0 && !loaded.has(iso)) missing.push(iso);
  }
  const upcoming = rows.filter((r) => !r.voidedAt && r.dueDate.toISOString().slice(0, 10) > today);
  return { today, rows, missing, upcoming };
}
