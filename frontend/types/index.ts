export interface PredictionInput {
  age: number;
  sex: number;
  'chest pain type': number;
  'resting blood pressure': number;
  'serum cholestoral in mg/dl': number;
  'fasting blood sugar > 120 mg/dl': number;
  'resting electrocardiographic results': number;
  'maximum heart rate achieved': number;
  'exercise induced angina': number;
  'oldpeak = ST depression induced by exercise relative to rest': number;
  'the slope of the peak exercise ST segment': number;
  'number of major vessels (0-3) colored by flourosopy': number;
  thal: number;
}

export interface PredictionResult {
  prediction: 0 | 1;
  probability: number;
}

export interface HistoryRecord {
  input: PredictionInput;
  prediction: 0 | 1;
  probability: number;
  timestamp: string;
}
