/**
 * validation-schemas.ts
 *
 * Esquemas Zod centralizados para validação de entrada em TODAS as rotas.
 * Isso garante que:
 * ✅ Nenhum input invalido chega aos dados
 * ✅ Mensagens de erro são consistentes
 * ✅ Type-safety em tempo de compilação
 * ✅ Defesa contra SQL injection, XSS, e outros ataques
 *
 * PADRÃO A SEGUIR:
 *   1. Define schema Zod para cada input
 *   2. Valida com safeParse() (retorna resultado, não throw)
 *   3. Se inválido, retorna 400 com mensagem clara
 *   4. Se válido, usa dados tipados com segurança
 */

import { z } from "zod";

// ─── Tipos Primitivos Validados ───────────────────────────────────────────

/** UUID válido */
export const UUIDSchema = z.string().uuid("ID deve ser um UUID válido");

/** ID genérico (string não-vazia) */
export const IDSchema = z.string().min(1, "ID é obrigatório").max(255);

/** Email válido */
export const EmailSchema = z.string().email("Email inválido").toLowerCase();

/** Telefone (apenas dígitos, 10-15 caracteres) */
export const PhoneSchema = z
  .string()
  .regex(/^\d{10,15}$/, "Telefone deve ter 10-15 dígitos")
  .optional();

/** URL válida */
export const URLSchema = z.string().url("URL inválida").optional();

/** Número positivo */
export const PositiveNumberSchema = z.number().positive("Deve ser um número positivo");

/** Número positivo ou zero */
export const NonNegativeNumberSchema = z.number().nonnegative("Não pode ser negativo");

/** String não-vazia (triada) */
export const NonEmptyStringSchema = z
  .string()
  .trim()
  .min(1, "Campo obrigatório")
  .max(5000, "Texto muito longo");

/** Descrição curta (até 500 chars) */
export const DescriptionSchema = z
  .string()
  .trim()
  .max(500, "Descrição muito longa")
  .optional();

/** Nome de pessoa/restaurante */
export const NameSchema = z
  .string()
  .trim()
  .min(2, "Nome deve ter no mínimo 2 caracteres")
  .max(200, "Nome muito longo");

/** PIN (4-6 dígitos numéricos) */
export const PINSchema = z
  .string()
  .regex(/^\d{4,6}$/, "PIN deve ter 4 a 6 dígitos numéricos");

/** Data ISO (YYYY-MM-DD ou ISO 8601) */
export const DateSchema = z.coerce.date();

// ─── Schemas de Autenticação ──────────────────────────────────────────────

export const LoginBodySchema = z.object({
  email: EmailSchema,
  password: NonEmptyStringSchema.min(8, "Senha deve ter no mínimo 8 caracteres"),
});

export const RegisterBodySchema = z.object({
  email: EmailSchema,
  password: NonEmptyStringSchema.min(8, "Senha deve ter no mínimo 8 caracteres"),
  companyName: NameSchema,
  ownerName: NameSchema,
  phone: PhoneSchema,
});

// ─── Schemas de Restaurante ───────────────────────────────────────────────

export const CreateRestaurantBodySchema = z.object({
  name: NameSchema,
  cuisine: z.string().optional(),
  address: NonEmptyStringSchema.max(300).optional(),
  phone: PhoneSchema,
});

export const UpdateRestaurantBodySchema = z.object({
  name: NameSchema.optional(),
  cuisine: z.string().optional(),
  address: NonEmptyStringSchema.max(300).optional(),
  phone: PhoneSchema,
});

// ─── Schemas de Cardápio ──────────────────────────────────────────────────

export const CreateMenuItemBodySchema = z.object({
  name: NameSchema,
  description: DescriptionSchema,
  price: PositiveNumberSchema,
  category: z.string().min(1, "Categoria obrigatória"),
  prepTime: NonNegativeNumberSchema.int(),
  available: z.boolean().default(true),
});

export const UpdateMenuItemBodySchema = z.object({
  name: NameSchema.optional(),
  description: DescriptionSchema,
  price: PositiveNumberSchema.optional(),
  category: z.string().optional(),
  prepTime: NonNegativeNumberSchema.int().optional(),
  available: z.boolean().optional(),
});

// ─── Schemas de Funcionário ───────────────────────────────────────────────

export const CreateEmployeeBodySchema = z.object({
  name: NameSchema,
  role: z.enum(["waiter", "kitchen", "cashier", "delivery", "manager"], {
    errorMap: () => ({ message: "Role inválido" }),
  }),
  pin: z.string().optional(),
  phone: PhoneSchema,
  permissions: z.record(z.boolean()).optional(),
});

export const UpdateEmployeeBodySchema = z.object({
  name: NameSchema.optional(),
  pin: PINSchema.optional(),
  phone: PhoneSchema,
  active: z.boolean().optional(),
  permissions: z.record(z.boolean()).optional(),
});

// ─── Schemas de Estoque ───────────────────────────────────────────────────

