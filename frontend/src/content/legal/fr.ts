import type { LegalContent } from "./types";

const days = (n: number) => (n === 1 ? "1 jour" : `${n} jours`);
const dayRange = (min: number, max: number) => (min === max ? days(max) : `${min} à ${days(max)}`);


export const fr: LegalContent = (v) => ({
  terms: {
    title: "Conditions générales de vente",
    intro: `Ces conditions s'appliquent à toute commande passée sur ${v.site}. Lisez-les avant de commander : passer commande vaut acceptation.`,
    sections: [
      {
        heading: "1. Qui sommes-nous",
        body: [
          `${v.site} est une place de marché en ligne exploitée par **${v.legalName}**, immatriculée sous le n° ${v.registerNumber} (NIF ${v.taxId}), ${v.address}. E-mail : ${v.email} · Téléphone : ${v.phone}.`,
          `Les produits sont fabriqués et vendus par des boutiques indépendantes (les « vendeurs »). Le vendeur de chaque produit est indiqué sur sa page et sur votre commande. ${v.legalName} gère le site, encaisse les paiements pour le compte des vendeurs et assure le service client.`,
        ],
      },
      {
        heading: "2. Produits",
        body: [
          "Chaque fiche produit présente ses photos, sa description, ses options (taille, couleur…), son prix et sa disponibilité. Un article fait main peut légèrement différer des photos par sa couleur ou sa forme : ce n'est pas un défaut.",
          "Le stock est réservé au moment de la commande. Si un article s'avère indisponible, nous vous prévenons et l'annulons sans frais pour vous.",
        ],
      },
      {
        heading: "3. Prix et frais de livraison",
        body: [
          "Les prix sont en dinars algériens (DA), toutes taxes comprises. Les frais de livraison dépendent de votre wilaya et du mode de livraison (à domicile ou stop desk) et sont affichés dans le panier avant validation. Le prix applicable est celui affiché au moment de la commande.",
          "Les codes de réduction s'appliquent selon les conditions indiquées et ne sont pas échangeables contre de l'argent.",
        ],
      },
      {
        heading: "4. Commande",
        body: [
          {
            list: [
              "Ajoutez les produits au panier et choisissez leurs options.",
              "Indiquez vos coordonnées de livraison et votre mode de paiement.",
              "Vérifiez le récapitulatif (produits, options, frais de livraison, total), puis confirmez.",
            ],
          },
          "Vous recevez un e-mail de confirmation avec votre numéro de commande, et pouvez la suivre sur [Suivre une commande](/track-order).",
          "Pour le paiement à la livraison, nous pouvons vous appeler ou vous envoyer un code par SMS pour confirmer la commande avant l'expédition. Nous pouvons refuser ou annuler une commande si les informations sont incomplètes ou fausses, si le numéro est injoignable, ou après des refus de livraison répétés.",
        ],
      },
      {
        heading: "5. Paiement",
        body: [
          {
            list: [
              "**Paiement à la livraison** : vous payez le livreur à la réception du colis.",
              "**Carte EDAHABIA ou CIB** : paiement en ligne traité par notre prestataire Chargily Pay. Nous ne voyons ni ne conservons jamais les données de votre carte. La commande est confirmée une fois le paiement accepté.",
            ],
          },
        ],
      },
      {
        heading: "6. Livraison",
        body: [
          `Nous livrons dans les wilayas proposées lors de la commande, à domicile ou en stop desk. La livraison prend généralement ${dayRange(v.deliveryMin, v.deliveryMax)} après confirmation, parfois plus dans les wilayas éloignées ou pendant les fêtes. Tous les détails : [Livraison et retours](/delivery-returns).`,
          "Vérifiez votre colis à la réception, si possible devant le livreur, et signalez-nous rapidement tout problème.",
        ],
      },
      {
        heading: "7. Annulation d'une commande",
        body: [
          "Tant que votre commande n'est pas expédiée, vous pouvez l'annuler vous-même depuis sa page, sans frais. Une fois expédiée, les règles d'échange et de retour s'appliquent.",
        ],
      },
      {
        heading: "8. Article erroné, abîmé ou défectueux",
        body: [
          "Si vous recevez un article abîmé, défectueux ou différent de votre commande, nous le reprenons à nos frais et vous envoyons le bon article, ou annulons la vente. Voir [Livraison et retours](/delivery-returns).",
        ],
      },
      {
        heading: "9. Avis",
        body: [
          "Seuls les clients ayant acheté et reçu un produit peuvent le noter. Les avis doivent rester respectueux et porter sur le produit ; nous pouvons retirer ceux qui sont injurieux, hors sujet ou qui contiennent des données personnelles.",
        ],
      },
      {
        heading: "10. Données personnelles",
        body: [
          "Nous utilisons vos informations uniquement pour traiter et livrer vos commandes et pour vous répondre. Voir notre [Politique de confidentialité](/privacy).",
        ],
      },
      {
        heading: "11. Droit applicable et litiges",
        body: [
          "Ces conditions sont régies par le droit algérien, notamment la loi 18-05 relative au commerce électronique et la loi 09-03 relative à la protection du consommateur.",
          "En cas de problème, [contactez-nous](/contact) d'abord : la plupart des situations se règlent rapidement. À défaut de solution amiable, les juridictions algériennes compétentes sont saisies.",
        ],
      },
      {
        heading: "12. Modification des conditions",
        body: ["Nous pouvons mettre à jour ces conditions. Une commande est régie par les conditions publiées le jour où elle a été passée."],
      },
    ],
  },

  delivery: {
    title: "Livraison et retours",
    intro: "Comment votre commande vous parvient, et que faire si quelque chose ne va pas.",
    sections: [
      {
        heading: "Où livrons-nous",
        body: [
          "Nous livrons dans les wilayas proposées lors de la commande. Choisissez la livraison à domicile ou, quand elle est proposée, le stop desk (point de retrait de la société de livraison), généralement moins cher.",
        ],
      },
      {
        heading: "Frais de livraison",
        body: ["Les frais dépendent de votre wilaya et du mode de livraison. Ils sont affichés dans le panier avant validation et inclus dans le total."],
      },
      {
        heading: "Délais de livraison",
        body: [
          `Les commandes arrivent généralement ${dayRange(v.deliveryMin, v.deliveryMax)} après confirmation. Les wilayas éloignées, la météo ou les jours fériés peuvent ajouter quelques jours. Pour le paiement à la livraison, nous pouvons d'abord vous appeler pour confirmer.`,
        ],
      },
      {
        heading: "Suivre votre commande",
        body: [
          "Suivez votre commande à tout moment sur [Suivre une commande](/track-order) avec votre numéro de commande et votre e-mail, ou dans [Mes commandes](/orders) si vous avez un compte. À l'expédition, vous recevez un e-mail, et la page de la commande affiche le transporteur et le numéro de suivi dès que le vendeur les a ajoutés.",
        ],
      },
      {
        heading: "À la réception du colis",
        body: [
          "Vérifiez le colis devant le livreur si possible. S'il est visiblement abîmé, vous pouvez le refuser, ou l'accepter et nous contacter le jour même. Avec le paiement à la livraison, vous payez le montant indiqué sur votre commande, rien de plus.",
        ],
      },
      {
        heading: "Article erroné, abîmé ou défectueux",
        body: [
          "[Contactez-nous](/contact) dans les **4 jours ouvrables** suivant la livraison avec votre numéro de commande et une photo du problème, puis renvoyez l'article dans son emballage d'origine. **Les frais de retour sont à notre charge.** Nous vous envoyons ensuite le bon article, le réparons, ou annulons la vente et vous rendons le montant payé.",
        ],
      },
      {
        heading: "Vous avez changé d'avis ?",
        body:
          v.exchangeDays > 0
            ? [
                `Vous pouvez demander l'échange d'un article contre une autre taille, couleur ou un autre produit dans un délai de **${days(v.exchangeDays)}** après la livraison. Il doit être non utilisé, complet et dans son emballage d'origine. Les frais de livraison de l'échange sont à votre charge.`,
                "Les articles personnalisés ou faits sur commande, et les produits d'hygiène une fois ouverts, ne sont ni repris ni échangés.",
              ]
            : [
                "Nous n'échangeons pas un article conforme à votre commande et arrivé en bon état. Choisissez tailles et options avec soin, et [posez-nous vos questions](/contact) avant de commander en cas de doute.",
              ],
      },
      {
        heading: "Annuler avant l'expédition",
        body: ["Tant que votre commande n'est pas expédiée, vous pouvez l'annuler vous-même depuis sa page, sans frais."],
      },
    ],
  },

  privacy: {
    title: "Politique de confidentialité",
    intro: `Quelles données personnelles ${v.site} collecte, pourquoi, et quels sont vos droits. Cette politique suit la loi algérienne 18-07 relative à la protection des personnes physiques dans le traitement des données à caractère personnel.`,
    sections: [
      {
        heading: "Responsable du traitement",
        body: [`**${v.legalName}**, ${v.address}, est responsable du traitement de vos données. Contact : ${v.email}.`],
      },
      {
        heading: "Données collectées",
        body: [
          {
            list: [
              "**Compte** : nom, adresse e-mail, numéro de téléphone et mot de passe (conservé sous une forme illisible).",
              "**Commandes** : adresse de livraison, wilaya et commune, téléphone, produits commandés, montants et mode de paiement.",
              "Vos adresses enregistrées, votre liste d'envies et les avis que vous écrivez.",
              "**Données techniques** : adresse IP et rapports d'erreur, pour la sécurité et le bon fonctionnement du site.",
            ],
          },
          "Les paiements par carte sont traités par Chargily Pay : nous ne recevons jamais les données de votre carte.",
        ],
      },
      {
        heading: "Pourquoi nous les utilisons",
        body: [
          {
            list: [
              "Traiter, confirmer (par appel ou code SMS) et livrer vos commandes, et gérer annulations et échanges.",
              "Vous envoyer des e-mails sur votre compte et vos commandes : confirmation, expédition, réinitialisation du mot de passe.",
              "Prévenir la fraude et les abus, comme les refus de livraison répétés.",
              "Respecter nos obligations légales et comptables.",
            ],
          },
          "Nous ne vendons pas vos données et ne vous envoyons pas de publicité sans votre accord.",
        ],
      },
      {
        heading: "Destinataires",
        body: [
          {
            list: [
              "Le vendeur des produits commandés et la société de livraison : uniquement ce qui est nécessaire pour préparer et livrer la commande (nom, téléphone, adresse).",
              "Nos prestataires techniques, uniquement pour faire fonctionner le service : hébergement, envoi d'e-mails et de SMS, stockage des images, suivi des erreurs et paiement par carte. Certains sont situés hors d'Algérie.",
              "Les autorités, lorsque la loi l'exige.",
            ],
          },
        ],
      },
      {
        heading: "Durée de conservation",
        body: [
          "Les données de commande sont conservées le temps exigé par le droit comptable et commercial. Les données du compte sont conservées tant que le compte est actif ; si vous demandez sa suppression, nous les supprimons ou les anonymisons, sauf ce que la loi nous oblige à garder. Les journaux techniques ne sont conservés que peu de temps.",
        ],
      },
      {
        heading: "Cookies et stockage dans votre navigateur",
        body: [
          "Nous n'utilisons que le nécessaire au fonctionnement du site : un cookie pour rester connecté, et un stockage dans votre navigateur pour le panier, la langue, le thème et les recherches récentes. Aucun cookie publicitaire ni de traçage.",
        ],
      },
      {
        heading: "Vos droits",
        body: [
          `Vous pouvez accéder à vos données, les rectifier, les supprimer et vous opposer à leur traitement pour un motif légitime. Votre nom et votre téléphone se modifient dans [votre profil](/profile) ; pour le reste, écrivez à ${v.email}. Vous pouvez aussi saisir l'Autorité nationale de protection des données à caractère personnel (ANPDP).`,
        ],
      },
      {
        heading: "Sécurité",
        body: [
          "Les données circulent chiffrées (HTTPS), les mots de passe sont hachés, et l'accès au tableau de bord est restreint et journalisé. Les comptes administrateurs peuvent activer la validation en deux étapes.",
        ],
      },
      {
        heading: "Modifications",
        body: ["Nous pouvons mettre à jour cette politique ; la version en vigueur est toujours publiée sur cette page."],
      },
    ],
  },
});
