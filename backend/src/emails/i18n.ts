// Email copy in the three storefront languages. Customer emails use the
// language the order was placed in; account and shop emails use the
// recipient's saved language (users.locale). Arabic emails render RTL.

import { currentBrand } from "../services/storeSettings";

export const LOCALES = ["en", "fr", "ar"] as const;
export type Locale = (typeof LOCALES)[number];

export const isLocale = (value: unknown): value is Locale =>
  typeof value === "string" && (LOCALES as readonly string[]).includes(value);

const en = {
  "layout.linkHelp": "If the button doesn't work, copy this link:",

  "order.subtotal": "Subtotal",
  "order.discount": "Discount",
  "order.delivery": "Delivery",
  "order.total": "Total",
  "order.stopDesk": " (stop desk pick-up)",
  "order.shippingTo": "Shipping to: {address}",
  "order.view": "View your order",
  "order.viewOrPay": "View or pay for your order",

  "placed.title": "Order received",
  "placed.subject": "Order received — {id}",
  "placed.heading": "Thanks, {name}!",
  "placed.received": "We've received your order {id}.",
  "placed.cod": "You'll pay {total} in cash on delivery. We'll call {phone} to confirm your order before it ships.",
  "placed.paid": "Your payment has been received.",
  "placed.unpaid": "Complete your payment to confirm the order — unpaid orders are released after a short while.",

  "status.update": "Hi {name}, an update on order {id}.",
  "status.paymentReceived": "Payment of {total} received.",
  "status.processing.subject": "Your order is confirmed",
  "status.processing.heading": "Your order is confirmed",
  "status.processing.body": "The makers are preparing your items. We'll email you again when it ships.",
  "status.shipped.subject": "Your order is on its way",
  "status.shipped.heading": "Your order has shipped",
  "status.shipped.body": "It's with the courier now — keep your phone nearby, they'll call before delivery.",
  "status.delivered.subject": "Your order was delivered",
  "status.delivered.heading": "Delivered — enjoy!",
  "status.delivered.body": "Your order has been delivered. Thank you for supporting independent makers.",
  "status.cancelled.subject": "Your order was cancelled",
  "status.cancelled.heading": "Your order was cancelled",
  "status.cancelled.body": "This order has been cancelled. If you think this is a mistake, reply to this email.",

  "reason.expired": "We cancelled this order because the payment wasn't completed in time, and released the items. You're welcome to order again.",
  "reason.declined": "As agreed on the phone, we've cancelled this order.",
  "reason.wrongNumber": "We couldn't reach you at the phone number given, so the order was cancelled. You're welcome to order again.",
  "reason.customer": "You cancelled this order. Nothing will be shipped or charged.",

  "shopOrder.title": "New order",
  "shopOrder.subject": "New order {id} — {shop}",
  "shopOrder.heading": "New order for {shop}",
  "shopOrder.includes": "Order {id} includes items from your shop.",
  "shopOrder.yourItems": "Your items",
  "shopOrder.customer": "Customer: {customer}",
  "shopOrder.deliverTo": "Deliver to: {address}",
  "shopOrder.cod": "Payment: cash on delivery — confirm the order with the customer by phone.",
  "shopOrder.card": "Payment: paid online.",
  "shopOrder.cta": "Open your orders",

  "shopCancel.subject": "Order {id} was cancelled by the customer",
  "shopCancel.heading": "Order cancelled",
  "shopCancel.body": "The customer cancelled order {id} before it shipped. Its items are back in your stock — don't send it.",

  "stock.title": "Low stock",
  "backInStock.title": "Back in stock",
  "backInStock.subject": "Back in stock: {name}",
  "backInStock.heading": "{name} is back!",
  "backInStock.body": "Good news: {name} is available again. Handmade pieces sell quickly, so don't wait too long.",
  "backInStock.cta": "See the product",
  "backInStock.why": "You asked us to tell you when it was back. This is the only email we'll send about it.",
  "stock.headingSoldOut": "Some products just sold out",
  "stock.headingLow": "Running low on stock",
  "stock.body": "A recent order left these {shop} products nearly out of stock. Restock them so you don't miss sales.",
  "stock.soldOut": "sold out",
  "stock.left": "{count} left",
  "stock.cta": "Update your stock",
  "stock.subjectSoldOut": "Sold out: {name}",
  "stock.subjectLow": "Low stock: {name}",
  "stock.andMore": " and {count} more",

  "account.hi": "Hi {name},",
  "verify.subject": "Confirm your email address",
  "verify.body": "Please confirm your email address so we can keep your account secure and send you order updates.",
  "verify.expires": "This link expires in 24 hours.",
  "verify.cta": "Confirm my email",
  "reset.subject": "Reset your password",
  "reset.body": "We received a request to reset your password. Click the button below to choose a new one. This link expires in {minutes} minutes.",
  "reset.ignore": "If you didn't request this, you can safely ignore this email — your password won't change unless you click the link and set a new one.",

  "sellerAdmin.subject": "New seller application — {shop}",
  "sellerAdmin.heading": "New seller application",
  "sellerAdmin.body": "{name} wants to open \"{shop}\" on {brand}.",
  "sellerAdmin.cta": "Review applications",
  "sellerOk.subject": "Your shop \"{shop}\" is approved",
  "sellerOk.heading": "Welcome aboard, {name}!",
  "sellerOk.body": "Your shop \"{shop}\" has been created. Sign in again to open your dashboard, add products and start selling.",
  "sellerOk.cta": "Open my dashboard",
  "sellerNo.subject": "About your shop application",
  "sellerNo.body": "Thanks for applying to open \"{shop}\". We can't approve it right now.",
  "sellerNo.reason": "Reason: {note}",
  "sellerNo.again": "You're welcome to apply again later.",
};