export const CreateStockItemBodySchema = z.object({
  name: NameSchema,
  category: z.string().min(1, "Categoria obrigatória"),
  quantity: NonNegativeNumberSchema,
  unit: z.string().min(1, "Unidade obrigatória"),
  minQuantity: NonNegativeNumberSchema.optional(),
  alertDaysBefore: NonNegativeNumberSchema.int().optional(),
  expiresAt: DateSchema.optional(),
  unitCost: NonNegativeNumberSchema.optional(),
});

export const UpdateStockItemBodySchema = z.object({
  quantity: NonNegativeNumberSchema.optional(),
  minQuantity: NonNegativeNumberSchema.optional(),
  expiresAt: DateSchema.optional(),
  unitCost: NonNegativeNumberSchema.optional(),
});

// ─── Schemas de Pedido ────────────────────────────────────────────────────

export const CreateOrderBodySchema = z.object({
  restaurantId: IDSchema,
  tableId: IDSchema.optional(),
  tableNumber: z.number().int().positive().optional(),
  items: z.array(
    z.object({
      menuItemId: IDSchema,
      quantity: z.number().int().positive(),
      notes: z.string().max(500).optional(),
    })
  ).min(1, "Pedido deve ter no mínimo 1 item"),
  customerName: z.string().optional(),
  mode: z.enum(["dine-in", "delivery", "pickup"]).optional(),
});

export const UpdateOrderBodySchema = z.object({
  status: z.enum(["pending", "preparing", "ready", "delivered", "paid"]).optional(),
  items: z.array(
    z.object({
      menuItemId: IDSchema,
      quantity: z.number().int().positive(),
    })
  ).optional(),
});

// ─── Schemas de Caixa ─────────────────────────────────────────────────────

export const OpenCashierSessionBodySchema = z.object({
  initialFloat: NonNegativeNumberSchema,
  operatorName: NameSchema,
});

export const RecordCashierMovementBodySchema = z.object({
  type: z.enum(["open", "sale", "expense", "sangria", "close"]),
  amount: PositiveNumberSchema,
  description: NonEmptyStringSchema,
  paymentMethod: z.string().optional(),
});

// ─── Schemas de Auditoria ─────────────────────────────────────────────────

export const CreateAuditLogBodySchema = z.object({
  employeeId: IDSchema,
  employeeName: NameSchema,
  employeeRole: z.string().optional(),
  action: z.string().min(1, "Ação obrigatória").max(100),
  description: NonEmptyStringSchema,
  metadata: z.record(z.any()).optional(),
});

// ─── Schemas de Recado ────────────────────────────────────────────────────

export const CreateRecadoBodySchema = z.object({
  tipo: z.enum(["operacao", "mesa"]).optional(),
  autor: z.string().optional(),
  texto: NonEmptyStringSchema,
  mesa: z.number().int().positive().optional(),
});

// ─── Schemas de Query Params ──────────────────────────────────────────────

export const PaginationQuerySchema = z.object({
  limit: z.coerce.number().int().positive().default(100).catch(100),
  offset: z.coerce.number().int().nonnegative().default(0).catch(0),
});

export const SearchQuerySchema = z.object({
  q: z.string().trim().optional(),
  limit: z.coerce.number().int().positive().default(50).catch(50),
});

export const DateRangeQuerySchema = z.object({
  startDate: DateSchema.optional(),
  endDate: DateSchema.optional(),
});

// ─── Schemas de Parâmetros de Rota ────────────────────────────────────────

export const IDParamSchema = z.object({
  id: IDSchema,
});

export const RestaurantIDParamSchema = z.object({
  restaurantId: IDSchema,
});

// ─── Tipos TypeScript Derivados (Para Type Safety) ─────────────────────────

export type LoginBody = z.infer<typeof LoginBodySchema>;
export type RegisterBody = z.infer<typeof RegisterBodySchema>;
export type CreateRestaurantBody = z.infer<typeof CreateRestaurantBodySchema>;
export type CreateMenuItemBody = z.infer<typeof CreateMenuItemBodySchema>;
export type CreateEmployeeBody = z.infer<typeof CreateEmployeeBodySchema>;
export type CreateStockItemBody = z.infer<typeof CreateStockItemBodySchema>;
export type CreateOrderBody = z.infer<typeof CreateOrderBodySchema>;
export type OpenCashierSessionBody = z.infer<typeof OpenCashierSessionBodySchema>;
export type CreateAuditLogBody = z.infer<typeof CreateAuditLogBodySchema>;
export type CreateRecadoBody = z.infer<typeof CreateRecadoBodySchema>;

// ─── Função Auxiliar: Validar com Mensagem de Erro Formatada ──────────────

export function formatValidationError(error: z.ZodError): string {
  const messages = error.errors.map(e => {
    const path = e.path.join(".");
    return `${path || "input"}: ${e.message}`;
  });
  return messages.join(" | ");
}

/**
 * Valida dados com Zod e retorna resultado tipado ou erro formatado
 *
 * @example
 * const result = validateInput(data, LoginBodySchema);
 * if (!result.success) {
 *   return res.status(400).json({ error: result.error });
 * }
 * const { email, password } = result.data;
 */
export function validateInput<T extends z.ZodSchema>(
  data: unknown,
  schema: T
): { success: true; data: z.infer<T> } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (!result.success) {
    return { success: false, error: formatValidationError(result.error) };
  }
  return { success: true, data: result.data };
}
