import { uiClick } from '@/controllers/sound/sfx';
import type { MoveReqEntry } from '@/controllers/assets/mu';

/**
 * One map as a big-tap card, the way 0.97's move modal shows it: the map
 * name, the level it needs, and the zen it costs. A tap warps; a map the
 * hero cannot reach yet is dimmed and does nothing.
 */
export type MoveCard = {
  entry: MoveReqEntry;
  /** `effectiveMoveLevel`: the requirement after the MG / DL / RF reduction. */
  reqLevel: number;
  canMove: boolean;
  starred: boolean;
};

export const MoveCardGrid = ({
  cards,
  onWarp,
}: {
  cards: readonly MoveCard[];
  onWarp: (entry: MoveReqEntry) => void;
}) => (
  <div className="move-card-grid" data-no-drag="true">
    {cards.map(card => (
      <div
        key={card.entry.index}
        role="button"
        className={`move-card${card.canMove ? ' can-move' : ' cannot-move'}`}
        onClick={card.canMove ? uiClick(() => onWarp(card.entry)) : undefined}
      >
        {card.starred && <span className="move-card-star">★</span>}
        <span className="move-card-name">{card.entry.name}</span>
        <span className="move-card-req">
          Lv {card.reqLevel}
          {card.entry.zen > 0 ? ` · ${card.entry.zen} Zen` : ''}
        </span>
      </div>
    ))}
  </div>
);
