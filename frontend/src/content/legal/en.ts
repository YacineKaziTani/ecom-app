import type { LegalContent } from "./types";

const days = (n: number) => (n === 1 ? "1 day" : `${n} days`);
const dayRange = (min: number, max: number) => (min === max ? days(max) : `${min} to ${days(max)}`);


export const en: LegalContent = (v) => ({
  terms: {
    title: "Terms of sale",
    intro: `These terms apply to every order placed on ${v.site}. Please read them before you order: placing an order means you accept them.`,
    sections: [
      {
        heading: "1. Who we are",
        body: [
          `${v.site} is an online marketplace operated by **${v.legalName}**, registered under no. ${v.registerNumber} (NIF ${v.taxId}), ${v.address}. Email: ${v.email} · Phone: ${v.phone}.`,
          `The products are made and sold by independent shops (the “sellers”). The seller of each product is shown on its page and on your order. ${v.legalName} runs the website, takes payments on the sellers' behalf and handles customer service.`,
        ],
      },
      {
        heading: "2. Products",
        body: [
          "Each product page shows its photos, description, options (size, colour…), price and availability. Handmade items can differ slightly from the photos in colour or shape: this is not a defect.",
          "Stock is reserved when you order. If an item turns out to be unavailable, we tell you and cancel that item at no cost to you.",
        ],
      },
      {
        heading: "3. Prices and delivery fees",
        body: [
          "Prices are in Algerian dinars (DA), all taxes included. Delivery fees depend on your wilaya and on the delivery mode (home or stop desk) and are shown in your cart before you confirm. The price that applies is the one shown when you place your order.",
          "Discount codes apply under the conditions shown with them and can't be exchanged for cash.",
        ],
      },
      {
        heading: "4. Ordering",
        body: [
          {
            list: [
              "Add products to your cart and choose their options.",
              "Enter your delivery details and choose how you'll pay.",
              "Check the summary (products, options, delivery fees, total), then confirm.",
            ],
          },
          "You receive a confirmation email with your order number, and can follow the order on [Track an order](/track-order).",
          "For pay-on-delivery orders, we may call you or send a code by SMS to confirm before shipping. We may refuse or cancel an order when the details are incomplete or false, when the phone number can't be reached, or after repeated refused deliveries.",
        ],
      },
      {
        heading: "5. Payment",
        body: [
          {
            list: [
              "**Cash on delivery**: you pay the delivery person when you receive your parcel.",
              "**EDAHABIA or CIB card**: online payment handled by our payment provider, Chargily Pay. We never see or store your card details. A card order is confirmed once the payment is accepted.",
            ],
          },
        ],
      },
      {
        heading: "6. Delivery",
        body: [
          `We deliver to the wilayas listed at checkout, to your door or to a stop desk. Delivery usually takes ${dayRange(v.deliveryMin, v.deliveryMax)} after the order is confirmed, and can take longer in remote wilayas or during holidays. Details are in [Delivery and returns](/delivery-returns).`,
          "Check your parcel when you receive it, in front of the delivery person when possible, and tell us about any problem quickly.",
        ],
      },
      {
        heading: "7. Cancelling an order",
        body: [
          "Until your order ships, you can cancel it yourself from its page, free of charge. Once it has shipped, the exchange and return rules apply.",
        ],
      },
      {
        heading: "8. Wrong, damaged or defective items",
        body: [
          "If you receive an item that is damaged, defective or not what you ordered, we take it back at our expense and send you the right item, or cancel the sale. See [Delivery and returns](/delivery-returns).",
        ],
      },
      {
        heading: "9. Reviews",
        body: [
          "Only customers who bought and received a product can review it. Reviews must stay respectful and about the product; we may remove those that are insulting, off topic or contain personal information.",
        ],
      },
      {
        heading: "10. Personal data",
        body: ["We use your details only to process and deliver your orders and to answer you. See our [Privacy policy](/privacy)."],
      },
      {
        heading: "11. Applicable law and disputes",
        body: [
          "These terms are governed by Algerian law, in particular Law 18-05 on electronic commerce and Law 09-03 on consumer protection.",
          "If you have a problem, [contact us](/contact) first: most issues are solved quickly. If no amicable solution is found, the competent Algerian courts have jurisdiction.",
        ],
      },
      {
        heading: "12. Changes to these terms",
        body: ["We may update these terms. An order is governed by the terms published on the day it was placed."],
      },
    ],
  },

  delivery: {
    title: "Delivery and returns",
    intro: "How your order reaches you, and what to do if something isn't right.",
    sections: [
      {
        heading: "Where we deliver",
        body: [
          "We deliver to the wilayas listed at checkout. Choose home delivery or, where it's offered, a stop desk (the delivery company's pick-up point), which is usually cheaper.",
        ],
      },
      {
        heading: "Delivery fees",
        body: ["The fee depends on your wilaya and the delivery mode. It's shown in your cart before you confirm and included in the total."],
      },
      {
        heading: "Delivery times",
        body: [
          `Orders usually arrive ${dayRange(v.deliveryMin, v.deliveryMax)} after they're confirmed. Remote wilayas, bad weather or public holidays can add a few days. For pay-on-delivery orders, we may call you first to confirm.`,
        ],
      },
      {
        heading: "Following your order",
        body: [
          "Follow your order at any time on [Track an order](/track-order) with your order number and email, or in [My orders](/orders) if you have an account. When your parcel ships, we email you, and the order page shows the carrier and tracking number once the seller has added them.",
        ],
      },
      {
        heading: "When your parcel arrives",
        body: [
          "Check the parcel in front of the delivery person when possible. If it's visibly damaged, you can refuse it, or accept it and contact us the same day. With pay on delivery, you pay the amount shown on your order, nothing more.",
        ],
      },
      {
        heading: "Wrong, damaged or defective item",
        body: [
          "[Contact us](/contact) within **4 working days** of delivery with your order number and a photo of the problem, then send the item back in its original packaging. **We pay the return shipping.** We then send you the right item, repair it, or cancel the sale and give back what you paid for it.",
        ],
      },
      {
        heading: "Changed your mind?",
        body:
          v.exchangeDays > 0
            ? [
                `You can ask to exchange an item for another size, colour or product within **${days(v.exchangeDays)}** of delivery. It must be unused, complete and in its original packaging. The delivery fees of an exchange are paid by you.`,
                "Personalised or made-to-order items, and hygiene products once opened, can't be exchanged.",
              ]
            : [
                "We don't exchange items that match your order and arrived in good condition. Choose sizes and options carefully, and [ask us](/contact) before ordering if you have a doubt.",
              ],
      },
      {
        heading: "Cancelling before shipping",
        body: ["Until your order ships, you can cancel it yourself from its page, free of charge."],
      },
    ],
  },

  privacy: {
    title: "Privacy policy",
    intro: `What personal data ${v.site} collects, why, and your rights over it. This policy follows Algerian Law 18-07 on the protection of natural persons in the processing of personal data.`,
    sections: [
      {
        heading: "Who is responsible",
        body: [`**${v.legalName}**, ${v.address}, is responsible for processing your data. Contact: ${v.email}.`],
      },
      {
        heading: "What we collect",
        body: [
          {
            list: [
              "**Account**: name, email address, phone number and password (stored in a form no one can read back).",
              "**Orders**: delivery address, wilaya and commune, phone number, products ordered, amounts and payment method.",
              "Your saved addresses, wishlist and the reviews you write.",
              "**Technical data**: IP address and error reports, to keep the site secure and working.",
            ],
          },
          "Card payments are handled by Chargily Pay: we never receive your card details.",
        ],
      },
      {
        heading: "Why we use it",
        body: [
          {
            list: [
              "To process, confirm (by call or SMS code) and deliver your orders, and to handle cancellations and exchanges.",
              "To send emails about your account and orders: confirmation, shipping, password reset.",
              "To prevent fraud and abuse, such as repeated refused deliveries.",
              "To meet our legal and accounting obligations.",
            ],
          },
          "We don't sell your data, and we don't send you advertising without your consent.",
        ],
      },
      {
        heading: "Who receives it",
        body: [
          {
            list: [
              "The seller of the products you order and the delivery company: only what they need to prepare and deliver your order (name, phone, address).",
              "Our technical providers, only to run the service: hosting, email and SMS sending, image storage, error tracking and card payment. Some of them are located outside Algeria.",
              "The authorities, when the law requires it.",
            ],
          },
        ],
      },
      {
        heading: "How long we keep it",
        body: [
          "Order data is kept for as long as accounting and commercial law require. Account data is kept while your account is active; if you ask us to delete your account, we delete or anonymise it, except what the law obliges us to keep. Technical logs are kept for a short time only.",
        ],
      },
      {
        heading: "Cookies and storage in your browser",
        body: [
          "We only use what the site needs to work: a cookie that keeps you signed in, and storage in your browser for your cart, language, theme and recent searches. No advertising or tracking cookies.",
        ],
      },
      {
        heading: "Your rights",
        body: [
          `You can access, correct and delete your data, and object to its use for a legitimate reason. You can change your name and phone number in [your profile](/profile); for anything else, write to ${v.email}. You can also contact the national authority for the protection of personal data (ANPDP).`,
        ],
      },
      {
        heading: "Security",
        body: [
          "Data travels encrypted (HTTPS), passwords are hashed, and access to the dashboard is restricted and logged. Admin accounts can use two-step verification.",
        ],
      },
      {
        heading: "Changes",
        body: ["We may update this policy; the new version is always published on this page."],
      },
    ],
  },
});
