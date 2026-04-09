import axios from 'axios';
import { PredictionInput, PredictionResult, HistoryRecord } from '@/types';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000',
});

export async function predict(input: PredictionInput): Promise<PredictionResult> {
  const { data } = await api.post<PredictionResult>('/predict', input);
  return data;
}

export async function getHistory(): Promise<HistoryRecord[]> {
  const { data } = await api.get<HistoryRecord[]>('/history');
  return data;
}
