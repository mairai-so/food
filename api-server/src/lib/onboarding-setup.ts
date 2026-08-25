export type SetupBlueprintModule = "orders" | "tables" | "cashier" | "delivery" | "stock" | "marketing";

export interface SetupBlueprintInput {
  segmentId?: string;
  businessModel?: string;
  modules?: SetupBlueprintModule[];
  features?: Array<{ id: string; value?: string | boolean | null }>;
}

export interface SetupBlueprintSummary {
  status: "configured" | "partial";
  requiredSteps: string[];
}

export interface SetupBlueprint {
  segmentId: string;
  businessModel: string;
  modules: SetupBlueprintModule[];
  features: Array<{ id: string; value: string | null }>;
  summary: SetupBlueprintSummary;
}

export function buildInitialSetupBlueprint(input: SetupBlueprintInput): SetupBlueprint {
  const normalizedModules = Array.from(new Set((input.modules ?? ["orders", "tables", "cashier"]).filter(Boolean)));
  const features = (input.features ?? []).map((feature) => ({
    id: String(feature.id ?? ""),
    value: feature.value === undefined || feature.value === null || feature.value === "" ? null : String(feature.value),
  }));

  const requiredSteps = [
    "Cadastrar produtos",
    "Definir preços",
    "Configurar equipe",
    "Ativar operação mínima",
  ];

  return {
    segmentId: input.segmentId ?? "restaurant",
    businessModel: input.businessModel ?? "salon",
    modules: normalizedModules as SetupBlueprintModule[],
    features,
    summary: {
      status: "configured",
      requiredSteps,
    },
  };
}
