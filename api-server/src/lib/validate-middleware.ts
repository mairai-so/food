/**
 * validate-middleware.ts
 *
 * Middleware para validação automática de entrada em rotas Express.
 * Uso:
 *   router.post("/items", validateBody(CreateItemSchema), requireAuth, (req, res) => {
 *     const data = req.validated; // Dados já validados e tipados
 *   });
 */

import type { Request, Response, NextFunction } from "express";
import type { z } from "zod";
import { formatValidationError } from "./validation-schemas.js";

/**
 * Tipo para estender Request com dados validados
 */
declare global {
  namespace Express {
    interface Request {
      /** Dados validados do corpo da request */
      validated?: any;
      /** Dados validados dos query params */
      validatedQuery?: any;
      /** Dados validados dos path params */
      validatedParams?: any;
    }
  }
}

/**
 * Middleware para validar req.body contra um schema Zod
 *
 * @example
 * router.post("/users", validateBody(CreateUserSchema), (req, res) => {
 *   const user = req.validated; // Tipado como CreateUserBody
 * });
 */
export function validateBody<T extends z.ZodSchema>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const error = formatValidationError(result.error);
      res.status(400).json({
        error: "Validação de entrada falhou",
        details: error,
        code: "INVALID_INPUT",
      });
      return;
    }

    req.validated = result.data;
    next();
  };
}

/**
 * Middleware para validar req.query contra um schema Zod
 *
 * @example
 * router.get("/users", validateQuery(PaginationQuerySchema), (req, res) => {
 *   const { limit, offset } = req.validatedQuery;
 * });
 */
export function validateQuery<T extends z.ZodSchema>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      const error = formatValidationError(result.error);
      res.status(400).json({
        error: "Query params inválidos",
        details: error,
        code: "INVALID_QUERY",
      });
      return;
    }

    req.validatedQuery = result.data;
    next();
  };
}

/**
 * Middleware para validar req.params contra um schema Zod
 *
 * @example
 * router.get("/users/:id", validateParams(IDParamSchema), (req, res) => {
 *   const { id } = req.validatedParams;
 * });
 */
export function validateParams<T extends z.ZodSchema>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);

    if (!result.success) {
      const error = formatValidationError(result.error);
      res.status(400).json({
        error: "Parâmetros de rota inválidos",
        details: error,
        code: "INVALID_PARAMS",
      });
      return;
    }

    req.validatedParams = result.data;
    next();
  };
}

/**
 * Middleware para validar múltiplas fontes (body, query, params)
 *
 * @example
 * router.post(
 *   "/users/:id/items",
 *   validateRequest({
 *     body: CreateItemSchema,
 *     params: IDParamSchema,
 *     query: PaginationQuerySchema,
 *   }),
 *   (req, res) => {
 *     const body = req.validated;
 *     const params = req.validatedParams;
 *     const query = req.validatedQuery;
 *   }
 * );
 */
export function validateRequest(schemas: {
  body?: z.ZodSchema;
  query?: z.ZodSchema;
  params?: z.ZodSchema;
}) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: Record<string, string> = {};

    // Validar body
    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (!result.success) {
        errors.body = formatValidationError(result.error);
      } else {
        req.validated = result.data;
      }
    }

    // Validar query
    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) {
        errors.query = formatValidationError(result.error);
      } else {
        req.validatedQuery = result.data;
      }
    }

    // Validar params
    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) {
        errors.params = formatValidationError(result.error);
      } else {
        req.validatedParams = result.data;
      }
    }

    if (Object.keys(errors).length > 0) {
      res.status(400).json({
        error: "Validação de entrada falhou",
        details: errors,
        code: "INVALID_REQUEST",
      });
      return;
    }

    next();
  };
}
