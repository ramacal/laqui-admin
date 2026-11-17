// Customers (spec: agency-finances / order-and-receipts).
// A Customer is a person once for the whole platform, identified by their Argentine cellphone
// (or DNI). An AgencyCustomer is that person in one agency, with the alias the agency knows
// them by. Adding a known person to another agency only fills in what was missing; editing
// the person's data (name, cellphone, DNI) changes it for every agency.
import { FinanceValidationError } from "@/lib/finance";
import { PhoneError, optionalCellphone, optionalDni } from "@/lib/phone";
import { prisma } from "@/lib/prisma";

export type CustomerInput = {
  firstName: string;
  lastName?: string | null;
  alias?: string | null; // defaults to the first name
  phone?: string | null;
  dni?: string | null;
  notes?: string | null;
};

function clean(input: CustomerInput) {
  const firstName = input.firstName.trim();
  if (firstName.length < 2) throw new FinanceValidationError("Poné el nombre del cliente.");
  try {
    return {
      firstName,
      lastName: input.lastName?.trim() || null,
      alias: input.alias?.trim() || firstName,
      cellphoneNumber: optionalCellphone(input.phone),
      dni: optionalDni(input.dni),
      notes: input.notes?.trim() || null,
    };
  } catch (err) {
    if (err instanceof PhoneError) throw new FinanceValidationError(err.message);
    throw err;
  }
}

/** The person with this cellphone or DNI, if known. Both pointing to different people is an error. */
async function findPerson(cellphoneNumber: string | null, dni: string | null) {
  const byPhone = cellphoneNumber ? await prisma.customer.findUnique({ where: { cellphoneNumber } }) : null;
  const byDni = dni ? await prisma.customer.findUnique({ where: { dni } }) : null;
  if (byPhone && byDni && byPhone.id !== byDni.id)
    throw new FinanceValidationError("Ese celular y ese DNI son de dos personas distintas: revisalos.");
  return byPhone ?? byDni;
}

/** Add a customer to an agency, reusing the person if their cellphone or DNI is already known. */
export async function addAgencyCustomer(agencyId: string, input: CustomerInput) {
  const data = clean(input);
  let person = await findPerson(data.cellphoneNumber, data.dni);
  if (person) {
    const existing = await prisma.agencyCustomer.findUnique({ where: { agencyId_customerId: { agencyId, customerId: person.id } } });
    if (existing) throw new FinanceValidationError(`Ya es cliente de la agencia como «${existing.alias}».`);
    person = await prisma.customer.update({
      where: { id: person.id },
      data: {
        lastName: person.lastName ?? data.lastName,
        cellphoneNumber: person.cellphoneNumber ?? data.cellphoneNumber,
        dni: person.dni ?? data.dni,
      },
    });
  } else {
    person = await prisma.customer.create({
      data: { firstName: data.firstName, lastName: data.lastName, cellphoneNumber: data.cellphoneNumber, dni: data.dni },
    });
  }
  return prisma.agencyCustomer.create({
    data: { agencyId, customerId: person.id, alias: data.alias, notes: data.notes },
    include: { customer: true },
  });
}

/** Edit an agency customer: the alias and notes are the agency's; the person's data is shared. */
export async function updateAgencyCustomer(agencyCustomerId: string, input: CustomerInput) {
  const data = clean(input);
  const current = await prisma.agencyCustomer.findUniqueOrThrow({ where: { id: agencyCustomerId } });
  const other = await findPerson(data.cellphoneNumber, data.dni);
  if (other && other.id !== current.customerId)
    throw new FinanceValidationError("Ese celular o DNI ya es de otra persona.");
  await prisma.customer.update({
    where: { id: current.customerId },
    data: { firstName: data.firstName, lastName: data.lastName, cellphoneNumber: data.cellphoneNumber, dni: data.dni },
  });
  return prisma.agencyCustomer.update({ where: { id: agencyCustomerId }, data: { alias: data.alias, notes: data.notes } });
}

/** "Juan Pérez" from a person. */
export const fullName = (c: { firstName: string; lastName: string | null }) => [c.firstName, c.lastName].filter(Boolean).join(" ");
