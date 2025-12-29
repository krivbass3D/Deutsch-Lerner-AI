
import { Lesson, VocabularyItem, ExerciseItem } from '../types';

export function parseLessonText(text: string): Lesson | null {
  try {
    const lessonMatch = text.match(/Урок\s+(\d+|[A-Z\d-]+):/i);
    const lessonNumber = lessonMatch ? lessonMatch[1] : 'Unknown';

    const lexSection = text.match(/Лексика:([\s\S]*?)(?=Упражнения:|$)/i);
    const exeSection = text.match(/Упражнения:([\s\S]*?)(?=Ответы:|$)/i);
    const ansSection = text.match(/Ответы:([\s\S]*?)$/i);

    if (!lexSection || !exeSection || !ansSection) return null;

    const vocabulary: VocabularyItem[] = lexSection[1]
      .trim()
      .split('\n')
      .filter(line => line.includes('-'))
      .map(line => {
        const [ger, rus] = line.split('-').map(s => s.trim());
        return { german: ger, russian: rus };
      });

    const exercisesRaw = exeSection[1].trim().split('\n').filter(l => l.trim());
    const answersRaw = ansSection[1].trim().split('\n').filter(l => l.trim());

    const exercises: ExerciseItem[] = exercisesRaw.map((rus, idx) => {
      // Basic attempt to strip numbers like "1. ", "2) "
      const cleanRus = rus.replace(/^\d+[\s.)-]+\s*/, '').trim();
      const cleanGer = (answersRaw[idx] || '').replace(/^\d+[\s.)-]+\s*/, '').trim();
      return { russian: cleanRus, germanAnswer: cleanGer };
    });

    return {
      id: crypto.randomUUID(),
      number: lessonNumber,
      vocabulary,
      exercises,
      rawContent: text
    };
  } catch (e) {
    console.error('Parsing failed', e);
    return null;
  }
}
