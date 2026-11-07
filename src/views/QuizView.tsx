import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BrainCircuit,
  Trophy,
  Plus,
  Trash2,
  X,
  Clock,
  Play,
  CheckCircle2,
  Lock,
  ListChecks,
  Eye,
  EyeOff,
  Sparkles,
  ChevronRight,
  RotateCcw,
  User
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Membre, Quiz, QuizAnswer, QuizDifficulty, QuizQuestion, QuizResult } from '../types';
import { StorageService } from '../utils/storage';
import { canCreateQuiz } from '../utils/permissions';
import { useLanguage } from '../i18n';

interface QuizViewProps {
  currentUser: Membre;
  allMembres: Membre[];
  quizzes: Quiz[];
  results: QuizResult[];
  onRefreshQuizzes: () => void;
  onRefreshResults: () => void;
}

interface DraftQuestion {
  id: string;
  question: string;
  options: string[];
  correct_index: number;
}

const MIN_QUESTIONS = 10;
const MAX_QUESTIONS = 20;
const OPTION_LABELS = ['A', 'B', 'C', 'D'];

const RECOMMENDED_QUESTIONS: Record<QuizDifficulty, number> = {
  facile: 10,
  moyen: 15,
  difficile: 20
};

const DIFFICULTY_STYLES: Record<QuizDifficulty, { color: string; background: string }> = {
  facile: { color: '#34d399', background: 'rgba(16, 185, 129, 0.15)' },
  moyen: { color: '#fbbf24', background: 'rgba(245, 158, 11, 0.15)' },
  difficile: { color: '#f87171', background: 'rgba(239, 68, 68, 0.15)' }
};

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function createDraftQuestions(count: number): DraftQuestion[] {
  return Array.from({ length: count }, () => ({
    id: makeId('qq'),
    question: '',
    options: ['', '', '', ''],
    correct_index: 0
  }));
}

