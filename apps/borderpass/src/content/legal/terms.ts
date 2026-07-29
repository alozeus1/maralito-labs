/**
 * ============================ LEGAL REVIEW REQUIRED ============================
 * TERMS OF SERVICE — TEMPLATE ONLY. Written by engineers so the product has a legal surface to
 * point at; it is NOT legal advice and has NOT been reviewed by a qualified lawyer for Mexican
 * (LFPDPPP, Ley Federal de Protección al Consumidor) or U.S. requirements. It makes no claim of
 * compliance with any specific law.
 *
 * Every `[ ... ]` marker below is an UNRESOLVED placeholder that counsel + the business owner must
 * fill in before real users are onboarded — legal entity, governing law/venue, liability cap,
 * refund windows, and the prohibited-items list all need review against U.S. export rules and
 * Mexican import rules (SAT/Aduanas).
 *
 * Bump TERMS_VERSION whenever the substance changes: consent records store the version the user
 * actually accepted, so a new version means users must re-accept.
 * ==============================================================================
 */
import type { LegalDocumentByLocale } from './types';

export const TERMS_VERSION = 'terms-2026-07-28';
const LAST_UPDATED = '2026-07-28';

const REVIEW_NOTICE_ES =
  'Borrador pendiente de revisión legal. Este texto es una plantilla y aún no ha sido revisado por un abogado; no constituye asesoría legal. No debe publicarse a usuarios reales sin revisión y aprobación legal.';
const REVIEW_NOTICE_EN =
  'Draft pending legal review. This text is a template and has not been reviewed by a qualified lawyer; it is not legal advice. It must not be published to real users without legal review and sign-off.';

