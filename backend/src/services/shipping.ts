import { EntityManager } from "typeorm";
import { DeliveryType, PaymentMethod } from "../entities/Order";
import { ShippingZone } from "../entities/ShippingZone";
import { HttpError } from "../utils/httpError";

// Online card payment needs Chargily; pay on delivery always works.
export function availablePaymentMethods(): PaymentMethod[] {
  return process.env.CHARGILY_API_KEY ? ["cod", "card"] : ["cod"];
}

// The delivery fee for a wilaya + delivery type, from the super admin's
// price table. Rejects wilayas or options that aren't offered.
export async function quoteShipping(
  manager: EntityManager,
  wilayaCode: number,
  deliveryType: DeliveryType,
): Promise<{ zone: ShippingZone; fee: number }> {
  const zone = await manager
    .getRepository(ShippingZone)
    .findOne({ where: { code: wilayaCode } });
  if (!zone || !zone.isActive) {
    throw new HttpError(400, "We don't deliver to this wilaya yet");
  }
  if (deliveryType === "desk" && zone.deskPrice == null) {
    throw new HttpError(400, `Stop-desk pick-up isn't available in ${zone.name}`);
  }
  const fee = Number(deliveryType === "desk" ? zone.deskPrice : zone.homePrice);
  return { zone, fee };
}