function formatTime(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export const QuizView: React.FC<QuizViewProps> = ({
  currentUser,
  allMembres,
  quizzes,
  results,
  onRefreshQuizzes,
  onRefreshResults
}) => {
  const { t } = useLanguage();
  const canCreate = canCreateQuiz(currentUser);

  const [tab, setTab] = useState<'play' | 'ranking'>('play');

  // Création / gestion
  const [createOpen, setCreateOpen] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formDifficulty, setFormDifficulty] = useState<QuizDifficulty>('facile');
  const [formDuration, setFormDuration] = useState(120);
  const [formPublished, setFormPublished] = useState(true);
  const [draftQuestions, setDraftQuestions] = useState<DraftQuestion[]>(() => createDraftQuestions(MIN_QUESTIONS));

  // Partie en cours
  const [playingQuiz, setPlayingQuiz] = useState<Quiz | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [finishedResult, setFinishedResult] = useState<QuizResult | null>(null);
  const [showReview, setShowReview] = useState(true);

  const playingQuizRef = useRef<Quiz | null>(null);
  const answersRef = useRef<(number | null)[]>([]);
  const startedAtRef = useRef<number>(0);
  const submittedRef = useRef(false);
  const finishRef = useRef<() => void>(() => {});

  const [rankingQuizId, setRankingQuizId] = useState<string>('');

  const visibleQuizzes = useMemo(
    () => quizzes.filter((quiz) => quiz.is_published || canCreate),
    [quizzes, canCreate]
  );

  const quizById = useMemo(
    () => new Map(visibleQuizzes.map((quiz) => [quiz.id, quiz])),
    [visibleQuizzes]
  );

  const getMember = (id: string): Membre | undefined => allMembres.find((membre) => membre.id === id);

  const memberName = (id: string): string => {
    const membre = getMember(id);
    return membre ? `${membre.prenom} ${membre.nom}`.trim() : t('common.member');
  };

  const getMyResult = (quizId: string): QuizResult | undefined =>
    results.find((result) => result.quiz_id === quizId && result.membre_id === currentUser.id);

  const quizResults = useCallback(
    (quizId: string): QuizResult[] =>
      results
        .filter((result) => result.quiz_id === quizId)
        .slice()
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          if (a.duree_utilisee !== b.duree_utilisee) return a.duree_utilisee - b.duree_utilisee;
          return new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime();
        }),
    [results]
  );

  const globalRanking = useMemo(() => {
    const allowedQuizIds = new Set(visibleQuizzes.map((quiz) => quiz.id));
    const totals = new Map<string, { points: number; completed: number; last: number }>();
    results.forEach((result) => {
      if (!allowedQuizIds.has(result.quiz_id)) return;
      const entry = totals.get(result.membre_id) || { points: 0, completed: 0, last: 0 };
      entry.points += result.score;
      entry.completed += 1;
      entry.last = Math.max(entry.last, new Date(result.completed_at).getTime());
      totals.set(result.membre_id, entry);
    });
    return [...totals.entries()]
      .filter(([membreId]) => Boolean(getMember(membreId)))
      .map(([membreId, entry]) => ({ membreId, ...entry }))
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.completed !== a.completed) return b.completed - a.completed;
        if (b.last !== a.last) return b.last - a.last;
        return memberName(a.membreId).localeCompare(memberName(b.membreId));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, visibleQuizzes, allMembres]);

  const selectedRankingQuiz = quizById.get(rankingQuizId) || visibleQuizzes[0];

  useEffect(() => {
    if (selectedRankingQuiz && rankingQuizId !== selectedRankingQuiz.id) {
      setRankingQuizId(selectedRankingQuiz.id);
    }
  }, [selectedRankingQuiz, rankingQuizId]);

  const finishQuiz = useCallback(() => {
    const quiz = playingQuizRef.current;
    if (!quiz || submittedRef.current) return;
    submittedRef.current = true;

    const selected = answersRef.current;
    const detailedAnswers: QuizAnswer[] = quiz.questions.map((question, index) => {
      const selectedIndex = selected[index] ?? null;
      return {
        question_id: question.id,
        selected_index: selectedIndex,
        is_correct: selectedIndex === question.correct_index
      };
    });
    const score = detailedAnswers.filter((answer) => answer.is_correct).length;
    const duration = Math.min(
      quiz.duree_secondes,
      Math.max(0, Math.round((Date.now() - startedAtRef.current) / 1000))
    );

    const saved = StorageService.addQuizResult({
      quiz_id: quiz.id,
      membre_id: currentUser.id,
      score,
      total: quiz.questions.length,
      duree_utilisee: duration,
      answers: detailedAnswers
    });

    playingQuizRef.current = null;
    setPlayingQuiz(null);
    setFinishedResult(saved);
    setShowReview(true);
    onRefreshResults();

    if (quiz.questions.length > 0 && score / quiz.questions.length >= 0.5) {
      confetti({ particleCount: 90, spread: 80, origin: { y: 0.7 } });
    }
  }, [currentUser.id, onRefreshResults]);

  finishRef.current = finishQuiz;

  useEffect(() => {
    if (!playingQuiz) return;
    const tick = () => {
      const elapsed = Math.floor((Date.now() - startedAtRef.current) / 1000);
      const remaining = Math.max(0, playingQuiz.duree_secondes - elapsed);
      setTimeLeft(remaining);
      if (remaining <= 0) finishRef.current();
    };
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [playingQuiz]);

  const startQuiz = (quiz: Quiz) => {
    if (getMyResult(quiz.id) || quiz.questions.length === 0) return;
    const initial = Array.from({ length: quiz.questions.length }, () => null as number | null);
    answersRef.current = initial;
    submittedRef.current = false;
    startedAtRef.current = Date.now();
    playingQuizRef.current = quiz;
    setAnswers(initial);
    setCurrentIndex(0);
    setTimeLeft(quiz.duree_secondes);
    setFinishedResult(null);
    setPlayingQuiz(quiz);
  };

  const selectOption = (optionIndex: number) => {
    setAnswers((previous) => {
      const next = [...previous];
      next[currentIndex] = optionIndex;
      answersRef.current = next;
      return next;
    });
  };

  const nextQuestion = () => {
    const quiz = playingQuizRef.current;
    if (!quiz) return;
    if (currentIndex + 1 < quiz.questions.length) {
      setCurrentIndex((index) => index + 1);
    } else {
      finishQuiz();
    }
  };

  const quitQuiz = () => {
    if (!window.confirm(t('quiz.quitConfirm'))) return;
    submittedRef.current = true;
    playingQuizRef.current = null;
    setPlayingQuiz(null);
  };

  const resetForm = () => {
    setFormTitle('');
    setFormCategory('');
    setFormDifficulty('facile');
    setFormDuration(120);
    setFormPublished(true);
    setDraftQuestions(createDraftQuestions(MIN_QUESTIONS));
  };

  const openCreate = () => {
    resetForm();
    setCreateOpen(true);
  };

  const closeCreate = () => {
    setCreateOpen(false);
    resetForm();
  };

  const updateDraftQuestion = (index: number, patch: Partial<DraftQuestion>) => {
    setDraftQuestions((previous) =>
      previous.map((question, questionIndex) =>
        questionIndex === index ? { ...question, ...patch } : question
      )
    );
  };

  const updateDraftOption = (questionIndex: number, optionIndex: number, value: string) => {
    setDraftQuestions((previous) =>
      previous.map((question, index) => {
        if (index !== questionIndex) return question;
        const options = [...question.options];
        options[optionIndex] = value;
        return { ...question, options };
      })
    );
  };

  const addDraftQuestion = () => {
    if (draftQuestions.length >= MAX_QUESTIONS) return;
    setDraftQuestions((previous) => [
      ...previous,
      { id: makeId('qq'), question: '', options: ['', '', '', ''], correct_index: 0 }
    ]);
  };

  const removeDraftQuestion = (index: number) => {
    if (draftQuestions.length <= MIN_QUESTIONS) return;
    setDraftQuestions((previous) => previous.filter((_, questionIndex) => questionIndex !== index));
  };

  const handleCreateQuiz = (event: React.FormEvent) => {
    event.preventDefault();
    if (!formTitle.trim() || !formCategory.trim()) {
      alert(t('quiz.form.errors.title'));
      return;
    }
    if (draftQuestions.length < MIN_QUESTIONS || draftQuestions.length > MAX_QUESTIONS) {
      alert(t('quiz.form.errors.count'));
      return;
    }
    const incomplete = draftQuestions.some(
      (question) => !question.question.trim() || question.options.some((option) => !option.trim())
    );
    if (incomplete) {
      alert(t('quiz.form.errors.incomplete'));
      return;
    }

    const questions: QuizQuestion[] = draftQuestions.map((question) => ({
      id: question.id || makeId('qq'),
      question: question.question.trim(),
      options: question.options.map((option) => option.trim()),
      correct_index: Math.max(0, Math.min(3, question.correct_index))
    }));

    StorageService.createQuiz({
      titre: formTitle.trim(),
      categorie: formCategory.trim(),
      difficulte: formDifficulty,
      duree_secondes: Math.max(10, Math.min(3600, Math.round(Number(formDuration) || 120))),
      questions,
      createur_id: currentUser.id,
      is_published: formPublished
    });

    onRefreshQuizzes();
    closeCreate();
    setTab('play');
    confetti({ particleCount: 60, spread: 70, origin: { y: 0.7 } });
  };

  const togglePublish = (quiz: Quiz) => {
    StorageService.setQuizPublished(quiz.id, !quiz.is_published);
    onRefreshQuizzes();
  };

  const deleteQuiz = (quiz: Quiz) => {
    if (!window.confirm(t('quiz.deleteConfirm', { name: quiz.titre }))) return;
    StorageService.deleteQuiz(quiz.id);
    onRefreshQuizzes();
    onRefreshResults();
  };

  const resultRank = (result: QuizResult): number => {
    const ranking = results
      .filter((item) => item.quiz_id === result.quiz_id)
      .concat(results.some((item) => item.id === result.id) ? [] : [result])
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.duree_utilisee - b.duree_utilisee;
      });
    const position = ranking.findIndex((item) => item.id === result.id);
    return position < 0 ? 0 : position + 1;
  };

  const renderRankingTable = (rows: QuizResult[], showTime: boolean) => {
    const myIndex = rows.findIndex((result) => result.membre_id === currentUser.id);
    const visibleRows = rows
      .map((result, index) => ({ result, index }))
      .filter(({ index }) => index < 10 || index === myIndex);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {visibleRows.map(({ result, index }) => {
          const isMe = result.membre_id === currentUser.id;
          return (
            <React.Fragment key={result.id}>
              {isMe && index >= 10 && (
                <div style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.85rem', letterSpacing: '0.3em' }}>
                  ···
                </div>
              )}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: showTime ? '42px 1fr 90px 90px' : '42px 1fr 90px',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  background: isMe ? 'rgba(245, 158, 11, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                  border: isMe ? '1px solid var(--border-gold)' : '1px solid var(--border-color)'
                }}
              >
                <span style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '0.8rem',
                  background: index === 0 ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'rgba(255, 255, 255, 0.08)',
                  color: index === 0 ? '#070d1e' : 'var(--text-main)'
                }}>
                  {index + 1}
                </span>
                <span style={{ fontSize: '0.85rem', fontWeight: isMe ? 800 : 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {memberName(result.membre_id)}
                </span>
                <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#f59e0b', textAlign: 'right' }}>
                  {result.score}/{result.total}
                </span>
                {showTime && (
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                    {formatTime(result.duree_utilisee)}
                  </span>
                )}
              </div>
            </React.Fragment>
          );
        })}
        {rows.length === 0 && (
          <p style={{ margin: 0, padding: '18px', textAlign: 'center', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
            {t('quiz.leaderboard.empty')}
          </p>
        )}
      </div>
    );
  };

  const renderQuizRunner = (quiz: Quiz) => {
    const question = quiz.questions[currentIndex];
    if (!question) return null;
    const selected = answers[currentIndex];
    const isLast = currentIndex + 1 >= quiz.questions.length;
    const progress = quiz.questions.length ? ((currentIndex + 1) / quiz.questions.length) * 100 : 0;
    const urgent = timeLeft <= 10;

    return (
      <div className="glass-card animate-fade-in" style={{ padding: '22px', maxWidth: '820px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span className="badge badge-gold">{quiz.categorie}</span>
              <span className="badge" style={{ ...DIFFICULTY_STYLES[quiz.difficulte], border: '1px solid transparent' }}>
                {t(`quiz.difficulty.${quiz.difficulte}`)}
              </span>
            </div>
            <h2 style={{ fontSize: '1.15rem', margin: '8px 0 0' }}>{quiz.titre}</h2>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 14px',
            borderRadius: '999px',
            background: urgent ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.12)',
            border: `1px solid ${urgent ? 'rgba(239, 68, 68, 0.45)' : 'rgba(16, 185, 129, 0.35)'}`,
            color: urgent ? '#f87171' : '#34d399',
            fontWeight: 800,
            fontVariantNumeric: 'tabular-nums'
          }}>
            <Clock size={17} />
            {formatTime(timeLeft)}
          </div>
        </div>

        <div style={{ marginBottom: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
            <span>{t('quiz.questionNumber', { index: currentIndex + 1, total: quiz.questions.length })}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div style={{ height: '7px', borderRadius: '999px', background: 'rgba(255, 255, 255, 0.08)', overflow: 'hidden' }}>
            <div style={{
              width: `${progress}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #f59e0b, #ec4899, #8b5cf6)',
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>

        <h3 style={{ fontSize: '1.12rem', lineHeight: 1.45, margin: '0 0 16px' }}>{question.question}</h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
          {question.options.map((option, optionIndex) => {
            const isSelected = selected === optionIndex;
            return (
              <button
                key={`${question.id}-${optionIndex}`}
                type="button"
                onClick={() => selectOption(optionIndex)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  border: isSelected ? '1px solid var(--border-gold)' : '1px solid var(--border-color)',
                  background: isSelected ? 'rgba(245, 158, 11, 0.14)' : 'rgba(255, 255, 255, 0.03)',
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                  fontSize: '0.9rem',
                  transition: 'all 0.15s ease'
                }}
              >
                <span style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '0.78rem',
                  background: isSelected ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'rgba(255, 255, 255, 0.08)',
                  color: isSelected ? '#070d1e' : 'var(--text-muted)',
                  flexShrink: 0
                }}>
                  {OPTION_LABELS[optionIndex] || optionIndex + 1}
                </span>
                <span style={{ flex: 1 }}>{option}</span>
                {isSelected && <CheckCircle2 size={18} style={{ color: '#f59e0b' }} />}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
          <button type="button" onClick={quitQuiz} className="btn btn-ghost">
            <X size={16} />
            {t('quiz.quit')}
          </button>
          <button
            type="button"
            onClick={nextQuestion}
            disabled={selected === null || selected === undefined}
            className="btn btn-primary"
            style={{ opacity: selected === null || selected === undefined ? 0.5 : 1 }}
          >
            {isLast ? t('quiz.finish') : t('quiz.next')}
            <ChevronRight size={17} />
          </button>
        </div>
      </div>
    );
  };

  const renderResult = (result: QuizResult) => {
    const quiz = quizzes.find((item) => item.id === result.quiz_id);
    const rank = resultRank(result);
    const percent = result.total > 0 ? Math.round((result.score / result.total) * 100) : 0;

    return (
      <div className="glass-card animate-fade-in" style={{ padding: '28px', maxWidth: '640px', margin: '0 auto', textAlign: 'center' }}>
        <div style={{
          width: '66px',
          height: '66px',
          borderRadius: '50%',
          margin: '0 auto 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(139, 92, 246, 0.25))',
          color: '#f59e0b'
        }}>
          <Trophy size={32} />
        </div>
        <h2 style={{ margin: '0 0 6px', fontSize: '1.35rem' }}>{t('quiz.resultTitle')}</h2>
        <p style={{ margin: '0 0 18px', color: 'var(--text-muted)', fontSize: '0.86rem' }}>
          {quiz?.titre || t('quiz.title')}
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '22px', flexWrap: 'wrap', marginBottom: '22px' }}>
          <div>
            <div style={{ fontSize: '2.4rem', fontWeight: 900, lineHeight: 1, color: '#f59e0b' }}>
              {result.score}/{result.total}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '5px' }}>{t('quiz.yourScore')}</div>
          </div>
          <div>
            <div style={{ fontSize: '2.4rem', fontWeight: 900, lineHeight: 1, color: '#a78bfa' }}>{percent}%</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '5px' }}>{t('quiz.successRate')}</div>
          </div>
          <div>
            <div style={{ fontSize: '2.4rem', fontWeight: 900, lineHeight: 1, color: '#34d399' }}>{rank || '-'}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '5px' }}>{t('quiz.rank')}</div>
          </div>
        </div>

        {result.answers && result.answers.length > 0 && (
          <div style={{ textAlign: 'left', marginBottom: '18px' }}>
            <button type="button" className="btn btn-ghost" onClick={() => setShowReview((v) => !v)} style={{ width: '100%', justifyContent: 'center' }}>
              {showReview ? <EyeOff size={16} /> : <Eye size={16} />}
              {showReview ? t('quiz.review.hide') : t('quiz.review.show')}
            </button>
            {showReview && (
              <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h3 style={{ margin: 0, fontSize: '0.95rem' }}>{t('quiz.review.title')}</h3>
                {result.answers.map((answer) => {
                  const question = quiz?.questions.find((q) => q.id === answer.question_id) ?? quiz?.questions[result.answers.indexOf(answer)];
                  if (!question) return null;
                  const selected = answer.selected_index;
                  const correct = question.correct_index;
                  const isCorrect = answer.is_correct;
                  return (
                    <div key={answer.question_id} style={{ padding: '12px', borderRadius: '10px', border: `1px solid ${isCorrect ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.35)'}`, background: isCorrect ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)' }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontWeight: 700, fontSize: '0.85rem', marginBottom: '8px' }}>
                        {isCorrect ? <CheckCircle2 size={16} color="#34d399" /> : <span style={{ color: '#f87171', fontWeight: 900 }}>×</span>}
                        <span>{question.question}</span>
                      </div>
                      <div style={{ fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ color: isCorrect ? '#34d399' : '#f87171' }}>
                          {t('quiz.review.yourAnswer')}: {selected === null || selected === undefined ? t('quiz.review.noAnswer') : `${OPTION_LABELS[selected] ?? ''}. ${question.options[selected] ?? ''}`}
                        </div>
                        {!isCorrect && (
                          <div style={{ color: '#34d399' }}>
                            {t('quiz.review.correct')}: {OPTION_LABELS[correct] ?? ''}. {question.options[correct] ?? ''}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-primary" onClick={() => setTab('ranking')}>
            <Trophy size={17} />
            {t('quiz.viewRanking')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setFinishedResult(null)}>
            <RotateCcw size={17} />
            {t('quiz.backToGames')}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="animate-fade-in" style={{ padding: '24px 20px', maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="badge badge-purple">{t('quiz.badge')}</span>
          </div>
          <h1 style={{ fontSize: '1.6rem', margin: '6px 0 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <BrainCircuit size={26} style={{ color: '#a78bfa' }} />
            {t('quiz.title')}
          </h1>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {t('quiz.subtitle')}
          </p>
        </div>

        {canCreate && (
          <button type="button" onClick={openCreate} className="btn btn-purple">
            <Plus size={18} />
            {t('quiz.create')}
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <button
          type="button"
          onClick={() => setTab('play')}
          className={`btn ${tab === 'play' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ fontSize: '0.84rem' }}
        >
          <Play size={16} />
          {t('quiz.tab.play')}
        </button>
        <button
          type="button"
          onClick={() => setTab('ranking')}
          className={`btn ${tab === 'ranking' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ fontSize: '0.84rem' }}
        >
          <Trophy size={16} />
          {t('quiz.tab.ranking')}
        </button>
      </div>

      {finishedResult && tab === 'play' && renderResult(finishedResult)}
      {!finishedResult && playingQuiz && tab === 'play' && renderQuizRunner(playingQuiz)}

      {tab === 'play' && !playingQuiz && !finishedResult && (
        <>
          {visibleQuizzes.length === 0 ? (
            <div className="glass-card" style={{ padding: '34px 22px', textAlign: 'center' }}>
              <ListChecks size={38} style={{ color: '#a78bfa', marginBottom: '10px' }} />
              <h3 style={{ margin: '0 0 6px', fontSize: '1.05rem' }}>{t('quiz.empty')}</h3>
              <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                {canCreate ? t('quiz.emptyCreator') : t('quiz.emptyMember')}
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: '16px' }}>
              {visibleQuizzes.map((quiz) => {
                const myResult = getMyResult(quiz.id);
                const difficulty = DIFFICULTY_STYLES[quiz.difficulte];
                const isCreator = quiz.createur_id === currentUser.id;
                const canManage = canCreate && (isCreator || currentUser.role === 'admin' || currentUser.role === 'super_chef');

                return (
                  <div key={quiz.id} className="glass-card" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                      <span className="badge badge-gold">{quiz.categorie}</span>
                      <span className="badge" style={{ ...difficulty, border: '1px solid transparent' }}>
                        {t(`quiz.difficulty.${quiz.difficulte}`)}
                      </span>
                    </div>

                    <h3 style={{ margin: 0, fontSize: '1.05rem', lineHeight: 1.35 }}>{quiz.titre}</h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <ListChecks size={14} />
                        {t('quiz.questionsCount', { count: quiz.questions.length })}
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <Clock size={14} />
                        {t('quiz.durationValue', { time: formatTime(quiz.duree_secondes) })}
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <User size={14} />
                        {memberName(quiz.createur_id)}
                      </span>
                    </div>

                    {!quiz.is_published && (
                      <span className="badge badge-red" style={{ alignSelf: 'flex-start' }}>
                        <EyeOff size={12} /> {t('quiz.draft')}
                      </span>
                    )}

                    {myResult ? (
                      <>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px',
                          padding: '10px 12px',
                          borderRadius: '10px',
                          background: 'rgba(16, 185, 129, 0.1)',
                          border: '1px solid rgba(16, 185, 129, 0.3)'
                        }}>
                          <span style={{ fontSize: '0.78rem', color: '#34d399', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <Lock size={14} /> {t('quiz.completed')}
                          </span>
                          <strong style={{ fontSize: '1rem', color: '#34d399' }}>{myResult.score}/{myResult.total}</strong>
                        </div>
                        <button type="button" onClick={() => { setShowReview(true); setFinishedResult(myResult); }} className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center' }}>
                          <Eye size={15} /> {t('quiz.review.open')}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startQuiz(quiz)}
                        className="btn btn-primary"
                        style={{ width: '100%' }}
                      >
                        <Play size={17} />
                        {t('quiz.play')}
                      </button>
                    )}

                    {canManage && (
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => togglePublish(quiz)}
                          className={`btn ${quiz.is_published ? 'btn-ghost' : 'btn-success'}`}
                          style={{ flex: 1, fontSize: '0.76rem', padding: '8px 10px' }}
                        >
                          {quiz.is_published ? <EyeOff size={14} /> : <Eye size={14} />}
                          {quiz.is_published ? t('quiz.unpublish') : t('quiz.publish')}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteQuiz(quiz)}
                          className="btn btn-danger"
                          style={{ fontSize: '0.76rem', padding: '8px 10px' }}
                          title={t('quiz.delete')}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === 'ranking' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div className="glass-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <Trophy size={20} style={{ color: '#f59e0b' }} />
              <h2 style={{ margin: 0, fontSize: '1.08rem' }}>{t('quiz.leaderboard.title')}</h2>
            </div>
            <p style={{ margin: '0 0 16px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {t('quiz.leaderboard.subtitle')}
            </p>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '42px 1fr 90px',
              gap: '10px',
              padding: '0 12px 8px',
              fontSize: '0.68rem',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: 'var(--text-dim)',
              fontWeight: 700
            }}>
              <span>{t('quiz.rankColumn')}</span>
              <span>{t('quiz.memberColumn')}</span>
              <span style={{ textAlign: 'right' }}>{t('quiz.pointsColumn')}</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {globalRanking.map((entry, index) => {
                const isMe = entry.membreId === currentUser.id;
                if (index >= 10 && !isMe) return null;
                return (
                  <React.Fragment key={entry.membreId}>
                    {isMe && index >= 10 && (
                      <div style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.85rem', letterSpacing: '0.3em' }}>
                        ···
                      </div>
                    )}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '42px 1fr 90px',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      background: isMe ? 'rgba(245, 158, 11, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                      border: isMe ? '1px solid var(--border-gold)' : '1px solid var(--border-color)'
                    }}
                  >
                    <span style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '0.8rem',
                      background: index === 0 ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'rgba(255, 255, 255, 0.08)',
                      color: index === 0 ? '#070d1e' : 'var(--text-main)'
                    }}>
                      {index + 1}
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: isMe ? 800 : 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {memberName(entry.membreId)}
                      </span>
                      <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        {t('quiz.completedCount', { count: entry.completed })}
                      </span>
                    </span>
                    <span style={{ fontSize: '1rem', fontWeight: 900, color: '#f59e0b', textAlign: 'right' }}>
                      {t('quiz.points', { count: entry.points })}
                    </span>
                  </div>
                  </React.Fragment>
                );
              })}
              {globalRanking.length === 0 && (
                <p style={{ margin: 0, padding: '18px', textAlign: 'center', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                  {t('quiz.leaderboard.empty')}
                </p>
              )}
            </div>
          </div>

          <div className="glass-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.02rem' }}>{t('quiz.perQuiz.title')}</h2>
                <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {t('quiz.perQuiz.subtitle')}
                </p>
              </div>
              <select
                className="form-select"
                value={selectedRankingQuiz?.id || ''}
                onChange={(event) => setRankingQuizId(event.target.value)}
                style={{ maxWidth: '280px' }}
              >
                {visibleQuizzes.map((quiz) => (
                  <option key={quiz.id} value={quiz.id}>
                    {quiz.categorie} — {quiz.titre}
                  </option>
                ))}
              </select>
            </div>

            {selectedRankingQuiz ? (
              renderRankingTable(quizResults(selectedRankingQuiz.id), true)
            ) : (
              <p style={{ margin: 0, padding: '18px', textAlign: 'center', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                {t('quiz.leaderboard.empty')}
              </p>
            )}
          </div>
        </div>
      )}

      {createOpen && canCreate && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.78)',
            backdropFilter: 'blur(6px)',
            zIndex: 120,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '18px'
          }}
        >
          <form
            onSubmit={handleCreateQuiz}
            className="glass-card"
            style={{
              width: 'min(920px, 100%)',
              maxHeight: '92vh',
              overflowY: 'auto',
              padding: '22px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.18rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={20} style={{ color: '#a78bfa' }} />
                  {t('quiz.createTitle')}
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {t('quiz.createSubtitle')}
                </p>
              </div>
              <button type="button" onClick={closeCreate} className="btn btn-ghost" style={{ padding: '7px' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '0.78rem', fontWeight: 600 }}>
                {t('quiz.form.title')}
                <input
                  className="form-input"
                  value={formTitle}
                  onChange={(event) => setFormTitle(event.target.value)}
                  placeholder={t('quiz.form.titlePlaceholder')}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '0.78rem', fontWeight: 600 }}>
                {t('quiz.form.category')}
                <input
                  className="form-input"
                  value={formCategory}
                  onChange={(event) => setFormCategory(event.target.value)}
                  placeholder={t('quiz.form.categoryPlaceholder')}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '0.78rem', fontWeight: 600 }}>
                {t('quiz.form.difficulty')}
                <select
                  className="form-select"
                  value={formDifficulty}
                  onChange={(event) => {
                    const nextDifficulty = event.target.value as QuizDifficulty;
                    setFormDifficulty(nextDifficulty);
                    setDraftQuestions((previous) => {
                      const untouched = previous.every(
                        (question) =>
                          !question.question.trim() &&
                          question.options.every((option) => !option.trim())
                      );
                      return untouched
                        ? createDraftQuestions(RECOMMENDED_QUESTIONS[nextDifficulty])
                        : previous;
                    });
                  }}
                >
                  <option value="facile">{t('quiz.difficulty.facile')}</option>
                  <option value="moyen">{t('quiz.difficulty.moyen')}</option>
                  <option value="difficile">{t('quiz.difficulty.difficile')}</option>
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '0.78rem', fontWeight: 600 }}>
                {t('quiz.form.duration')}
                <input
                  className="form-input"
                  type="number"
                  min={10}
                  max={3600}
                  step={5}
                  value={formDuration}
                  onChange={(event) => setFormDuration(Number(event.target.value))}
                />
                <span style={{ fontSize: '0.68rem', fontWeight: 400, color: 'var(--text-muted)' }}>
                  {t('quiz.form.durationHint')}
                </span>
              </label>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '9px', fontSize: '0.82rem', fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={formPublished}
                onChange={(event) => setFormPublished(event.target.checked)}
              />
              {t('quiz.form.publishNow')}
            </label>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {t('quiz.form.questionsHint', { min: MIN_QUESTIONS, max: MAX_QUESTIONS })}
              </div>
              <span className="badge badge-gold">
                {t('quiz.questionsCount', { count: draftQuestions.length })}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {draftQuestions.map((question, questionIndex) => (
                <div
                  key={question.id}
                  style={{
                    padding: '14px',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                    background: 'rgba(255, 255, 255, 0.02)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
                    <strong style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {t('quiz.questionNumber', { index: questionIndex + 1, total: draftQuestions.length })}
                    </strong>
                    <button
                      type="button"
                      onClick={() => removeDraftQuestion(questionIndex)}
                      className="btn btn-ghost"
                      style={{ padding: '4px 7px', fontSize: '0.7rem' }}
                      disabled={draftQuestions.length <= MIN_QUESTIONS}
                    >
                      <Trash2 size={13} />
                      {t('quiz.form.removeQuestion')}
                    </button>
                  </div>

                  <input
                    className="form-input"
                    value={question.question}
                    onChange={(event) => updateDraftQuestion(questionIndex, { question: event.target.value })}
                    placeholder={t('quiz.form.questionPlaceholder')}
                    style={{ marginBottom: '9px' }}
                  />

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '8px' }}>
                    {question.options.map((option, optionIndex) => (
                      <label
                        key={`${question.id}-${optionIndex}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '7px',
                          padding: '7px 9px',
                          borderRadius: '9px',
                          border: question.correct_index === optionIndex
                            ? '1px solid rgba(16, 185, 129, 0.5)'
                            : '1px solid var(--border-color)',
                          background: question.correct_index === optionIndex
                            ? 'rgba(16, 185, 129, 0.08)'
                            : 'transparent'
                        }}
                      >
                        <input
                          type="radio"
                          name={`correct-${question.id}`}
                          checked={question.correct_index === optionIndex}
                          onChange={() => updateDraftQuestion(questionIndex, { correct_index: optionIndex })}
                          title={t('quiz.form.correct')}
                        />
                        <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-dim)' }}>
                          {OPTION_LABELS[optionIndex]}
                        </span>
                        <input
                          className="form-input"
                          value={option}
                          onChange={(event) => updateDraftOption(questionIndex, optionIndex, event.target.value)}
                          placeholder={t('quiz.form.optionPlaceholder', { letter: OPTION_LABELS[optionIndex] })}
                          style={{ padding: '8px 10px', fontSize: '0.82rem' }}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addDraftQuestion}
              className="btn btn-ghost"
              disabled={draftQuestions.length >= MAX_QUESTIONS}
              style={{ alignSelf: 'flex-start' }}
            >
              <Plus size={16} />
              {t('quiz.form.addQuestion')}
            </button>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
              <button type="button" onClick={closeCreate} className="btn btn-ghost">
                {t('quiz.form.cancel')}
              </button>
              <button type="submit" className="btn btn-primary">
                <CheckCircle2 size={17} />
                {t('quiz.form.submit')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
