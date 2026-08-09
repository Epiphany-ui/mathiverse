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

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  dimensions: number;
}