export const TERMS: LegalDocumentByLocale = {
  es: {
    kind: 'terms',
    version: TERMS_VERSION,
    locale: 'es',
    title: 'Términos del Servicio',
    lastUpdated: LAST_UPDATED,
    summary:
      'BorderPass es un servicio de concierge de compras transfronterizas: compramos o recibimos artículos en Estados Unidos, los inspeccionamos, gestionamos el cruce y los entregamos en Ciudad Juárez.',
    reviewNotice: REVIEW_NOTICE_ES,
    sections: [
      {
        id: 'who-we-are',
        heading: '1. Quiénes somos',
        paragraphs: [
          'BorderPass es operado por [RAZÓN SOCIAL / ENTIDAD LEGAL PENDIENTE], con domicilio en [DOMICILIO LEGAL PENDIENTE] ("BorderPass", "nosotros").',
          'Al crear una cuenta o usar el servicio, aceptas estos Términos y el Aviso de Privacidad. Si no estás de acuerdo, no uses el servicio.',
        ],
      },
      {
        id: 'the-service',
        heading: '2. El servicio',
        paragraphs: [
          'BorderPass actúa como concierge y gestor logístico. Según el servicio que elijas, podemos: comprar un artículo por ti en una tienda de Estados Unidos, recibir un paquete a tu nombre en nuestra dirección en El Paso, recogerlo localmente, o coordinar entregas empresariales.',
          'Después recibimos e inspeccionamos el artículo, gestionamos el cruce fronterizo y lo entregamos en Ciudad Juárez.',
          'BorderPass no es el vendedor ni el fabricante del artículo. Las garantías, defectos de fábrica y políticas de devolución corresponden a la tienda o al fabricante, salvo por el daño que ocurra bajo nuestra custodia.',
        ],
      },
      {
        id: 'accounts',
        heading: '3. Tu cuenta',
        paragraphs: [
          'Debes tener al menos 18 años y capacidad legal para contratar. Eres responsable de la actividad realizada desde tu cuenta y de mantener el acceso a tu correo electrónico, que usamos para iniciar sesión.',
          'Debes darnos información veraz y actualizada, incluida la dirección de entrega. Podemos suspender una cuenta cuando exista sospecha razonable de fraude, suplantación o uso indebido del servicio.',
        ],
      },
      {
        id: 'requests-and-quotes',
        heading: '4. Solicitudes y cotizaciones',
        paragraphs: [
          'Cuando envías una solicitud, preparamos una cotización que detalla el valor del artículo, nuestra tarifa de servicio, la entrega y los aranceles e impuestos estimados.',
          'Una cotización es una oferta con vigencia limitada y expira en la fecha indicada. No existe contrato de compra hasta que aceptas la cotización y el pago se completa.',
          'Los aranceles e impuestos son ESTIMADOS. Si la autoridad aduanera determina un monto distinto, te informaremos antes de continuar; podría requerirse un cargo adicional o la cancelación de la solicitud.',
        ],
      },
      {
        id: 'payment',
        heading: '5. Pagos',
        paragraphs: [
          'Los pagos con tarjeta son procesados por Stripe. BorderPass nunca ve ni almacena el número completo de tu tarjeta, el CVV ni la fecha de expiración.',
          'Al aceptar una cotización autorizas el cargo por el monto total mostrado. Los cargos se realizan en [MONEDA DE COBRO PENDIENTE].',
          'Si tu banco rechaza el cargo o revierte el pago, podemos detener o cancelar la solicitud.',
        ],
      },
      {
        id: 'cancellations-refunds',
        heading: '6. Cancelaciones, reembolsos y aclaraciones',
        paragraphs: [
          'Puedes cancelar sin costo mientras no hayamos comprado o recibido el artículo. Después de la compra, la cancelación puede estar sujeta a la política de la tienda de origen y a costos ya incurridos.',
          'Si el artículo no puede cruzar la frontera por una restricción legal, o si llega dañado bajo nuestra custodia, evaluaremos el caso y te informaremos las opciones disponibles.',
          '[VENTANA DE REEMBOLSO, MONTOS NO REEMBOLSABLES Y PROCEDIMIENTO DE ACLARACIÓN — PENDIENTE DE DEFINICIÓN LEGAL Y DE NEGOCIO.]',
        ],
      },
      {
        id: 'prohibited-items',
        heading: '7. Artículos restringidos y prohibidos',
        paragraphs: [
          'No transportamos artículos cuya importación o exportación esté restringida o prohibida. Esta lista es enunciativa, no limitativa, y está sujeta a revisión legal frente a la normativa de EE. UU. y de México.',
          'Si detectamos un artículo restringido durante la inspección, detendremos el proceso y te explicaremos la situación antes de continuar. Declarar falsamente el contenido o el valor de un artículo puede constituir un delito y es causa de terminación inmediata del servicio.',
        ],
        bullets: [
          'Armas de fuego, municiones, explosivos, fuegos artificiales y sus componentes.',
          'Drogas ilícitas, precursores químicos y parafernalia relacionada.',
          'Medicamentos controlados o de prescripción sin la autorización correspondiente.',
          'Alcohol y tabaco (sujetos a permisos e impuestos especiales).',
          'Dinero en efectivo, instrumentos negociables al portador, metales y piedras preciosas.',
          'Animales vivos, plantas, semillas y productos agrícolas o cárnicos regulados.',
          'Productos falsificados o que infrinjan derechos de propiedad intelectual.',
          'Materiales peligrosos, inflamables, corrosivos, radiactivos y baterías de litio sueltas.',
          'Contenido para adultos, material ilegal y bienes de uso dual sujetos a control de exportación.',
          '[LISTA COMPLETA PENDIENTE DE VALIDACIÓN CON UN AGENTE ADUANAL Y CON ASESORÍA LEGAL.]',
        ],
      },
      {
        id: 'inspection-and-delivery',
        heading: '8. Inspección, cruce y entrega',
        paragraphs: [
          'Inspeccionamos cada artículo antes del cruce para verificar su estado y su elegibilidad. Podemos abrir paquetes con este fin y documentar el estado del artículo.',
          'Los tiempos de entrega son estimados. Retrasos aduanales, revisiones oficiales, clima o cierres de puentes internacionales pueden afectarlos y están fuera de nuestro control.',
          'La entrega se realiza en la dirección que nos proporcionaste en Ciudad Juárez. Si nadie puede recibir el artículo, coordinaremos un nuevo intento; los intentos adicionales pueden generar un costo.',
        ],
      },
      {
        id: 'your-responsibilities',
        heading: '9. Tus responsabilidades',
        paragraphs: [
          'Declaras que los artículos que solicitas son de lícita procedencia y para uso propio, obsequio o negocio legítimo, y que la información que nos proporcionas es veraz.',
          'Eres responsable de los impuestos o contribuciones que legalmente te correspondan y que no estén incluidos en la cotización.',
        ],
      },
      {
        id: 'limitation-of-liability',
        heading: '10. Limitación de responsabilidad',
        paragraphs: [
          '[SECCIÓN PENDIENTE DE REDACCIÓN POR ASESORÍA LEGAL.] Esta sección debe definir, entre otros: el límite máximo de responsabilidad de BorderPass (por ejemplo, el valor declarado del artículo o el monto pagado por el servicio), la exclusión de daños indirectos, y la cobertura aplicable a pérdida o daño bajo nuestra custodia.',
          'Nota: la legislación mexicana de protección al consumidor limita la validez de ciertas exclusiones de responsabilidad. Esta sección NO puede publicarse sin revisión legal.',
        ],
      },
      {
        id: 'suspension',
        heading: '11. Suspensión y terminación',
        paragraphs: [
          'Podemos suspender o terminar el servicio ante uso fraudulento, declaración falsa de contenido o valor, intento de mover artículos prohibidos, o incumplimiento de estos Términos.',
          'Puedes dejar de usar el servicio y solicitar la eliminación de tu cuenta en cualquier momento, sujeto a las obligaciones de conservación descritas en el Aviso de Privacidad.',
        ],
      },
      {
        id: 'changes',
        heading: '12. Cambios a estos Términos',
        paragraphs: [
          'Podemos actualizar estos Términos. Cada versión tiene un identificador y una fecha. Cuando el cambio sea sustancial, te pediremos aceptar la nueva versión antes de continuar usando el servicio, y registraremos esa aceptación.',
        ],
      },
      {
        id: 'governing-law',
        heading: '13. Ley aplicable y jurisdicción',
        paragraphs: [
          '[PENDIENTE DE DEFINICIÓN LEGAL.] Debe especificarse la ley aplicable y la jurisdicción competente (por ejemplo, los tribunales de [CIUDAD/ESTADO PENDIENTE], México), así como la referencia a los mecanismos de conciliación ante la autoridad de protección al consumidor cuando corresponda.',
        ],
      },
      {
        id: 'contact',
        heading: '14. Contacto',
        paragraphs: [
          '¿Dudas sobre estos Términos? Escríbenos a support@maralito.uk o desde la sección Mensajes de la aplicación.',
        ],
      },
    ],
  },
  en: {
    kind: 'terms',
    version: TERMS_VERSION,
    locale: 'en',
    title: 'Terms of Service',
    lastUpdated: LAST_UPDATED,
    summary:
      'BorderPass is a cross-border shopping concierge: we buy or receive items in the United States, inspect them, handle the border crossing, and deliver in Ciudad Juárez.',
    reviewNotice: REVIEW_NOTICE_EN,
    sections: [
      {
        id: 'who-we-are',
        heading: '1. Who we are',
        paragraphs: [
          'BorderPass is operated by [LEGAL ENTITY NAME PENDING], with its registered address at [REGISTERED ADDRESS PENDING] ("BorderPass", "we", "us").',
          'By creating an account or using the service you accept these Terms and the Privacy Notice. If you do not agree, do not use the service.',
        ],
      },
      {
        id: 'the-service',
        heading: '2. The service',
        paragraphs: [
          'BorderPass acts as a concierge and logistics coordinator. Depending on the service you choose, we may purchase an item for you from a U.S. store, receive a package on your behalf at our El Paso address, pick it up locally, or coordinate business deliveries.',
          'We then receive and inspect the item, handle the border crossing, and deliver it in Ciudad Juárez.',
          'BorderPass is not the seller or manufacturer of the item. Warranties, manufacturing defects, and return policies remain with the store or manufacturer, except for damage occurring while the item is in our custody.',
        ],
      },
      {
        id: 'accounts',
        heading: '3. Your account',
        paragraphs: [
          'You must be at least 18 and legally able to enter into a contract. You are responsible for activity carried out from your account and for retaining access to the email address we use to sign you in.',
          'You must give us accurate, current information, including your delivery address. We may suspend an account where there is a reasonable suspicion of fraud, impersonation, or misuse of the service.',
        ],
      },
      {
        id: 'requests-and-quotes',
        heading: '4. Requests and quotes',
        paragraphs: [
          'When you submit a request we prepare a quote itemizing the item value, our service fee, delivery, and estimated duties and taxes.',
          'A quote is a time-limited offer and expires on the date shown. No purchase contract exists until you accept the quote and payment completes.',
          'Duties and taxes are ESTIMATES. If the customs authority assesses a different amount we will tell you before continuing; an additional charge or cancellation of the request may be required.',
        ],
      },
      {
        id: 'payment',
        heading: '5. Payment',
        paragraphs: [
          'Card payments are processed by Stripe. BorderPass never sees or stores your full card number, CVV, or expiry date.',
          'By accepting a quote you authorize a charge for the total shown. Charges are made in [BILLING CURRENCY PENDING].',
          'If your bank declines the charge or reverses the payment, we may pause or cancel the request.',
        ],
      },
      {
        id: 'cancellations-refunds',
        heading: '6. Cancellations, refunds, and disputes',
        paragraphs: [
          'You may cancel at no cost while we have not yet purchased or received the item. After purchase, cancellation may be subject to the originating store’s policy and to costs already incurred.',
          'If an item cannot cross the border because of a legal restriction, or arrives damaged while in our custody, we will review the case and explain the available options.',
          '[REFUND WINDOW, NON-REFUNDABLE AMOUNTS, AND DISPUTE PROCEDURE — PENDING LEGAL AND BUSINESS DEFINITION.]',
        ],
      },
      {
        id: 'prohibited-items',
        heading: '7. Restricted and prohibited items',
        paragraphs: [
          'We do not carry items whose import or export is restricted or prohibited. This list is illustrative, not exhaustive, and is subject to legal review against U.S. and Mexican rules.',
          'If we identify a restricted item during inspection we will stop and explain the situation before continuing. Misdeclaring the contents or value of an item may be a criminal offence and is grounds for immediate termination of service.',
        ],
        bullets: [
          'Firearms, ammunition, explosives, fireworks, and their components.',
          'Illicit drugs, chemical precursors, and related paraphernalia.',
          'Controlled or prescription medicines without the required authorization.',
          'Alcohol and tobacco (subject to permits and excise taxes).',
          'Cash, bearer negotiable instruments, precious metals and stones.',
          'Live animals, plants, seeds, and regulated agricultural or meat products.',
          'Counterfeit goods or anything infringing intellectual property rights.',
          'Hazardous, flammable, corrosive, or radioactive materials and loose lithium batteries.',
          'Adult content, illegal material, and export-controlled dual-use goods.',
          '[FULL LIST PENDING VALIDATION WITH A LICENSED CUSTOMS BROKER AND LEGAL COUNSEL.]',
        ],
      },
      {
        id: 'inspection-and-delivery',
        heading: '8. Inspection, crossing, and delivery',
        paragraphs: [
          'We inspect every item before crossing to verify its condition and eligibility. We may open packages for this purpose and document the item’s condition.',
          'Delivery times are estimates. Customs delays, official inspections, weather, or international bridge closures may affect them and are outside our control.',
          'Delivery is made to the address you gave us in Ciudad Juárez. If no one can receive the item we will arrange another attempt; additional attempts may incur a fee.',
        ],
      },
      {
        id: 'your-responsibilities',
        heading: '9. Your responsibilities',
        paragraphs: [
          'You represent that the items you request are lawfully sourced and intended for personal, gift, or legitimate business use, and that the information you give us is accurate.',
          'You are responsible for any taxes or duties legally payable by you that are not included in the quote.',
        ],
      },
      {
        id: 'limitation-of-liability',
        heading: '10. Limitation of liability',
        paragraphs: [
          '[SECTION PENDING DRAFTING BY LEGAL COUNSEL.] This section must define, among other things: BorderPass’s maximum liability cap (for example, the declared value of the item or the amount paid for the service), the exclusion of indirect damages, and the coverage that applies to loss or damage in our custody.',
          'Note: Mexican consumer protection law limits the enforceability of certain liability exclusions. This section MUST NOT be published without legal review.',
        ],
      },
      {
        id: 'suspension',
        heading: '11. Suspension and termination',
        paragraphs: [
          'We may suspend or terminate the service for fraudulent use, misdeclaration of contents or value, attempts to move prohibited items, or breach of these Terms.',
          'You may stop using the service and request deletion of your account at any time, subject to the retention obligations described in the Privacy Notice.',
        ],
      },
      {
        id: 'changes',
        heading: '12. Changes to these Terms',
        paragraphs: [
          'We may update these Terms. Every version carries an identifier and a date. Where a change is material we will ask you to accept the new version before continuing to use the service, and we will record that acceptance.',
        ],
      },
      {
        id: 'governing-law',
        heading: '13. Governing law and venue',
        paragraphs: [
          '[PENDING LEGAL DEFINITION.] The governing law and competent venue must be specified (for example, the courts of [CITY/STATE PENDING], Mexico), together with any reference to consumer-protection conciliation mechanisms where applicable.',
        ],
      },
      {
        id: 'contact',
        heading: '14. Contact',
        paragraphs: [
          'Questions about these Terms? Email support@maralito.uk or message us from the Messages section of the app.',
        ],
      },
    ],
  },
};
