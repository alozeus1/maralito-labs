/**
 * ============================ LEGAL REVIEW REQUIRED ============================
 * PRIVACY NOTICE (Aviso de Privacidad) — TEMPLATE ONLY. Written by engineers so the product has a
 * privacy surface to point at; it is NOT legal advice and has NOT been reviewed by a qualified
 * lawyer. It makes no claim of compliance with the LFPDPPP, its Reglamento, the Lineamientos del
 * Aviso de Privacidad, or any U.S. state privacy law.
 *
 * In particular, an "aviso de privacidad integral" under Mexican law has mandatory content
 * requirements (identity and address of the responsable, purposes separated into primary vs
 * secondary, transfers requiring consent, the exact ARCO procedure and response timelines, means to
 * revoke consent, and how changes are communicated). The wording below GESTURES at those items; a
 * lawyer must confirm each one. Every `[ ... ]` marker is an unresolved placeholder.
 *
 * Engineering facts asserted here that MUST stay true (they are testable claims, not marketing):
 *  - Card data is handled by Stripe and never stored by BorderPass.
 *  - Delivery address / contact PII is stored encrypted (envelope encryption, see src/server/kms.ts
 *    + src/domain/crypto/envelope.ts); real production KMS is still PENDING, so this notice must not
 *    go live until KMS is enabled.
 *  - Row-level security scopes every read to the owning customer.
 * If any of those stop being true, this copy becomes a false statement — update it in the same PR.
 *
 * Bump PRIVACY_VERSION whenever the substance changes; consent records store the accepted version.
 * ==============================================================================
 */
import type { LegalDocumentByLocale } from './types';

export const PRIVACY_VERSION = 'privacy-2026-07-28';
const LAST_UPDATED = '2026-07-28';

const REVIEW_NOTICE_ES =
  'Borrador pendiente de revisión legal. Este aviso es una plantilla y aún no ha sido revisado por un abogado; no constituye asesoría legal ni declara cumplimiento de la LFPDPPP. No debe publicarse a usuarios reales sin revisión y aprobación legal.';
const REVIEW_NOTICE_EN =
  'Draft pending legal review. This notice is a template and has not been reviewed by a qualified lawyer; it is not legal advice and does not claim compliance with any specific law. It must not be published to real users without legal review and sign-off.';

