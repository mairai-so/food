export function ensureSelf(req: any, res: any): boolean {
  const authenticatedClientId = req.clientId as string;
  const { userId } = req.params;

  if (authenticatedClientId !== userId) {
    res.status(403).json({ error: "Você só pode acessar os próprios dados" });
    return false;
  }

  return true;
}
