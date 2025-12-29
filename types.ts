
export interface VocabularyItem {
  german: string;
  russian: string;
}

export interface ExerciseItem {
  russian: string;
  germanAnswer: string;
}

export interface Lesson {
  id: string;
  number: string;
  vocabulary: VocabularyItem[];
  exercises: ExerciseItem[];
  rawContent: string;
}

export interface Message {
  role: 'tutor' | 'user';
  content: string;
  timestamp: number;
}

export type TutorPhase = 'idle' | 'vocabulary' | 'practice';

export interface TutoringState {
  activeLessonId: string | null;
  phase: TutorPhase;
  currentIndex: number;
  vocabBatch: number[]; // indices of words for the current session
}
