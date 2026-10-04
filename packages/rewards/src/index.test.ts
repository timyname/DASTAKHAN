import { describe, expect, it } from 'vitest';
import { quoteReward, redeemReward, redemptionEligibility, type Reward, type RedemptionContext } from './index';

const reward: Reward = {
  id: 'reward-1', tenantId: 'cafe-1', guestId: 'guest-1', dishId: 'tea',
  sourceOrderId: 'order-1', choice: 'half_now', status: 'available',
  issuedAt: 100, expiresAt: 1000, priceMinor: 120000,
};
const context: RedemptionContext = {
  tenantId: 'cafe-1', guestId: 'guest-1', orderId: 'order-1',
  orderOpenedAt: 50, now: 200, dishAvailable: true,
};

describe('reward policy boundaries', () => {
  it('discounts one dish by half with deterministic minor-unit rounding', () => {
    expect(quoteReward(120001, 'half_now')).toEqual({ priceMinor: 120001, guestPaysMinor: 60001, discountMinor: 60000 });
    expect(quoteReward(120000, 'free_next_visit').guestPaysMinor).toBe(0);
    expect(() => quoteReward(-1, 'half_now')).toThrow();
    expect(() => quoteReward(1.5, 'half_now')).toThrow();
  });

  it.each([
    [{ tenantId: 'another-cafe' }, 'wrong_tenant'],
    [{ guestId: 'another-guest' }, 'wrong_guest'],
    [{ now: 1000 }, 'expired'],
    [{ now: 99 }, 'not_yet_issued'],
    [{ dishAvailable: false }, 'dish_unavailable'],
    [{ orderId: 'another-order' }, 'current_order_required'],
    [{ now: Number.NaN }, 'invalid_context'],
  ] as const)('rejects invalid redemption %j', (override, reason) => {
    expect(redemptionEligibility(reward, { ...context, ...override })).toEqual({ eligible: false, reason });
  });

  it('requires a genuinely later order for the next-visit option', () => {
    const next = { ...reward, choice: 'free_next_visit' as const };
    expect(redemptionEligibility(next, context).eligible).toBe(false);
    expect(redemptionEligibility(next, { ...context, orderId: 'order-2' }).eligible).toBe(false);
    expect(redemptionEligibility(next, { ...context, orderId: 'order-2', orderOpenedAt: 150 })).toEqual({ eligible: true });
  });

  it('returns new state and rejects a second redemption of that state', () => {
    const result = redeemReward(reward, context);
    expect(result.ok).toBe(true);
    expect(reward.status).toBe('available');
    if (!result.ok) throw new Error('Expected redemption');
    expect(redeemReward(result.reward, context)).toEqual({ ok: false, reason: 'not_available' });
    expect(result.quote.discountMinor).toBe(60000);
  });

  it('rejects cancelled vouchers and future order timestamps', () => {
    expect(redemptionEligibility({ ...reward, status: 'cancelled' }, context).eligible).toBe(false);
    expect(redemptionEligibility(reward, { ...context, orderOpenedAt: 201 })).toEqual({ eligible: false, reason: 'invalid_context' });
  });
});
