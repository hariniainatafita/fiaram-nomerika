import type { TranslationDictionary } from '../types';

export const auth: TranslationDictionary = {
  'auth.subtitle': {
    mg: 'Sehatra fitantanana vondrona',
    fr: 'Plateforme de gestion de groupe',
    en: 'Group management platform'
  },
  'auth.tabLogin': {
    mg: 'Fidirana',
    fr: 'Connexion',
    en: 'Login'
  },
  'auth.tabRegister': {
    mg: 'Fisoratana Anarana',
    fr: 'Inscription',
    en: 'Register'
  },
  'auth.identifierLabel': {
    mg: 'Solonanarana na Mailaka',
    fr: "Nom d'utilisateur ou email",
    en: 'Username or email'
  },
  'auth.identifierPlaceholder': {
    mg: 'oh: admin na hasina...',
    fr: 'ex : admin ou hasina...',
    en: 'e.g. admin or hasina...'
  },
  'auth.passwordPlaceholder': {
    mg: 'Ampidiro ny tenimiafina...',
    fr: 'Saisissez votre mot de passe...',
    en: 'Enter your password...'
  },
  'auth.loginButton': {
    mg: "Hiditra amin'ny kaonty",
    fr: 'Se connecter au compte',
    en: 'Sign in to account'
  },
  'auth.defaultAdminTitle': {
    mg: 'Kaonty Mpandrindra (Admin voalohany)',
    fr: 'Compte administrateur (Admin par défaut)',
    en: 'Administrator account (default admin)'
  },
  'auth.firstNameLabel': {
    mg: "Fanampin'anarana",
    fr: 'Prénom',
    en: 'First name'
  },
  'auth.firstNamePlaceholder': {
    mg: 'oh: Hasina',
    fr: 'ex : Hasina',
    en: 'e.g. Hasina'
  },
  'auth.lastNamePlaceholder': {
    mg: 'oh: RAZAFY',
    fr: 'ex : RAZAFY',
    en: 'e.g. RAZAFY'
  },
  'auth.usernamePlaceholder': {
    mg: 'oh: hasina',
    fr: 'ex : hasina',
    en: 'e.g. hasina'
  },
  'auth.emailPlaceholder': {
    mg: 'oh: hasina@fiaram.mg',
    fr: 'ex : hasina@fiaram.mg',
    en: 'e.g. hasina@fiaram.mg'
  },
  'auth.groupAssignmentLabel': {
    mg: 'Vondrona',
    fr: 'Groupe',
    en: 'Group'
  },
  'auth.groupAssignedByChef': {
    mg: 'Ny mpitarika vondrona no hampiditra anao ao amin\u2019ny vondrona iray rehefa avy nahavoa ny fisoratana anaranao. Tsy mila misafidy vondrona ianao.',
    fr: 'Votre groupe vous sera attribué par un chef après votre inscription. Vous n\u2019avez pas à choisir de groupe.',
    en: 'A group leader will assign your group after your registration. You do not need to choose a group.'
  },
  'auth.groupPendingAssignment': {
    mg: 'Hampidirin’ny mpitarika vondrona',
    fr: 'À attribuer par un chef',
    en: 'To be assigned by a leader'
  },
  'auth.createPasswordPlaceholder': {
    mg: 'Mamorona tenimiafina...',
    fr: 'Créez un mot de passe...',
    en: 'Create a password...'
  },
  'auth.confirmPasswordLabel': {
    mg: 'Hamarino ny tenimiafina',
    fr: 'Confirmer le mot de passe',
    en: 'Confirm password'
  },
  'auth.confirmPasswordPlaceholder': {
    mg: 'Avereno ny tenimiafina...',
    fr: 'Ressaisissez le mot de passe...',
    en: 'Re-enter the password...'
  },
  'auth.togglePasswordTitle': {
    mg: 'Asehoy na zehio ny tenimiafina',
    fr: 'Afficher ou masquer le mot de passe',
    en: 'Show or hide the password'
  },
  'auth.passwordMismatchError': {
    mg: "Tsy mitovy ny tenimiafina roa. Hamarino azafady.",
    fr: 'Les mots de passe ne correspondent pas. Vérifiez et réessayez.',
    en: 'The passwords do not match. Please check and try again.'
  },
  'auth.passwordsMatch': {
    mg: 'Mitovy ny tenimiafina',
    fr: 'Les mots de passe correspondent',
    en: 'Passwords match'
  },
  'auth.registrationQuestionsTitle': {
    mg: "Fanontaniana ho an'ny Fisoratana Anarana",
    fr: "Questions pour l'inscription",
    en: 'Registration questions'
  },
  'auth.answerPlaceholder': {
    mg: 'Valio eto...',
    fr: 'Répondez ici...',
    en: 'Answer here...'
  },
  'auth.dossierVerificationNotice': {
    mg: "Afaka miditra mivantana ianao rehefa avy nanoratra anarana. Hamarina ny dosienao (valinteny) ny Mpandrindra na ny mpitarika taty aoriana.",
    fr: "Votre compte est actif dès la fin de l'inscription : vous pouvez vous connecter tout de suite. L'Admin ou un chef vérifiera votre dossier (vos réponses) après votre première connexion.",
    en: "Your account is active as soon as you register: you can sign in right away. The Admin or a leader will review your file (your answers) after your first sign-in."
  },
  'auth.registerButton': {
    mg: 'Hamorona Kaonty & Karatra Mpikambana',
    fr: 'Créer le compte et la carte de membre',
    en: 'Create account and member card'
  },
  'auth.requiredFieldsError': {
    mg: 'Fenoy avokoa azafady ireo fampahalalana takiana.',
    fr: 'Veuillez remplir tous les champs obligatoires.',
    en: 'Please fill in all required fields.'
  },
  'auth.answerRequiredError': {
    mg: 'Valio azafady: "{question}"',
    fr: 'Veuillez répondre : « {question} »',
    en: 'Please answer: "{question}"'
  },
  'auth.successTitle': {
    mg: 'Voasoratra soa aman-tsara!',
    fr: 'Inscription réussie !',
    en: 'Registration successful!'
  },
  'auth.successActiveMessage': {
    mg: "Miasa avy hatrany ny kaonty nao: ampidiro ny solonanarana sy ny tenimiafina nao hiditra. Ny Mpandrindra no hamarina ny dosienao taty aoriana.",
    fr: "Votre compte est déjà actif : connectez-vous immédiatement avec votre nom d'utilisateur et votre mot de passe. L'Admin vérifiera votre dossier après votre première connexion.",
    en: "Your account is already active: connect immediately with your username and password. The Admin will review your file after your first sign-in."
  },
  'auth.memberCodeLabel': {
    mg: 'Kaody maha-mpikambana anao',
    fr: 'Votre code de membre',
    en: 'Your member code'
  },
  'auth.enterAccount': {
    mg: 'Miditra amin\u2019ny kaonty izao',
    fr: 'Accéder à mon compte',
    en: 'Go to my account'
  },
  'auth.backToLogin': {
    mg: "Hiverina any amin'ny Fidirana",
    fr: 'Retour à la connexion',
    en: 'Back to login'
  },
  'auth.step1.label': { mg: '1', fr: '1', en: '1' },
  'auth.step1.title': {
    mg: 'Voalohany',
    fr: 'Étape 1 : Informations personnelles',
    en: 'Step 1: Personal information'
  },
  'auth.step2.label': { mg: '2', fr: '2', en: '2' },
  'auth.step2.title': {
    mg: '2',
    fr: 'Étape 2 : Contact & mot de passe',
    en: 'Step 2: Contact & password'
  },
  'auth.step3.label': { mg: '3', fr: '3', en: '3' },
  'auth.step3.title': {
    mg: '3',
    fr: 'Étape 3 : Questions d’inscription',
    en: 'Step 3: Registration questions'
  },
  'auth.step4.label': { mg: '4', fr: '4', en: '4' },
  'auth.step4.title': {
    mg: '4',
    fr: 'Étape 4 : Récapitulatif & validation',
    en: 'Step 4: Summary & validation'
  }
};
