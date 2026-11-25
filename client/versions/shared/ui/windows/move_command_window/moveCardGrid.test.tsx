import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MoveCardGrid, type MoveCard } from './moveCardGrid';

/** FIX22: the M window on a phone is a grid of big-tap cards, like 0.97's
 * move modal, instead of the desktop's 13 px text rows. */
const CARDS: readonly MoveCard[] = [
  {
    entry: {
      index: 2,
      name: 'Lorencia',
      alias: 'lorencia',
      reqLevel: 0,
      reqMaxLevel: 0,
      zen: 0,
      gate: 0,
    },
    reqLevel: 0,
    canMove: true,
    starred: false,
  },
  {
    entry: {
      index: 4,
      name: 'Devias',
      alias: 'devias',
      reqLevel: 10,
      reqMaxLevel: 0,
      zen: 5000,
      gate: 0,
    },
    reqLevel: 10,
    canMove: true,
    starred: true,
  },
  {
    entry: {
      index: 31,
      name: 'Elveland',
      alias: 'elveland',
      reqLevel: 100,
      reqMaxLevel: 0,
      zen: 20000,
      gate: 0,
    },
    reqLevel: 100,
    canMove: false,
    starred: false,
  },
];

describe('the move card grid (FIX22)', () => {
  it('shows one big-tap card per map: name, level, cost', () => {
    const markup = renderToStaticMarkup(<MoveCardGrid cards={CARDS} onWarp={() => {}} />);
    expect(markup.match(/move-card (can-move|cannot-move)/g)).toHaveLength(3);
    expect(markup).toContain('Lorencia');
    expect(markup).toContain('Lv 10');
    expect(markup).toContain('5000');
  });

  it('marks the map the hero cannot reach yet', () => {
    const markup = renderToStaticMarkup(<MoveCardGrid cards={CARDS} onWarp={() => {}} />);
    expect(markup).toContain('cannot-move');
    expect(markup).toContain('Elveland');
  });

  it('stars a favourite', () => {
    const markup = renderToStaticMarkup(<MoveCardGrid cards={CARDS} onWarp={() => {}} />);
    expect(markup).toContain('move-card-star');
  });
});
