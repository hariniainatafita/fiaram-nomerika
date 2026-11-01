import type { TranslationDictionary } from '../types';

export const quiz: TranslationDictionary = {
  'quiz.badge': { mg: 'Fifanandrenana QCM', fr: 'Jeu QCM', en: 'Quiz game' },
  'quiz.title': { mg: 'Fitsapana fahalalana', fr: 'Jeu de questions (QCM)', en: 'Quiz challenge' },
  'quiz.subtitle': {
    mg: 'Valio ny fanontaniana, raiso ny isa ary miakara amin’ny laharana.',
    fr: 'Répondez aux questions, gagnez des points et grimpez dans le classement.',
    en: 'Answer the questions, earn points and climb the leaderboard.'
  },
  'quiz.create': { mg: 'Hamorona QCM', fr: 'Créer un QCM', en: 'Create a quiz' },
  'quiz.createTitle': { mg: 'Hamorona ambaratonga QCM', fr: 'Créer un niveau QCM', en: 'Create a quiz level' },
  'quiz.createSubtitle': {
    mg: 'Farano ny sokajy, ny haavon’ny fahasarotana, ny fotoana ary ny fanontaniana.',
    fr: 'Définissez la catégorie, la difficulté, le chronomètre et les questions.',
    en: 'Set the category, difficulty, timer and questions.'
  },
  'quiz.tab.play': { mg: 'Milalao', fr: 'Jouer', en: 'Play' },
  'quiz.tab.ranking': { mg: 'Laharana', fr: 'Classement', en: 'Ranking' },
  'quiz.empty': { mg: 'Tsy misy QCM mbola misy', fr: 'Aucun QCM disponible', en: 'No quiz available' },
  'quiz.emptyCreator': {
    mg: 'Mamorona ambaratonga voalohany amin’ny alalan’ny bokotra « Hamorona QCM ».',
    fr: 'Créez votre premier niveau avec le bouton « Créer un QCM ».',
    en: 'Create your first level with the “Create a quiz” button.'
  },
  'quiz.emptyMember': {
    mg: 'Miandrasa ny Super Chef na ny Admin hamoaka QCM vaovao.',
    fr: 'Attendez qu’un Super Chef ou un Admin publie un nouveau QCM.',
    en: 'Wait for a Super Chef or Admin to publish a new quiz.'
  },
  'quiz.questionsCount': {
    mg: '{count} fanontaniana',
    fr: '{count} questions',
    en: '{count} questions'
  },
  'quiz.durationValue': { mg: 'Fetra {time}', fr: 'Durée {time}', en: 'Duration {time}' },
  'quiz.draft': { mg: 'Tsy mbola navoaka', fr: 'Brouillon', en: 'Draft' },
  'quiz.completed': { mg: 'Vita', fr: 'Terminé', en: 'Completed' },
  'quiz.play': { mg: 'Hanomboka', fr: 'Commencer', en: 'Start' },
  'quiz.publish': { mg: 'Hamoaka', fr: 'Publier', en: 'Publish' },
  'quiz.unpublish': { mg: 'Hanafina', fr: 'Dépublier', en: 'Unpublish' },
  'quiz.delete': { mg: 'Fafao ny QCM', fr: 'Supprimer le QCM', en: 'Delete quiz' },
  'quiz.deleteConfirm': {
    mg: 'Hofafana tokoa ve ny QCM « {name} » sy ny vokany rehetra ?',
    fr: 'Supprimer le QCM « {name} » et tous ses résultats ?',
    en: 'Delete the quiz “{name}” and all its results?'
  },
  'quiz.difficulty.facile': { mg: 'Mora', fr: 'Facile', en: 'Easy' },
  'quiz.difficulty.moyen': { mg: 'Antonony', fr: 'Moyen', en: 'Medium' },
  'quiz.difficulty.difficile': { mg: 'Sarotra', fr: 'Difficile', en: 'Hard' },
  'quiz.quit': { mg: 'Hiala', fr: 'Quitter', en: 'Quit' },
  'quiz.quitConfirm': {
    mg: 'Hiala amin’ity QCM ity ve? Tsy voatahiry ny valiny.',
    fr: 'Quitter ce QCM ? Vos réponses ne seront pas enregistrées.',
    en: 'Quit this quiz? Your answers will not be saved.'
  },
  'quiz.next': { mg: 'Manaraka', fr: 'Suivant', en: 'Next' },
  'quiz.finish': { mg: 'Hamita', fr: 'Terminer', en: 'Finish' },
  'quiz.questionNumber': {
    mg: 'Fanontaniana {index}/{total}',
    fr: 'Question {index}/{total}',
    en: 'Question {index}/{total}'
  },
  'quiz.resultTitle': { mg: 'Vita ny QCM !', fr: 'QCM terminé !', en: 'Quiz completed!' },
  'quiz.yourScore': { mg: 'Ny isanao', fr: 'Votre score', en: 'Your score' },
  'quiz.successRate': { mg: 'Fahombiazana', fr: 'Réussite', en: 'Success rate' },
  'quiz.points': { mg: '{count} isa', fr: '{count} pts', en: '{count} pts' },
  'quiz.rank': { mg: 'Laharana', fr: 'Rang', en: 'Rank' },
  'quiz.viewRanking': { mg: 'Hijery ny laharana', fr: 'Voir le classement', en: 'View ranking' },
  'quiz.backToGames': { mg: 'Hiverina amin’ny QCM', fr: 'Retour aux QCM', en: 'Back to quizzes' },
  'quiz.leaderboard.title': { mg: 'Laharana ankapobeny', fr: 'Classement général', en: 'Overall ranking' },
  'quiz.leaderboard.subtitle': {
    mg: 'Ny fitambaran’ny isa azo amin’ny QCM rehetra.',
    fr: 'Total des points obtenus sur tous les QCM.',
    en: 'Total points earned across all quizzes.'
  },
  'quiz.leaderboard.empty': {
    mg: 'Tsy mbola misy mpilalao nahavita QCM.',
    fr: 'Aucun joueur n’a encore terminé un QCM.',
    en: 'No player has completed a quiz yet.'
  },
  'quiz.rankColumn': { mg: 'Laharana', fr: 'Rang', en: 'Rank' },
  'quiz.memberColumn': { mg: 'Mpilalao', fr: 'Joueur', en: 'Player' },
  'quiz.pointsColumn': { mg: 'Isa', fr: 'Points', en: 'Points' },
  'quiz.completedCount': {
    mg: '{count} QCM vita',
    fr: '{count} QCM terminé(s)',
    en: '{count} quiz completed'
  },
  'quiz.perQuiz.title': { mg: 'Laharana isaky ny ambaratonga', fr: 'Classement par niveau', en: 'Ranking by level' },
  'quiz.perQuiz.subtitle': {
    mg: 'Safidio ny ambaratonga hijery ny isan’ny mpilalao.',
    fr: 'Sélectionnez un niveau pour voir les scores des joueurs.',
    en: 'Select a level to see the players’ scores.'
  },
  'quiz.form.title': { mg: 'Lohateny', fr: 'Titre', en: 'Title' },
  'quiz.form.titlePlaceholder': {
    mg: 'Ohatra: Fanadinana Vavaka',
    fr: 'Ex : Épreuve de Vavaka',
    en: 'E.g.: Prayer challenge'
  },
  'quiz.form.category': { mg: 'Sokajy', fr: 'Catégorie', en: 'Category' },
  'quiz.form.categoryPlaceholder': {
    mg: 'Ohatra: Vavaka, Fanatitra...',
    fr: 'Ex : Vavaka, Fanatitra...',
    en: 'E.g.: Vavaka, Fanatitra...'
  },
  'quiz.form.difficulty': { mg: 'Haavon’ny fahasarotana', fr: 'Difficulté', en: 'Difficulty' },
  'quiz.form.duration': { mg: 'Fetra (segondra)', fr: 'Chronomètre (secondes)', en: 'Timer (seconds)' },
  'quiz.form.durationHint': {
    mg: 'Azo ovaina: 10 ka hatramin’ny 3600 segondra.',
    fr: 'Réglable de 10 à 3600 secondes.',
    en: 'Adjustable from 10 to 3600 seconds.'
  },
  'quiz.form.publishNow': {
    mg: 'Hamoaka avy hatrany ho an’ny mpikambana rehetra',
    fr: 'Publier immédiatement pour tous les membres',
    en: 'Publish immediately for all members'
  },
  'quiz.form.questionsHint': {
    mg: 'Ampidiro {min} ka hatramin’ny {max} fanontaniana.',
    fr: 'Ajoutez entre {min} et {max} questions.',
    en: 'Add between {min} and {max} questions.'
  },
  'quiz.form.removeQuestion': { mg: 'Esory', fr: 'Retirer', en: 'Remove' },
  'quiz.form.questionPlaceholder': {
    mg: 'Ny fanontaniana...',
    fr: 'La question...',
    en: 'The question...'
  },
  'quiz.form.optionPlaceholder': {
    mg: 'Valiny {letter}',
    fr: 'Réponse {letter}',
    en: 'Answer {letter}'
  },
  'quiz.form.correct': { mg: 'Valiny marina', fr: 'Bonne réponse', en: 'Correct answer' },
  'quiz.form.addQuestion': { mg: 'Hanampy fanontaniana', fr: 'Ajouter une question', en: 'Add a question' },
  'quiz.form.cancel': { mg: 'Ajanona', fr: 'Annuler', en: 'Cancel' },
  'quiz.form.submit': { mg: 'Hamorona ny QCM', fr: 'Créer le QCM', en: 'Create quiz' },
  'quiz.form.errors.title': {
    mg: 'Fenoy ny lohateny sy ny sokajy.',
    fr: 'Renseignez le titre et la catégorie.',
    en: 'Fill in the title and category.'
  },
  'quiz.form.errors.count': {
    mg: 'Tokony ho 10 ka hatramin’ny 20 ny isan’ny fanontaniana.',
    fr: 'Le QCM doit contenir entre 10 et 20 questions.',
    en: 'The quiz must contain between 10 and 20 questions.'
  },
  'quiz.form.errors.incomplete': {
    mg: 'Fenoy ny fanontaniana sy ny valiny efatra rehetra.',
    fr: 'Complétez chaque question et ses quatre réponses.',
    en: 'Complete every question and all four answers.'
  }
};
