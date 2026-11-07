import { EntityManager } from "typeorm";
import { Order, OrderStatus } from "../entities/Order";
import { Shipment } from "../entities/Shipment";

// Fulfilment progress, in order. "cancelled" is handled at the order level
// (it restocks), never through a single shop's shipment.
const PROGRESS: OrderStatus[] = ["pending", "processing", "shipped", "delivered"];

// The order is only as far along as its slowest shipment: it's "shipped"
// once every shop has shipped, "delivered" once every shop has delivered.
export function rollUpStatus(shipmentStatuses: OrderStatus[]): OrderStatus {
  const ranks = shipmentStatuses
    .filter((s) => s !== "cancelled")
    .map((s) => PROGRESS.indexOf(s));
  if (ranks.length === 0) return "pending";
  return PROGRESS[Math.min(...ranks)];
}

export async function createShipments(
  manager: EntityManager,
  orderId: string,
  shopIds: string[],
) {
  const repo = manager.getRepository(Shipment);
  for (const shopId of new Set(shopIds)) {
    await repo.save(repo.create({ orderId, shopId, status: "pending" }));
  }
}

// When the order itself changes status (super admin, a single-shop order, the
// payment webhook, the expiry job), every shipment follows it.
export async function syncShipments(
  manager: EntityManager,
  orderId: string,
  status: OrderStatus,
) {
  await manager.getRepository(Shipment).update({ orderId }, { status });
}

export function shipmentsOf(manager: EntityManager, order: Pick<Order, "id">) {
  return manager.getRepository(Shipment).find({ where: { orderId: order.id } });
}
