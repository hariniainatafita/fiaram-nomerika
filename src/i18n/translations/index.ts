import type { TranslationDictionary } from '../types';
import { common } from './common';
import { navigation } from './navigation';
import { auth } from './auth';
import { dashboard } from './dashboard';
import { presence } from './presence';
import { cotisations } from './cotisations';
import { finance } from './finance';
import { resources } from './resources';
import { chat } from './chat';
import { groups } from './groups';
import { events } from './events';
import { publications } from './publications';
import { profile } from './profile';
import { admin } from './admin';
import { badges } from './badges';
import { settings } from './settings';
import { scanner } from './scanner';

export const translations: TranslationDictionary = {
  ...common,
  ...navigation,
  ...auth,
  ...dashboard,
  ...presence,
  ...cotisations,
  ...finance,
  ...resources,
  ...chat,
  ...groups,
  ...events,
  ...publications,
  ...profile,
  ...admin,
  ...badges,
  ...settings,
  ...scanner
};
