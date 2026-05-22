export type ProductionFormat = "short" | "reel" | "story" | "landscape";

export type ProductionRequest = {
  projectId: string;
  prompt: string;
  format: ProductionFormat;
  assets: string[];
};

export type ProductionStage = {
  queue: "generation" | "rendering" | "delivery";
  name: string;
};

export type ProductionPlan = {
  projectId: string;
  stages: ProductionStage[];
  createdAt: string;
};