export const PRIVACY: LegalDocumentByLocale = {
  es: {
    kind: 'privacy',
    version: PRIVACY_VERSION,
    locale: 'es',
    title: 'Aviso de Privacidad',
    lastUpdated: LAST_UPDATED,
    summary:
      'Qué datos personales recopilamos para cruzar y entregar tus pedidos, para qué los usamos, cómo los protegemos y cómo puedes ejercer tus derechos ARCO.',
    reviewNotice: REVIEW_NOTICE_ES,
    sections: [
      {
        id: 'responsable',
        heading: '1. Responsable de tus datos personales',
        paragraphs: [
          '[RAZÓN SOCIAL / ENTIDAD LEGAL PENDIENTE] ("BorderPass"), con domicilio en [DOMICILIO LEGAL PENDIENTE], es responsable del tratamiento de tus datos personales.',
          'Puedes contactarnos en support@maralito.uk para cualquier asunto relacionado con tu privacidad.',
        ],
      },
      {
        id: 'what-we-collect',
        heading: '2. Qué datos recopilamos',
        paragraphs: [
          'Recopilamos únicamente los datos necesarios para prestar el servicio de compra, cruce y entrega:',
        ],
        bullets: [
          'Identidad: el nombre que eliges mostrar y el identificador interno de tu cuenta.',
          'Contacto: tu correo electrónico (lo usamos para iniciar sesión y para avisos del pedido) y, si lo proporcionas, tu número de teléfono.',
          'Dirección de entrega: calle, número, colonia, ciudad, código postal y referencias de entrega en Ciudad Juárez.',
          'Datos del pedido: el artículo solicitado, su valor declarado, el propósito, la cotización, el estado de la inspección y el estado de la entrega.',
          'Metadatos de pago: monto, moneda, estado del pago, últimos dígitos de la tarjeta e identificadores de la transacción provistos por Stripe.',
          'Datos de uso: idioma de la interfaz, registros técnicos de acceso y de seguridad.',
        ],
      },
      {
        id: 'card-data',
        heading: '3. Datos de tu tarjeta',
        paragraphs: [
          'Los pagos con tarjeta son procesados por Stripe, Inc. Los datos completos de tu tarjeta se envían directamente a Stripe: BorderPass NUNCA ve, recibe ni almacena el número completo de la tarjeta, el CVV ni la fecha de expiración.',
          'De Stripe conservamos únicamente identificadores y metadatos del cobro (monto, estado, marca de la tarjeta y últimos cuatro dígitos) para poder mostrarte tu historial y atender aclaraciones.',
        ],
      },
      {
        id: 'purposes',
        heading: '4. Para qué usamos tus datos',
        paragraphs: [
          'Finalidades primarias (necesarias para el servicio; sin ellas no podemos atenderte):',
        ],
        bullets: [
          'Crear y administrar tu cuenta y autenticarte.',
          'Preparar cotizaciones, procesar pagos y emitir comprobantes.',
          'Comprar, recibir, inspeccionar y entregar tus artículos.',
          'Cumplir con requisitos aduanales y con obligaciones legales, fiscales y contables.',
          'Enviarte mensajes transaccionales sobre TUS pedidos (cotización lista, pago recibido, inspección, entrega) y atender tus solicitudes de soporte.',
          'Prevenir fraude y proteger la seguridad del servicio.',
        ],
      },
      {
        id: 'secondary-purposes',
        heading: '5. Finalidades secundarias (opcionales)',
        paragraphs: [
          'Con tu consentimiento separado y expreso podemos enviarte comunicaciones de marketing, promociones y encuestas. Estas finalidades NO son necesarias para el servicio.',
          'Puedes negarte desde el inicio o retirar este consentimiento en cualquier momento sin que ello afecte la prestación del servicio, desde tu Perfil o escribiéndonos a support@maralito.uk.',
        ],
      },
      {
        id: 'sharing',
        heading: '6. Con quién compartimos tus datos',
        paragraphs: [
          'Compartimos datos únicamente con proveedores que nos permiten operar, y solo el mínimo necesario:',
        ],
        bullets: [
          'Stripe, Inc. — procesamiento de pagos.',
          'Proveedor de infraestructura y base de datos (alojamiento en Estados Unidos).',
          'Proveedor de envío de correo electrónico transaccional.',
          'Transportistas y agentes aduanales que participan en el cruce y la entrega.',
          'Autoridades competentes, cuando exista un requerimiento legal fundado y motivado.',
        ],
      },
      {
        id: 'transfers',
        heading: '7. Transferencias y almacenamiento fuera de México',
        paragraphs: [
          'Tus datos se almacenan y procesan en servidores ubicados en Estados Unidos, ya que la operación es transfronteriza por naturaleza.',
          '[REVISIÓN LEGAL PENDIENTE: determinar qué transferencias requieren tu consentimiento expreso y cuáles se ubican en los supuestos de excepción de la ley aplicable.]',
        ],
      },
      {
        id: 'security',
        heading: '8. Cómo protegemos tus datos',
        paragraphs: ['Aplicamos medidas técnicas y administrativas para proteger tus datos:'],
        bullets: [
          'Cifrado en tránsito (TLS) y cifrado en reposo de los datos sensibles como la dirección de entrega y el contacto, mediante cifrado de sobre con llaves gestionadas.',
          'Aislamiento por usuario a nivel de base de datos (row-level security): cada consulta queda limitada a los registros de la persona que la realiza.',
          'Acceso interno mínimo necesario: el personal de operación trabaja con referencias opacas del pedido y no con el contenido de tu dirección.',
          'Registro de auditoría de los accesos privilegiados.',
        ],
      },
      {
        id: 'retention',
        heading: '9. Cuánto tiempo conservamos tus datos',
        paragraphs: [
          'Conservamos tu cuenta y tus datos mientras la cuenta esté activa.',
          'Los registros de pedidos, pagos y comprobantes se conservan durante el plazo que exijan las obligaciones fiscales y contables aplicables — [PLAZO EXACTO PENDIENTE DE CONFIRMACIÓN LEGAL Y CONTABLE].',
          'Los registros de consentimiento se conservan como evidencia mientras exista la relación y durante el plazo de prescripción aplicable posterior.',
          'Al vencer estos plazos, los datos se eliminan o se anonimizan de forma irreversible.',
        ],
      },
      {
        id: 'arco-rights',
        heading: '10. Tus derechos ARCO',
        paragraphs: ['Conforme al marco mexicano de protección de datos, tienes derecho a:'],
        bullets: [
          'Acceso: saber qué datos tuyos tenemos y cómo los usamos.',
          'Rectificación: corregir datos inexactos o incompletos.',
          'Cancelación: solicitar que eliminemos tus datos cuando ya no sean necesarios.',
          'Oposición: oponerte al tratamiento de tus datos para finalidades específicas.',
          'Además: revocar tu consentimiento y limitar el uso o la divulgación de tus datos.',
        ],
      },
      {
        id: 'how-to-exercise',
        heading: '11. Cómo ejercer tus derechos',
        paragraphs: [
          'Envía tu solicitud a support@maralito.uk indicando: tu nombre y el correo asociado a tu cuenta, el derecho que deseas ejercer, y una descripción clara de los datos involucrados. Podremos pedirte acreditar tu identidad antes de responder.',
          'Responderemos dentro del plazo que establezca la ley aplicable — [PLAZO EXACTO Y PROCEDIMIENTO FORMAL PENDIENTES DE REVISIÓN LEGAL].',
          'La cancelación puede no proceder cuando exista una obligación legal de conservación (por ejemplo, registros fiscales de un pedido ya pagado); en ese caso te explicaremos el motivo.',
        ],
      },
      {
        id: 'cookies',
        heading: '12. Cookies y tecnologías similares',
        paragraphs: [
          'Usamos almacenamiento local y cookies estrictamente necesarias para mantener tu sesión iniciada y recordar tu preferencia de idioma.',
          '[SI SE INCORPORA ANALÍTICA O PUBLICIDAD, ESTA SECCIÓN DEBE ACTUALIZARSE Y REQUERIRÁ SU PROPIO MECANISMO DE CONSENTIMIENTO.]',
        ],
      },
      {
        id: 'children',
        heading: '13. Menores de edad',
        paragraphs: [
          'El servicio está dirigido a personas mayores de 18 años. No recopilamos intencionalmente datos de menores de edad.',
        ],
      },
      {
        id: 'changes',
        heading: '14. Cambios a este Aviso',
        paragraphs: [
          'Podemos actualizar este Aviso. Cada versión tiene un identificador y una fecha, y publicaremos la versión vigente en esta página. Cuando el cambio sea sustancial te lo notificaremos y, cuando corresponda, te pediremos aceptar la nueva versión.',
        ],
      },
      {
        id: 'contact',
        heading: '15. Contacto',
        paragraphs: [
          'Para dudas sobre este Aviso o sobre el tratamiento de tus datos: support@maralito.uk.',
        ],
      },
    ],
  },
  en: {
    kind: 'privacy',
    version: PRIVACY_VERSION,
    locale: 'en',
    title: 'Privacy Notice',
    lastUpdated: LAST_UPDATED,
    summary:
      'What personal data we collect to bring your orders across and deliver them, what we use it for, how we protect it, and how to exercise your ARCO rights.',
    reviewNotice: REVIEW_NOTICE_EN,
    sections: [
      {
        id: 'responsable',
        heading: '1. Who is responsible for your data',
        paragraphs: [
          '[LEGAL ENTITY NAME PENDING] ("BorderPass"), with its registered address at [REGISTERED ADDRESS PENDING], is the party responsible (responsable) for processing your personal data.',
          'You can reach us at support@maralito.uk about anything privacy-related.',
        ],
      },
      {
        id: 'what-we-collect',
        heading: '2. What we collect',
        paragraphs: ['We collect only what we need to buy, cross, and deliver your order:'],
        bullets: [
          'Identity: the display name you choose and your internal account identifier.',
          'Contact: your email address (used to sign you in and for order notices) and, if you provide it, your phone number.',
          'Delivery address: street, number, neighbourhood, city, postal code, and delivery references in Ciudad Juárez.',
          'Order data: the item requested, its declared value, the purpose, the quote, the inspection outcome, and delivery status.',
          'Payment metadata: amount, currency, payment status, card last four digits, and transaction identifiers provided by Stripe.',
          'Usage data: interface language, technical access and security logs.',
        ],
      },
      {
        id: 'card-data',
        heading: '3. Your card data',
        paragraphs: [
          'Card payments are processed by Stripe, Inc. Full card details go directly to Stripe: BorderPass NEVER sees, receives, or stores your full card number, CVV, or expiry date.',
          'From Stripe we keep only charge identifiers and metadata (amount, status, card brand, and last four digits) so we can show you your history and handle disputes.',
        ],
      },
      {
        id: 'purposes',
        heading: '4. What we use it for',
        paragraphs: [
          'Primary purposes (necessary to provide the service; without them we cannot serve you):',
        ],
        bullets: [
          'Creating and administering your account and authenticating you.',
          'Preparing quotes, processing payments, and issuing receipts.',
          'Buying, receiving, inspecting, and delivering your items.',
          'Meeting customs requirements and legal, tax, and accounting obligations.',
          'Sending you transactional messages about YOUR orders (quote ready, payment received, inspection, delivery) and answering your support requests.',
          'Preventing fraud and protecting the security of the service.',
        ],
      },
      {
        id: 'secondary-purposes',
        heading: '5. Secondary purposes (optional)',
        paragraphs: [
          'With your separate, express consent we may send you marketing communications, promotions, and surveys. These purposes are NOT necessary for the service.',
          'You may decline from the outset or withdraw this consent at any time without affecting the service, from your Profile or by emailing support@maralito.uk.',
        ],
      },
      {
        id: 'sharing',
        heading: '6. Who we share it with',
        paragraphs: [
          'We share data only with the providers that let us operate, and only the minimum needed:',
        ],
        bullets: [
          'Stripe, Inc. — payment processing.',
          'Infrastructure and database provider (hosted in the United States).',
          'Transactional email delivery provider.',
          'Carriers and customs brokers involved in the crossing and delivery.',
          'Competent authorities, where there is a valid and properly founded legal requirement.',
        ],
      },
      {
        id: 'transfers',
        heading: '7. Transfers and storage outside Mexico',
        paragraphs: [
          'Your data is stored and processed on servers located in the United States, since the operation is cross-border by nature.',
          '[LEGAL REVIEW PENDING: determine which transfers require your express consent and which fall within the statutory exceptions of the applicable law.]',
        ],
      },
      {
        id: 'security',
        heading: '8. How we protect your data',
        paragraphs: ['We apply technical and administrative measures to protect your data:'],
        bullets: [
          'Encryption in transit (TLS) and encryption at rest for sensitive data such as your delivery address and contact details, using envelope encryption with managed keys.',
          'Per-user isolation at the database level (row-level security): every query is confined to the records of the person making it.',
          'Least-privilege internal access: operations staff work with opaque order references, not the contents of your address.',
          'Audit logging of privileged access.',
        ],
      },
      {
        id: 'retention',
        heading: '9. How long we keep it',
        paragraphs: [
          'We keep your account and its data for as long as the account is active.',
          'Order, payment, and receipt records are kept for as long as applicable tax and accounting obligations require — [EXACT PERIOD PENDING LEGAL AND ACCOUNTING CONFIRMATION].',
          'Consent records are kept as evidence for the duration of the relationship and the applicable limitation period afterwards.',
          'Once those periods expire, data is deleted or irreversibly anonymized.',
        ],
      },
      {
        id: 'arco-rights',
        heading: '10. Your ARCO rights',
        paragraphs: ['Under the Mexican data protection framework you have the right to:'],
        bullets: [
          'Access: know what data we hold about you and how we use it.',
          'Rectification: correct inaccurate or incomplete data.',
          'Cancellation: ask us to delete your data when it is no longer needed.',
          'Opposition: object to the processing of your data for specific purposes.',
          'In addition: withdraw your consent and limit the use or disclosure of your data.',
        ],
      },
      {
        id: 'how-to-exercise',
        heading: '11. How to exercise your rights',
        paragraphs: [
          'Send your request to support@maralito.uk including: your name and the email associated with your account, the right you wish to exercise, and a clear description of the data involved. We may ask you to verify your identity before responding.',
          'We will respond within the period set by applicable law — [EXACT PERIOD AND FORMAL PROCEDURE PENDING LEGAL REVIEW].',
          'Deletion may not be possible where a legal retention obligation applies (for example, tax records for an order already paid); in that case we will explain why.',
        ],
      },
      {
        id: 'cookies',
        heading: '12. Cookies and similar technologies',
        paragraphs: [
          'We use local storage and strictly necessary cookies to keep you signed in and remember your language preference.',
          '[IF ANALYTICS OR ADVERTISING IS INTRODUCED, THIS SECTION MUST BE UPDATED AND WILL REQUIRE ITS OWN CONSENT MECHANISM.]',
        ],
      },
      {
        id: 'children',
        heading: '13. Children',
        paragraphs: [
          'The service is intended for people aged 18 and over. We do not knowingly collect data from minors.',
        ],
      },
      {
        id: 'changes',
        heading: '14. Changes to this Notice',
        paragraphs: [
          'We may update this Notice. Every version carries an identifier and a date, and the current version is published on this page. Where a change is material we will notify you and, where appropriate, ask you to accept the new version.',
        ],
      },
      {
        id: 'contact',
        heading: '15. Contact',
        paragraphs: [
          'Questions about this Notice or how we handle your data: support@maralito.uk.',
        ],
      },
    ],
  },
};