export type EmailKey = keyof typeof en;

const fr: Record<EmailKey, string> = {
  "layout.linkHelp": "Si le bouton ne fonctionne pas, copiez ce lien :",

  "order.subtotal": "Sous-total",
  "order.discount": "Remise",
  "order.delivery": "Livraison",
  "order.total": "Total",
  "order.stopDesk": " (retrait au point relais)",
  "order.shippingTo": "Livraison à : {address}",
  "order.view": "Voir votre commande",
  "order.viewOrPay": "Voir ou payer votre commande",

  "placed.title": "Commande reçue",
  "placed.subject": "Commande reçue — {id}",
  "placed.heading": "Merci, {name} !",
  "placed.received": "Nous avons bien reçu votre commande {id}.",
  "placed.cod": "Vous paierez {total} en espèces à la livraison. Nous appellerons le {phone} pour confirmer votre commande avant l'expédition.",
  "placed.paid": "Votre paiement a bien été reçu.",
  "placed.unpaid": "Finalisez votre paiement pour confirmer la commande — les commandes impayées sont annulées au bout d'un court moment.",

  "status.update": "Bonjour {name}, du nouveau sur la commande {id}.",
  "status.paymentReceived": "Paiement de {total} reçu.",
  "status.processing.subject": "Votre commande est confirmée",
  "status.processing.heading": "Votre commande est confirmée",
  "status.processing.body": "Les artisans préparent vos articles. Nous vous écrirons à nouveau à l'expédition.",
  "status.shipped.subject": "Votre commande est en route",
  "status.shipped.heading": "Votre commande a été expédiée",
  "status.shipped.body": "Elle est chez le livreur — gardez votre téléphone à portée de main, il vous appellera avant la livraison.",
  "status.delivered.subject": "Votre commande a été livrée",
  "status.delivered.heading": "Livrée — profitez-en !",
  "status.delivered.body": "Votre commande a été livrée. Merci de soutenir les artisans indépendants.",
  "status.cancelled.subject": "Votre commande a été annulée",
  "status.cancelled.heading": "Votre commande a été annulée",
  "status.cancelled.body": "Cette commande a été annulée. S'il s'agit d'une erreur, répondez à cet e-mail.",

  "reason.expired": "Nous avons annulé cette commande car le paiement n'a pas été finalisé à temps, et les articles ont été remis en vente. N'hésitez pas à commander à nouveau.",
  "reason.declined": "Comme convenu par téléphone, nous avons annulé cette commande.",
  "reason.wrongNumber": "Nous n'avons pas pu vous joindre au numéro indiqué, la commande a donc été annulée. N'hésitez pas à commander à nouveau.",
  "reason.customer": "Vous avez annulé cette commande. Rien ne sera expédié ni facturé.",

  "shopOrder.title": "Nouvelle commande",
  "shopOrder.subject": "Nouvelle commande {id} — {shop}",
  "shopOrder.heading": "Nouvelle commande pour {shop}",
  "shopOrder.includes": "La commande {id} contient des articles de votre boutique.",
  "shopOrder.yourItems": "Vos articles",
  "shopOrder.customer": "Client : {customer}",
  "shopOrder.deliverTo": "Livrer à : {address}",
  "shopOrder.cod": "Paiement : à la livraison — confirmez la commande avec le client par téléphone.",
  "shopOrder.card": "Paiement : payé en ligne.",
  "shopOrder.cta": "Ouvrir vos commandes",

  "shopCancel.subject": "La commande {id} a été annulée par le client",
  "shopCancel.heading": "Commande annulée",
  "shopCancel.body": "Le client a annulé la commande {id} avant son expédition. Les articles ont été remis en stock — ne l'envoyez pas.",

  "stock.title": "Stock faible",
  "backInStock.title": "De retour en stock",
  "backInStock.subject": "De retour en stock : {name}",
  "backInStock.heading": "{name} est de retour !",
  "backInStock.body": "Bonne nouvelle : {name} est de nouveau disponible. Les pièces faites main partent vite, n'attendez pas trop.",
  "backInStock.cta": "Voir le produit",
  "backInStock.why": "Vous avez demandé à être prévenu de son retour. C'est le seul e-mail que nous vous enverrons à ce sujet.",
  "stock.headingSoldOut": "Certains produits viennent d'être épuisés",
  "stock.headingLow": "Stock bientôt épuisé",
  "stock.body": "Une commande récente a presque épuisé ces produits de {shop}. Réapprovisionnez-les pour ne pas manquer de ventes.",
  "stock.soldOut": "épuisé",
  "stock.left": "{count} restant(s)",
  "stock.cta": "Mettre à jour le stock",
  "stock.subjectSoldOut": "Épuisé : {name}",
  "stock.subjectLow": "Stock faible : {name}",
  "stock.andMore": " et {count} autre(s)",

  "account.hi": "Bonjour {name},",
  "verify.subject": "Confirmez votre adresse e-mail",
  "verify.body": "Merci de confirmer votre adresse e-mail pour sécuriser votre compte et recevoir le suivi de vos commandes.",
  "verify.expires": "Ce lien expire dans 24 heures.",
  "verify.cta": "Confirmer mon e-mail",
  "reset.subject": "Réinitialisez votre mot de passe",
  "reset.body": "Nous avons reçu une demande de réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour en choisir un nouveau. Ce lien expire dans {minutes} minutes.",
  "reset.ignore": "Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail — votre mot de passe ne changera pas tant que vous n'en définissez pas un nouveau via ce lien.",

  "sellerAdmin.subject": "Nouvelle demande vendeur — {shop}",
  "sellerAdmin.heading": "Nouvelle demande vendeur",
  "sellerAdmin.body": "{name} souhaite ouvrir « {shop} » sur {brand}.",
  "sellerAdmin.cta": "Examiner les demandes",
  "sellerOk.subject": "Votre boutique « {shop} » est approuvée",
  "sellerOk.heading": "Bienvenue, {name} !",
  "sellerOk.body": "Votre boutique « {shop} » a été créée. Reconnectez-vous pour ouvrir votre tableau de bord, ajouter des produits et commencer à vendre.",
  "sellerOk.cta": "Ouvrir mon tableau de bord",
  "sellerNo.subject": "À propos de votre demande de boutique",
  "sellerNo.body": "Merci pour votre demande d'ouverture de « {shop} ». Nous ne pouvons pas l'approuver pour le moment.",
  "sellerNo.reason": "Motif : {note}",
  "sellerNo.again": "N'hésitez pas à refaire une demande plus tard.",
};

