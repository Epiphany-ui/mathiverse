// src/lib/ai/types.ts

export interface ManimExample {
  id: string;
  title: string;
  description: string;
  code: string;
  tags: string[];
  difficulty: number;
  source?: string;
  similarity?: number;
}

export interface VerifiedManimExample extends ManimExample {
  dimension: "2d" | "3d" | "formula" | "mixed";
  manimVersion: string;
  renderVerified: boolean;
  renderHash: string | null;
}

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  dimensions: number;
}
