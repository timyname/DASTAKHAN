/** Pure demo policy helpers. No identity, payment or server-authority guarantees. */
export type RewardChoice = 'half_now' | 'free_next_visit';
export type RewardStatus = 'available' | 'redeemed' | 'cancelled';

export interface MenuDish {
  id: string;
  tenantId: string;
  name: string;
  /** Integer currency minor units (100 tiyn = 1 KZT), never floating point money. */
  priceMinor: number;
  available: boolean;
}

export interface Reward {
  id: string;
  tenantId: string;
  guestId: string;
  dishId: string;
  sourceOrderId: string;
  choice: RewardChoice;
  status: RewardStatus;
  issuedAt: number;
  expiresAt: number;
  /** Frozen at issue time: later menu edits must not silently alter a promise. */
  priceMinor: number;
}

export interface RedemptionContext {
  tenantId: string;
  guestId: string;
  orderId: string;
  orderOpenedAt: number;
  now: number;
  dishAvailable: boolean;
}

export type Rejection = 'wrong_tenant' | 'wrong_guest' | 'not_available' |
  'not_yet_issued' | 'expired' | 'dish_unavailable' | 'current_order_required' |
  'next_visit_required' | 'invalid_context';

const money = (value: number) => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError('Money must be a nonnegative safe integer in minor units');
  }
};

/** The current reward discounts ONE dish, not half of the entire restaurant bill. */
export function quoteReward(priceMinor: number, choice: RewardChoice) {
  money(priceMinor);
  const guestPaysMinor = choice === 'half_now' ? Math.ceil(priceMinor / 2) : 0;
  return { priceMinor, guestPaysMinor, discountMinor: priceMinor - guestPaysMinor };
}

/** A future visit must have a distinct order opened after reward issuance. */
export function redemptionEligibility(
  reward: Reward,
  context: RedemptionContext,
): { eligible: true } | { eligible: false; reason: Rejection } {
  const reject = (reason: Rejection) => ({ eligible: false as const, reason });
  if (![context.now, context.orderOpenedAt, reward.issuedAt, reward.expiresAt].every(Number.isFinite) ||
      reward.expiresAt <= reward.issuedAt || context.orderOpenedAt > context.now ||
      !context.orderId || !context.tenantId || !context.guestId) return reject('invalid_context');
  if (reward.tenantId !== context.tenantId) return reject('wrong_tenant');
  if (reward.guestId !== context.guestId) return reject('wrong_guest');
  if (reward.status !== 'available') return reject('not_available');
  if (context.now < reward.issuedAt) return reject('not_yet_issued');
  if (context.now >= reward.expiresAt) return reject('expired');
  if (!context.dishAvailable) return reject('dish_unavailable');
  if (reward.choice === 'half_now' && context.orderId !== reward.sourceOrderId) {
    return reject('current_order_required');
  }
  if (reward.choice === 'free_next_visit' &&
      (context.orderId === reward.sourceOrderId || context.orderOpenedAt <= reward.issuedAt)) {
    return reject('next_visit_required');
  }
  return { eligible: true };
}

/** Pure transition only. Production must execute this inside an atomic transaction. */
export function redeemReward(reward: Reward, context: RedemptionContext) {
  const decision = redemptionEligibility(reward, context);
  if (!decision.eligible) return { ok: false as const, reason: decision.reason };
  return {
    ok: true as const,
    reward: { ...reward, status: 'redeemed' as const },
    quote: quoteReward(reward.priceMinor, reward.choice),
  };
}
