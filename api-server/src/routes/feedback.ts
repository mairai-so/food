import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import { feedbacks } from "../lib/data-store";
import type { Feedback } from "../lib/data-store";

const router: IRouter = Router();

router.post("/feedback", async (req, res): Promise<void> => {
  const body = req.body as {
    restaurantId: string;
    tableId?: string;
    foodRating: number;
    foodComment?: string;
    waiterRating?: number;
    waiterName?: string;
    waiterComment?: string;
    otherComment?: string;
    customerName?: string;
    customerEmail?: string;
    isAnonymous: boolean;
  };

  if (!body.restaurantId || body.foodRating === undefined) {
    res.status(400).json({ error: "restaurantId e foodRating são obrigatórios" });
    return;
  }

  const feedback: Feedback = {
    id: randomUUID(),
    restaurantId: body.restaurantId,
    tableId: body.tableId,
    foodRating: body.foodRating,
    foodComment: body.foodComment,
    waiterRating: body.waiterRating,
    waiterName: body.waiterName,
    waiterComment: body.waiterComment,
    otherComment: body.otherComment,
    customerName: body.isAnonymous ? undefined : body.customerName,
    customerEmail: body.isAnonymous ? undefined : body.customerEmail,
    isAnonymous: body.isAnonymous,
    createdAt: new Date().toISOString(),
  };

  feedbacks.push(feedback);
  res.status(201).json({ id: feedback.id, message: "Feedback enviado com sucesso! Obrigado pela sua opinião." });
});

export default router;
