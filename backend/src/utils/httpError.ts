// Throw from a route/service to send a specific status + JSON body. The global
// error handler (middleware/errorHandler.ts) turns it into the response.
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export interface StockIssue {
  productId: string;
  productName?: string;
  // Set when the line is a product option ("M", "Bleu / L").
  variantId?: string | null;
  variantName?: string | null;
  availableStock: number;
  requestedQuantity: number;
}

export function stockConflict(message: string, issues: StockIssue[]) {
  return new HttpError(409, message, { issues });
}
