import axios from 'axios';
import { PredictionInput, PredictionResult, HistoryRecord } from '@/types';

// In Docker: Next.js rewrites /api/* → http://backend:5001/*
// Locally:   Next.js rewrites /api/* → http://localhost:5001/*
const api = axios.create({ baseURL: '/api' });

export async function predict(input: PredictionInput): Promise<PredictionResult> {
  const { data } = await api.post<PredictionResult>('/predict', input);
  return data;
}

export async function getHistory(): Promise<HistoryRecord[]> {
  const { data } = await api.get<HistoryRecord[]>('/history');
  return data;
}
