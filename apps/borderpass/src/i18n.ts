// Bilingual (EN/ES) dictionary. Spanish is the primary audience (DESIGN.md), so it's the default
// locale. Values are plain strings so they can cross the server→client boundary (passed as props
// to client components). Order/inspection status chip labels come from humanizeStatus and remain
// English for now (short technical labels) — a separate follow-up.
export const LOCALES = ['es', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'es';
export const LOCALE_COOKIE = 'bp_locale';

export const isLocale = (v: string | undefined): v is Locale =>
  !!v && (LOCALES as readonly string[]).includes(v);

const MESSAGES = {
  es: {
    common: { back: 'Atrás', edit: 'Editar', continue: 'Continuar' },
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
    orders: {
      title: 'Tus pedidos',
      newRequest: 'Nueva solicitud',
      unavailable: 'Los pedidos no están disponibles ahora — inténtalo de nuevo en un momento.',
      empty: 'Aún no hay pedidos',
      emptyBody:
        'Inicia una solicitud y prepararemos una cotización para tu entrega transfronteriza.',
    },
    orderDetail: {
      journey: 'Recorrido',
      quote: 'Cotización',
      payment: 'Pago',
      inspection: 'Inspección',
      delivery: 'Entrega',
      total: 'Total',
      validUntil: 'Válido hasta',
      opened: 'Abierto',
      inProgress: 'En progreso',
      noQuote: 'Aún no hay cotización — prepararemos una para este pedido y aparecerá aquí.',
      pay: 'Pagar',
      declined: 'Rechazaste esta cotización. Si algo cambia, contáctanos y prepararemos una nueva.',
      milestones: {
        placed: 'Pedido realizado',
        paid: 'Pago recibido',
        purchased: 'Comprado',
        received: 'Recibido en El Paso',
        inspection: 'Inspección',
        crossing: 'Cruce fronterizo',
        customs: 'Aduana',
        delivery: 'En reparto',
        delivered: 'Entregado',
      },
    },
    newRequest: {
      title: 'Nueva solicitud',
      subtitle: 'Dinos qué cruzar y prepararemos una cotización.',
      cancel: 'Cancelar',
      continue: 'Continuar',
      edit: 'Editar',
      chooseService: 'Elige un servicio',
      productDetails: 'Detalles del producto',
      borderInfo: 'Información fronteriza',
      whatMoving: '¿Qué vamos a mover?',
      whatMovingPlaceholder: 'p. ej. Nike Air Max, talla 10',
      productLink: 'Enlace del producto (opcional)',
      quantity: 'Cantidad',
      itemValueUsd: 'Valor del artículo (USD)',
      purpose: 'Propósito',
      addressNote:
        'Recopilaremos tu dirección de entrega de forma segura cuando tu cotización esté lista — aún no se guarda ninguna dirección.',
      review: 'Revisar solicitud',
      creating: 'Creando solicitud…',
      requestSummary: 'Resumen de la solicitud',
      orderPending: 'Pedido #PENDIENTE',
      service: 'Servicio',
      itemValue: 'Valor del artículo',
      estDuties: 'Aranceles estimados',
      pending: 'Pendiente',
      estTotal: 'Total estimado',
      error: 'No pudimos iniciar tu solicitud. Revisa los datos e inténtalo de nuevo.',
      services: {
        buy_for_me: {
          title: 'Compra por mí',
          desc: 'Compramos el artículo por ti y nos encargamos del resto.',
        },
        package_reception: {
          title: 'Recepción de paquetes',
          desc: 'Envía tus artículos a nuestra dirección en EE. UU. para resguardo seguro.',
        },
        local_pickup: {
          title: 'Recogida local',
          desc: 'Recogemos tu artículo de una tienda local o particular.',
        },
        business_delivery: {
          title: 'Entrega empresarial',
          desc: 'Recepción de carga y tarimas para entidades comerciales.',
        },
      },
      purposes: { personal: 'Personal', gift: 'Regalo', business: 'Negocio', resale: 'Reventa' },
    },
    profile: {
      title: 'Perfil',
      yourDetails: 'Tus datos',
      name: 'Nombre',
      namePlaceholder: '¿Cómo te llamamos?',
      language: 'Idioma',
      notifications: 'Notificaciones',
      notificationsBody: '¿Cómo debemos avisarte sobre tus pedidos?',
      save: 'Guardar cambios',
      saving: 'Guardando…',
      saved: 'Guardado',
      saveError: 'No se pudieron guardar los cambios. Inténtalo de nuevo.',
      channels: { email: 'Correo', whatsapp: 'WhatsApp', sms: 'SMS', in_app: 'En la app' },
    },
    support: {
      title: 'Soporte',
      subtitle: 'Respuestas a preguntas comunes sobre cruces, aduanas y entregas.',
      stillNeedHelp: '¿Aún necesitas ayuda?',
      stillNeedHelpBody: 'Contacta a nuestro equipo de concierge y te responderemos.',
      emailSupport: 'Enviar correo a soporte',
      faq: [
        {
          q: '¿Cómo funciona una solicitud transfronteriza?',
          a: 'Inicia una solicitud y preparamos una cotización que cubre el artículo, nuestra tarifa de servicio y los aranceles estimados. Una vez que aceptas y pagas, compramos o recibimos el artículo, lo inspeccionamos en El Paso, gestionamos el cruce fronterizo y lo entregamos en Juárez.',
        },
        {
          q: '¿Cuánto tarda la entrega?',
          a: 'La mayoría de los pedidos cruzan la frontera y llegan a Juárez pocos días después de la inspección. El Recorrido de tu pedido muestra la etapa actual y lo que sigue.',
        },
        {
          q: '¿Cuáles son las tarifas?',
          a: 'Cada cotización detalla la tarifa de servicio, la entrega, la inspección y los aranceles estimados antes de pagar. No se cobra nada hasta que aceptas una cotización.',
        },
        {
          q: '¿Es seguro mi pago?',
          a: 'Los pagos son procesados por Stripe. Nunca vemos ni almacenamos los datos completos de tu tarjeta.',
        },
        {
          q: '¿Qué artículos pueden cruzar?',
          a: 'La mayoría de los productos minoristas para uso personal, regalo o negocio. Los artículos restringidos o prohibidos se señalan durante la revisión, y te explicaremos cualquier problema antes de cobrarte.',
        },
      ],
    },
    messages: {
      title: 'Mensajes',
      subtitle: 'Tu concierge gestiona tu cruce fronterizo y entrega de principio a fin.',
      conciergeTeam: 'Tu equipo de concierge',
      speaks: 'Habla inglés y español',
      reach: '¿Tienes una pregunta sobre un pedido? Escríbenos aquí y tu concierge te responderá.',
      email: 'Correo',
      placeholder: 'Escribe un mensaje…',
      send: 'Enviar',
      emptyThread: 'Aún no hay mensajes. Envía el primero y tu concierge te responderá.',
      sendError: 'No se pudo enviar. Inténtalo de nuevo.',
    },
  },
  en: {
    common: { back: 'Back', edit: 'Edit', continue: 'Continue' },
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
    orders: {
      title: 'Your orders',
      newRequest: 'New request',
      unavailable: 'Orders aren’t available right now — please try again shortly.',
      empty: 'No orders yet',
      emptyBody: 'Start a request and we’ll prepare a quote for your cross-border delivery.',
    },
    orderDetail: {
      journey: 'Journey',
      quote: 'Quote',
      payment: 'Payment',
      inspection: 'Inspection',
      delivery: 'Delivery',
      total: 'Total',
      validUntil: 'Valid until',
      opened: 'Opened',
      inProgress: 'In progress',
      noQuote: 'No quote yet — we’ll prepare one for this order and it will appear here.',
      pay: 'Pay',
      declined:
        'You declined this quote. If anything changes, contact us and we’ll prepare a new one.',
      milestones: {
        placed: 'Order placed',
        paid: 'Payment received',
        purchased: 'Purchased',
        received: 'Received in El Paso',
        inspection: 'Inspection',
        crossing: 'Border crossing',
        customs: 'Customs',
        delivery: 'Out for delivery',
        delivered: 'Delivered',
      },
    },
    newRequest: {
      title: 'New Request',
      subtitle: 'Tell us what to bring across and we’ll prepare a quote.',
      cancel: 'Cancel',
      continue: 'Continue',
      edit: 'Edit',
      chooseService: 'Choose Service',
      productDetails: 'Product Details',
      borderInfo: 'Border Information',
      whatMoving: 'What are we moving?',
      whatMovingPlaceholder: 'e.g. Nike Air Max, size 10',
      productLink: 'Product link (optional)',
      quantity: 'Quantity',
      itemValueUsd: 'Item value (USD)',
      purpose: 'Purpose',
      addressNote:
        'We’ll collect your delivery address securely when your quote is ready — no address is stored yet.',
      review: 'Review Request',
      creating: 'Creating request…',
      requestSummary: 'Request Summary',
      orderPending: 'Order #PENDING',
      service: 'Service',
      itemValue: 'Item value',
      estDuties: 'Est. import duties',
      pending: 'Pending',
      estTotal: 'Est. Total',
      error: 'We couldn’t start your request. Please check the details and try again.',
      services: {
        buy_for_me: {
          title: 'Buy for Me',
          desc: 'We purchase the item on your behalf and handle the rest.',
        },
        package_reception: {
          title: 'Package Reception',
          desc: 'Ship your items to our US address for secure hold.',
        },
        local_pickup: {
          title: 'Local Pickup',
          desc: 'We pick up your item from a local store or individual.',
        },
        business_delivery: {
          title: 'Business Delivery',
          desc: 'Freight and pallet reception for commercial entities.',
        },
      },
      purposes: { personal: 'Personal', gift: 'Gift', business: 'Business', resale: 'Resale' },
    },
    profile: {
      title: 'Profile',
      yourDetails: 'Your details',
      name: 'Name',
      namePlaceholder: 'How should we address you?',
      language: 'Language',
      notifications: 'Notifications',
      notificationsBody: 'How should we reach you about orders?',
      save: 'Save changes',
      saving: 'Saving…',
      saved: 'Saved',
      saveError: 'Couldn’t save your changes. Please try again.',
      channels: { email: 'Email', whatsapp: 'WhatsApp', sms: 'SMS', in_app: 'In-app' },
    },
    support: {
      title: 'Support',
      subtitle: 'Answers to common questions about crossings, customs, and delivery.',
      stillNeedHelp: 'Still need help?',
      stillNeedHelpBody: 'Reach our concierge team and we’ll get back to you.',
      emailSupport: 'Email support',
      faq: [
        {
          q: 'How does a cross-border request work?',
          a: 'Start a request, we prepare a quote covering the item, our service fee, and estimated duties. Once you accept and pay, we purchase or receive the item, inspect it in El Paso, handle the border crossing, and deliver it in Juárez.',
        },
        {
          q: 'How long does delivery take?',
          a: 'Most orders clear the border and reach Juárez within a few days of inspection. Your order’s Journey timeline shows the current stage and what’s next.',
        },
        {
          q: 'What are the fees?',
          a: 'Each quote itemizes the service fee, delivery, inspection, and estimated import duties before you pay. Nothing is charged until you accept a quote.',
        },
        {
          q: 'Is my payment secure?',
          a: 'Payments are processed by Stripe. We never see or store your full card details.',
        },
        {
          q: 'Which items can you bring across?',
          a: 'Most retail goods for personal, gift, or business use. Restricted or prohibited items are flagged during review, and we’ll explain any issue before charging you.',
        },
      ],
    },
    messages: {
      title: 'Messages',
      subtitle: 'Your concierge manages your border crossing and delivery end to end.',
      conciergeTeam: 'Your concierge team',
      speaks: 'Speaks English & Español',
      reach: 'Have a question about an order? Message us here and your concierge will reply.',
      email: 'Email',
      placeholder: 'Type a message…',
      send: 'Send',
      emptyThread: 'No messages yet. Send the first one and your concierge will reply.',
      sendError: 'Couldn’t send. Please try again.',
    },
  },
} as const;

export type Messages = (typeof MESSAGES)[Locale];

export function getMessages(locale: Locale): Messages {
  return MESSAGES[locale];
}
