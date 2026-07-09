// Lightweight bilingual (EN/ES) dictionary. Spanish is the primary audience (DESIGN.md), so it's
// the default locale. Covers the first-run + shell surfaces (welcome, nav, Home); deeper pages are
// translated in follow-ups. Values are plain strings so they can cross the server→client boundary.
export const LOCALES = ['es', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'es';
export const LOCALE_COOKIE = 'bp_locale';

export const isLocale = (v: string | undefined): v is Locale =>
  !!v && (LOCALES as readonly string[]).includes(v);

const MESSAGES = {
  es: {
    nav: {
      home: 'Inicio',
      orders: 'Pedidos',
      messages: 'Mensajes',
      support: 'Soporte',
      profile: 'Perfil',
      signOut: 'Cerrar sesión',
    },
    home: {
      greeting: 'Hola',
      subtitle: '¿Qué podemos ayudarte a cruzar hoy?',
      activeDelivery: 'Entrega activa',
      ourServices: 'Nuestros servicios',
      noActive: 'Sin entregas activas',
      noActiveBody: 'Inicia una solicitud abajo y la cruzamos por ti.',
      trackDetails: 'Ver detalles',
    },
    welcome: {
      tagline: 'Tu puente de confianza entre EE. UU. y México.',
      blurb:
        'Compras, recepción, cruce fronterizo y entrega en Juárez — con el cuidado de un concierge.',
      getStarted: 'Comenzar',
    },
  },
  en: {
    nav: {
      home: 'Home',
      orders: 'Orders',
      messages: 'Messages',
      support: 'Support',
      profile: 'Profile',
      signOut: 'Sign out',
    },
    home: {
      greeting: 'Hello',
      subtitle: 'What can we help you bring across today?',
      activeDelivery: 'Active Delivery',
      ourServices: 'Our Services',
      noActive: 'No active deliveries',
      noActiveBody: 'Start a request below and we’ll bring it across for you.',
      trackDetails: 'Track Details',
    },
    welcome: {
      tagline: 'Your trusted bridge between the U.S. and Mexico.',
      blurb: 'Shopping, receiving, border crossing, and delivery in Juárez — with concierge care.',
      getStarted: 'Get started',
    },
  },
} as const;

export type Messages = (typeof MESSAGES)[Locale];

export function getMessages(locale: Locale): Messages {
  return MESSAGES[locale];
}