const ar: Record<EmailKey, string> = {
  "layout.linkHelp": "إذا لم يعمل الزر، انسخ هذا الرابط:",

  "order.subtotal": "المجموع الفرعي",
  "order.discount": "الخصم",
  "order.delivery": "التوصيل",
  "order.total": "المجموع",
  "order.stopDesk": " (استلام من مكتب التوصيل)",
  "order.shippingTo": "التوصيل إلى: {address}",
  "order.view": "عرض طلبك",
  "order.viewOrPay": "عرض طلبك أو دفعه",

  "placed.title": "تم استلام الطلب",
  "placed.subject": "تم استلام الطلب — {id}",
  "placed.heading": "شكرًا، {name}!",
  "placed.received": "لقد استلمنا طلبك {id}.",
  "placed.cod": "ستدفع {total} نقدًا عند الاستلام. سنتصل بالرقم {phone} لتأكيد طلبك قبل الشحن.",
  "placed.paid": "تم استلام دفعتك.",
  "placed.unpaid": "أكمل الدفع لتأكيد الطلب — تُلغى الطلبات غير المدفوعة بعد وقت قصير.",

  "status.update": "مرحبًا {name}، إليك تحديثًا بشأن الطلب {id}.",
  "status.paymentReceived": "تم استلام دفعة بقيمة {total}.",
  "status.processing.subject": "تم تأكيد طلبك",
  "status.processing.heading": "تم تأكيد طلبك",
  "status.processing.body": "يقوم الحرفيون بتحضير منتجاتك. سنراسلك مجددًا عند الشحن.",
  "status.shipped.subject": "طلبك في الطريق",
  "status.shipped.heading": "تم شحن طلبك",
  "status.shipped.body": "الطلب الآن لدى عامل التوصيل — أبقِ هاتفك قريبًا، سيتصل بك قبل التسليم.",
  "status.delivered.subject": "تم تسليم طلبك",
  "status.delivered.heading": "تم التسليم — استمتع!",
  "status.delivered.body": "تم تسليم طلبك. شكرًا لدعمك الحرفيين المستقلين.",
  "status.cancelled.subject": "تم إلغاء طلبك",
  "status.cancelled.heading": "تم إلغاء طلبك",
  "status.cancelled.body": "تم إلغاء هذا الطلب. إذا كنت تعتقد أن هذا خطأ، فردّ على هذه الرسالة.",

  "reason.expired": "ألغينا هذا الطلب لأن الدفع لم يكتمل في الوقت المحدد، وأعدنا المنتجات للبيع. يمكنك الطلب من جديد.",
  "reason.declined": "كما اتفقنا عبر الهاتف، ألغينا هذا الطلب.",
  "reason.wrongNumber": "لم نتمكن من الوصول إليك على رقم الهاتف المقدَّم، لذا أُلغي الطلب. يمكنك الطلب من جديد.",
  "reason.customer": "لقد ألغيت هذا الطلب. لن يُشحن أي شيء ولن تُحتسب أي مبالغ.",

  "shopOrder.title": "طلب جديد",
  "shopOrder.subject": "طلب جديد {id} — {shop}",
  "shopOrder.heading": "طلب جديد لـ {shop}",
  "shopOrder.includes": "يتضمن الطلب {id} منتجات من متجرك.",
  "shopOrder.yourItems": "منتجاتك",
  "shopOrder.customer": "الزبون: {customer}",
  "shopOrder.deliverTo": "التوصيل إلى: {address}",
  "shopOrder.cod": "الدفع: عند الاستلام — أكّد الطلب مع الزبون عبر الهاتف.",
  "shopOrder.card": "الدفع: مدفوع عبر الإنترنت.",
  "shopOrder.cta": "فتح طلباتك",

  "shopCancel.subject": "ألغى الزبون الطلب {id}",
  "shopCancel.heading": "تم إلغاء الطلب",
  "shopCancel.body": "ألغى الزبون الطلب {id} قبل شحنه. أُعيدت المنتجات إلى مخزونك — لا ترسله.",

  "stock.title": "مخزون منخفض",
  "backInStock.title": "عاد إلى المخزون",
  "backInStock.subject": "عاد إلى المخزون: {name}",
  "backInStock.heading": "{name} متوفر من جديد!",
  "backInStock.body": "خبر سار: {name} متوفر من جديد. القطع اليدوية تنفد بسرعة، فلا تتأخر.",
  "backInStock.cta": "عرض المنتج",
  "backInStock.why": "طلبت منا إعلامك بعودته. هذه هي الرسالة الوحيدة التي سنرسلها لك بخصوصه.",
  "stock.headingSoldOut": "نفدت بعض المنتجات للتو",
  "stock.headingLow": "المخزون يوشك على النفاد",
  "stock.body": "تركت طلبية حديثة منتجات {shop} هذه على وشك النفاد. أعد تزويدها حتى لا تفوتك المبيعات.",
  "stock.soldOut": "نفد",
  "stock.left": "بقي {count}",
  "stock.cta": "تحديث المخزون",
  "stock.subjectSoldOut": "نفد: {name}",
  "stock.subjectLow": "مخزون منخفض: {name}",
  "stock.andMore": " و{count} أخرى",

  "account.hi": "مرحبًا {name}،",
  "verify.subject": "أكّد بريدك الإلكتروني",
  "verify.body": "يرجى تأكيد بريدك الإلكتروني لحماية حسابك وإرسال تحديثات طلباتك إليك.",
  "verify.expires": "تنتهي صلاحية هذا الرابط خلال 24 ساعة.",
  "verify.cta": "تأكيد بريدي",
  "reset.subject": "إعادة تعيين كلمة المرور",
  "reset.body": "تلقّينا طلبًا لإعادة تعيين كلمة المرور. انقر على الزر أدناه لاختيار كلمة جديدة. تنتهي صلاحية هذا الرابط خلال {minutes} دقيقة.",
  "reset.ignore": "إذا لم تطلب ذلك، يمكنك تجاهل هذه الرسالة بأمان — لن تتغير كلمة مرورك ما لم تنقر على الرابط وتعيّن كلمة جديدة.",

  "sellerAdmin.subject": "طلب بائع جديد — {shop}",
  "sellerAdmin.heading": "طلب بائع جديد",
  "sellerAdmin.body": "يرغب {name} في فتح «{shop}» على {brand}.",
  "sellerAdmin.cta": "مراجعة الطلبات",
  "sellerOk.subject": "تمت الموافقة على متجرك «{shop}»",
  "sellerOk.heading": "مرحبًا بك معنا، {name}!",
  "sellerOk.body": "تم إنشاء متجرك «{shop}». سجّل الدخول من جديد لفتح لوحة التحكم وإضافة المنتجات وبدء البيع.",
  "sellerOk.cta": "فتح لوحة التحكم",
  "sellerNo.subject": "بخصوص طلب فتح متجرك",
  "sellerNo.body": "شكرًا على طلبك لفتح «{shop}». لا يمكننا الموافقة عليه حاليًا.",
  "sellerNo.reason": "السبب: {note}",
  "sellerNo.again": "يمكنك التقديم مجددًا لاحقًا.",
};

const STRINGS: Record<Locale, Record<EmailKey, string>> = { en, fr, ar };

export type Translate = (key: EmailKey, vars?: Record<string, string | number>) => string;

export function translator(locale: Locale | null | undefined): Translate {
  const dict = STRINGS[isLocale(locale) ? locale : "en"];
  // {brand} is the shop's current name unless given.
  return (key, vars) =>
    dict[key].replace(/\{(\w+)\}/g, (_, name) =>
      String(vars?.[name] ?? (name === "brand" ? currentBrand().name : `{${name}}`)),
    );
}

// The first supported language in an Accept-Language header ("fr-DZ,fr;q=0.9,ar;q=0.8").
// The storefront sends its current language this way on every API call.
export function localeFromHeader(header: string | undefined): Locale | null {
  if (!header) return null;
  for (const part of header.split(",")) {
    const tag = part.split(";")[0].trim().slice(0, 2).toLowerCase();
    if (isLocale(tag)) return tag;
  }
  return null;
}
