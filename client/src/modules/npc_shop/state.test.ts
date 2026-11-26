import { afterEach, describe, expect, it, vi } from 'vitest';
import { runInAction } from 'mobx';
import type { Item } from '@/ecs/world';

vi.hoisted(() => {
  const g = globalThis as Record<string, unknown>;
  g.location ??= { href: 'http://localhost/', search: '', hostname: 'localhost', protocol: 'http:' };
});

// Skills first: they keep the app import cycle in order (versions/shared/skills/readme.md).
await import('@versions/shared/skills/skillVisuals');
const { Merchant } = await import('./state');
const { Session } = await import('../session');
const { Hero } = await import('../hero');
const { MsgBox, MsgWinCode } = await import('@/controllers/interface/msgWin');
const { npcBuyPrice, withTax } = await import('@/controllers/item_rules/itemValue');

/**
 * FIX25 Viec 5: buying from an NPC shop without enough Zen showed nothing.
 * The request went out with no Zen check, and the server's refusal only
 * reached the chat log, hidden behind the shop window on mobile. The
 * client now refuses the buy itself, and a server refusal raises the
 * standard message box, where the player can see it.
 */
describe('Merchant.buyItemFromNpc', () => {
  // Group 14, index 13: a Jewel of Bless with a real shop price (180,000 after the
  // FIX34 divisor), big enough that the castle tax shows up in the checked price.
  const jewel = { group: 14, num: 13, lvl: 0, durability: 1 } as unknown as Item;
  const sent = vi.spyOn(Session, 'sendToGS').mockImplementation(() => {});

  const openShop = () => {
    Merchant.openNpcShop();
    Merchant.setNpcShopItems([{ slot: 0, item: jewel }]);
  };

  const price = () => withTax(npcBuyPrice(jewel), Merchant.npcShop?.taxRate ?? 0);

  afterEach(() => {
    Merchant.finishShopBuy();
    Merchant.closeNpcShop();
    MsgBox.closeMsgWin();
    runInAction(() => {
      Session.isOffline = false;
      Merchant.setStoreTaxRate(0);
      Hero.money = 0;
    });
    sent.mockClear();
  });

  it('shows not-enough-Zen and sends nothing when the purse is short', () => {
    openShop();
    expect(price()).toBeGreaterThan(0);
    runInAction(() => {
      Hero.money = price() - 1;
    });
    Merchant.buyItemFromNpc(0);
    expect(sent).not.toHaveBeenCalled();
    expect(Merchant.shopBuyPending).toBe(false);
    expect(MsgBox.msgWin).not.toBeNull();
    expect(MsgBox.msgWin?.code).toBe(MsgWinCode.NotEnoughZen);
  });

  it('counts the castle tax in the price it checks', () => {
    openShop();
    Merchant.setStoreTaxRate(10);
    const base = npcBuyPrice(jewel);
    expect(price()).toBeGreaterThan(base);
    runInAction(() => {
      Hero.money = base;
    });
    Merchant.buyItemFromNpc(0);
    expect(sent).not.toHaveBeenCalled();
    expect(MsgBox.msgWin).not.toBeNull();
    expect(MsgBox.msgWin?.code).toBe(MsgWinCode.NotEnoughZen);
  });

  it('sends the request when the purse covers the taxed price', () => {
    openShop();
    runInAction(() => {
      Hero.money = price();
    });
    Merchant.buyItemFromNpc(0);
    expect(sent).toHaveBeenCalled();
    expect(Merchant.shopBuyPending).toBe(true);
    expect(MsgBox.msgWin).toBeNull();
  });
});

describe('Merchant.shopBuyFailed', () => {
  it('raises the message box, so the refusal is seen over the shop', () => {
    runInAction(() => {
      Merchant.shopBuyPending = true;
    });
    Merchant.shopBuyFailed();
    expect(Merchant.shopBuyPending).toBe(false);
    expect(MsgBox.msgWin).not.toBeNull();
    expect(MsgBox.msgWin?.code).toBe(MsgWinCode.CannotBuy);
    MsgBox.closeMsgWin();
  });
});
