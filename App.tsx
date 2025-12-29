
import React, { useState, useEffect, useRef } from 'react';
import { Lesson, Message, TutoringState, TutorPhase } from './types';
import { parseLessonText } from './services/parser';
import { TutorAIService } from './services/gemini';

const App: React.FC = () => {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [tutorState, setTutorState] = useState<TutoringState>({
    activeLessonId: null,
    phase: 'idle',
    currentIndex: 0,
    vocabBatch: []
  });
  const [isInputOpen, setIsInputOpen] = useState(false);
  const [rawInput, setRawInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const tutorAI = useRef(new TutorAIService());

  useEffect(() => {
    const saved = localStorage.getItem('deutsch_lessons');
    if (saved) setLessons(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem('deutsch_lessons', JSON.stringify(lessons));
  }, [lessons]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addLesson = () => {
    const parsed = parseLessonText(rawInput);
    if (parsed) {
      setLessons(prev => [...prev, parsed]);
      setRawInput('');
      setIsInputOpen(false);
    } else {
      alert('Ошибка формата! Убедитесь, что заголовки Лексика:, Упражнения: и Ответы: присутствуют.');
    }
  };

  const startLesson = (lesson: Lesson) => {
    setActiveLesson(lesson);
    const vocabIndices = Array.from({ length: lesson.vocabulary.length }, (_, i) => i)
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.min(8, lesson.vocabulary.length));

    setTutorState({
      activeLessonId: lesson.id,
      phase: 'vocabulary',
      currentIndex: 0,
      vocabBatch: vocabIndices
    });

    const firstWord = lesson.vocabulary[vocabIndices[0]];
    setMessages([{
      role: 'tutor',
      content: `Guten Tag! Начнем работу над Уроком ${lesson.number}. 
      Сначала проверим слова. Как переводится на немецкий: "${firstWord.russian}"?`,
      timestamp: Date.now()
    }]);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !activeLesson || isLoading) return;

    const userMsg = inputValue.trim();
    setInputValue('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg, timestamp: Date.now() }]);
    setIsLoading(true);

    try {
      let expected = '';
      let context = '';

      if (tutorState.phase === 'vocabulary') {
        const word = activeLesson.vocabulary[tutorState.vocabBatch[tutorState.currentIndex]];
        expected = word.german;
        context = `Проверка слова: ${word.russian} -> ${word.german}`;
      } else {
        const exercise = activeLesson.exercises[tutorState.currentIndex];
        expected = exercise.germanAnswer;
        context = `Перевод предложения: ${exercise.russian} -> ${exercise.germanAnswer}`;
      }

      const feedback = await tutorAI.current.getFeedback(userMsg, expected, context, messages);
      
      setMessages(prev => [...prev, { role: 'tutor', content: feedback, timestamp: Date.now() }]);

      // Simple heuristic: if the feedback doesn't ask for a retry, move forward
      // In a real app, we might check for keywords or use JSON from Gemini
      const isIncorrect = feedback.toLowerCase().includes('напишите правильно') || 
                          feedback.toLowerCase().includes('ошибка');

      if (!isIncorrect) {
        advanceStep();
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'tutor', content: 'Извините, произошла техническая ошибка. Попробуйте еще раз.', timestamp: Date.now() }]);
    } finally {
      setIsLoading(false);
    }
  };

  const advanceStep = () => {
    setTutorState(prev => {
      const isVocab = prev.phase === 'vocabulary';
      const max = isVocab ? prev.vocabBatch.length : (activeLesson?.exercises.length || 0);
      
      if (prev.currentIndex + 1 < max) {
        const nextIdx = prev.currentIndex + 1;
        const nextPrompt = isVocab 
          ? `Следующее слово: "${activeLesson!.vocabulary[prev.vocabBatch[nextIdx]].russian}"`
          : `Переведите предложение: "${activeLesson!.exercises[nextIdx].russian}"`;
        
        setTimeout(() => {
          setMessages(m => [...m, { role: 'tutor', content: nextPrompt, timestamp: Date.now() }]);
        }, 1000);

        return { ...prev, currentIndex: nextIdx };
      } else if (isVocab) {
        // Transition to Exercises
        setTimeout(() => {
          setMessages(m => [...m, { 
            role: 'tutor', 
            content: `Отлично! Со словами закончили. Теперь перейдем к упражнениям.\nПереведите: "${activeLesson!.exercises[0].russian}"`, 
            timestamp: Date.now() 
          }]);
        }, 1000);
        return { ...prev, phase: 'practice', currentIndex: 0 };
      } else {
        // Finish lesson
        setTimeout(() => {
          setMessages(m => [...m, { role: 'tutor', content: `Поздравляю! Мы закончили Урок ${activeLesson?.number}. Вы отлично поработали.`, timestamp: Date.now() }]);
        }, 1000);
        return { ...prev, phase: 'idle' };
      }
    });
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-900">
      {/* Sidebar */}
      <aside className="w-72 bg-white border-r border-slate-200 flex flex-col shadow-sm">
        <div className="p-6 border-b border-slate-100 bg-indigo-600 text-white">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <span className="text-2xl">🇩🇪</span> DeutschLehrer AI
          </h1>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <button 
            onClick={() => setIsInputOpen(true)}
            className="w-full py-2 px-4 bg-emerald-50 text-emerald-700 rounded-lg font-semibold hover:bg-emerald-100 transition-colors border border-emerald-100 flex items-center justify-center gap-2 mb-4"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
            Добавить Урок
          </button>

          <h3 className="px-2 text-xs font-bold text-slate-400 uppercase tracking-widest mt-6 mb-2">Загруженные уроки</h3>
          {lessons.map(l => (
            <button 
              key={l.id}
              onClick={() => startLesson(l)}
              className={`w-full text-left p-3 rounded-lg transition-all ${activeLesson?.id === l.id ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm' : 'hover:bg-slate-50 text-slate-600'}`}
            >
              <div className="font-bold">Урок {l.number}</div>
              <div className="text-xs opacity-70">{l.vocabulary.length} слов, {l.exercises.length} предл.</div>
            </button>
          ))}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative">
        {!activeLesson ? (
          <div className="flex-1 flex flex-center flex-col items-center justify-center p-12 text-center">
            <div className="w-24 h-24 bg-indigo-100 text-indigo-500 rounded-full flex items-center justify-center mb-6">
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-800">Добро пожаловать в DeutschLehrer!</h2>
            <p className="text-slate-500 mt-2 max-w-md">Выберите урок слева или добавьте новый, чтобы начать интерактивное обучение с ИИ-репетитором.</p>
          </div>
        ) : (
          <>
            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'tutor' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[80%] p-4 rounded-2xl shadow-sm ${
                    m.role === 'tutor' 
                    ? 'bg-white border border-slate-200 text-slate-800 rounded-tl-none' 
                    : 'bg-indigo-600 text-white rounded-tr-none'
                  }`}>
                    <div className="text-sm whitespace-pre-wrap">{m.content}</div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-slate-200 p-4 rounded-2xl flex gap-1">
                    <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce"></span>
                    <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce [animation-delay:-.15s]"></span>
                    <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce [animation-delay:-.3s]"></span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input Bar */}
            <div className="p-4 bg-white border-t border-slate-200">
              <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex gap-3">
                <input 
                  type="text" 
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Ваш ответ..."
                  className="flex-1 p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                />
                <button 
                  type="submit" 
                  disabled={isLoading || !inputValue.trim()}
                  className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center gap-2"
                >
                  Отправить
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                </button>
              </form>
            </div>
          </>
        )}

        {/* Lesson Input Modal */}
        {isInputOpen && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col h-[80vh]">
              <div className="p-6 bg-slate-50 border-b flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold">Добавить новый урок</h2>
                  <p className="text-sm text-slate-500">Вставьте текст урока в структурированном формате</p>
                </div>
                <button onClick={() => setIsInputOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="flex-1 p-6 flex flex-col gap-4 overflow-hidden">
                <textarea 
                  className="flex-1 p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm resize-none"
                  placeholder="Урок 1:
Лексика:
schlafen - спать
...
Упражнения:
1. Я сплю.
...
Ответы:
1. Ich schlafe."
                  value={rawInput}
                  onChange={(e) => setRawInput(e.target.value)}
                />
              </div>
              <div className="p-6 border-t bg-slate-50 flex gap-3 justify-end">
                <button onClick={() => setIsInputOpen(false)} className="px-6 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded-xl transition-colors">Отмена</button>
                <button onClick={addLesson} className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all">Сохранить урок</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
