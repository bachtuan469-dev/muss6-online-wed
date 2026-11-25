# hud

Always-on interface elements, one folder per element, same shape as a window. Recipe:
[docs/how_to/change_a_window.md](../../../../docs/how_to/change_a_window.md).

## Public API
- Each `window.ts` default-exports a `defineWindow({ id, slot, order, component, module? })`.
  An element of an optional module names it and is not drawn where that module is off
  (`soccer_score`: `guild_war`); see [../windows/readme.md](../windows/readme.md).
- `stableKeyOf` (stable React keys) is `src/core/stableKey.ts`, shared with the item grid widget.

## How it works
- Registered by the same glob as the windows (`versions/shared/ui/index.ts`).
- An element's text is in its `i18n/<code>.ts` (`en.ts` plus one file per language), found by
  `src/i18n`'s glob ([src/i18n/readme.md](../../../../src/i18n/readme.md)).
- `slot: 'world'` draws over the 3D view under the HUD and stays up when the hide-interface key is
  pressed; `slot: 'hud'` hides with the rest of the interface. Higher `order` draws on top.

| Folder | id (slot, order) | Shows | Reads |
|---|---|---|---|
| `low_health_overlay` | low_health_overlay (world, 10) | red or blue screen-edge pulse at low health or mana | Hero, options |
| `world_objects` | world_objects (world, 20) | drop names and tooltips (ALT), and hosts name tags, party bars, emoji bubbles | Ecs.world, drops, options |
| `damage_numbers` | damage_numbers (world, 30) | floating damage, miss and shield numbers | `objectDamaged` events |
| `target_health_bar` | target_health_bar (hud, 10) | the target's name and health bar | Ecs.world |
| `map_name_banner` | map_name_banner (hud, 20) | the map name picture on entering a map (FIX26: always the English picture - map names stay English in every language) | Loading.sceneLoading, events |
| `perf_readout` | perf_readout (hud, 30) | frames, frame time and server round trip | Ecs.world, options |
| `notices` | notices (hud, 40) | the centred notice stack | chat |
| `slide_help` | slide_help (hud, 50) | the scrolling help band at the top | options |
| `buff_bar` | buff_bar (hud, 60) | the hero's buffs and debuffs with tooltips | skills |
| `bottom_bar` | bottom_bar (hud, 70) | main frame: orbs, potion slots (as many as `features.itemHotkeys.slots`), skill hotkeys and fan, exp bar; on a phone a slim strip (ours): exp strip only, no skill slots (the touch row has them), no window buttons (the gear cluster holds them); the potion slots moved beside the move stick and the vitals to four bars left of the top-left helper buttons | Hero, skills, inventory |
| `chat` | chat (hud, 230) | chat input box and chat log | chat, social, options |
| `soccer_score` | soccer_score (hud, 420) | Battle Soccer scoreboard (its clock line is `soccerBoardClock`) | GuildMarks, social, options |
| `match_time` | match_time (hud, 425) | the soccer time at the screen centre (`RenderTournamentInterface`); off with `soccerBoardClock` | social, options |
| `minimap` | minimap (hud, 450) | full world map on TAB and the corner minimap, turned by the camera heading (`rotation.ts`: the original's 45 degrees counter-clockwise); on a phone the corner map folds to one small square (ours, `minimapCornerCollapsed`), and the event-timer lines under it are gone | Ecs.world, hero, options, social |
| `camera_reset` | camera_reset (hud, 455) | Reset camera while the view is off the map's frame (ours, `cameraKeepsView`); left of the corner minimap and the party list | camera, social, options |
| `mu_helper_buttons` | mu_helper_buttons (hud, 456) | MU Helper Start / Stop and Settings under the event timers (ours, `muHelperButtons`); on a phone a row of nine 40 px squares at the top (A, cog, D, C, I, keyboard, M, Master, ESC), right of the vital cluster - a 40 px avatar circle (class badge + level) left of four vital bars (HP, SD, AG, MP; HP and MP twice as tall), flush at the top edge; only with the `mu_helper` module | mu_helper, events, options |
| `mobile_controls` | mobile_controls (hud, 490) | touch HUD (ours, `touchControls`): a stick at the lower left that walks the hero, the digit slots' skill buttons in a row at the lower right (five, 44 px, a hold opens the picker for the slot), and the potion icons beside the move stick; a tap on a monster attacks it, the way a mouse click does on a PC - the aim stick is gone (user decision, 2026-11-24). The ATK button and its skill fan are gone (user decision, 2026-11-24). The old floating shortcuts (move button, skill pad, menu cluster) stay removed, their files unmounted | skills, combat, options |
| `name_tags` | - | names and guild marks over characters | Ecs.world, guild, social |
| `party_list` | party_list (hud, 65) | the always-on member list at the top right (`CNewUIPartyListWindow`); left of the corner minimap while that is on, not moved for open windows (ours are scaled and dragged) | social, skills, Ecs.world |
| `party_bars` | - | party member HP pips over heads | social |
| `emoji_bubbles` | - | a character's emoji bubble | chat |

`name_tags`, `party_bars` and `emoji_bubbles` have no `window.ts`; `world_objects` draws them.

FIX26: the avatar circle is a class badge (DK, DW, EF, DL, MG, SU, RF), not a
portrait, because no per-class portrait ships anywhere in the client -
`Data/Interface/` holds none, the character and party windows never draw one,
and the muss20 APK ships a single `class-1.ozj`, not a set. A live 3D head
render would be a bigger feature. The level badge reads `Hero.level`, so it
follows a level-up. The Master gear button uses the character sheet's own
Master art (`newui_chainfo_btn_master.OZT`) and the A key's toggle; the
sheet's button is class-gated per the original, the key and this button are
not. The system toast (error lines only, 4 s, tap to dismiss) sits at top
84 px to clear the 72 px vital cluster.

## Depends on / used by
- uses: `src/modules/*` (through their doors), `Ecs.world`, `src/controllers/interface` (registry, widgets, hooks)
- used by: `../index.ts` (glob); `../pages/world` draws them

## Change it
- redraw an element: edit its `index.tsx` and `style.less`.
- add an element: new folder with `index.tsx` and `window.ts`; `slot: 'world'` if it should stay
  up when the interface is hidden.

## Tests
- `bottom_bar/belt.test.tsx`: the bar draws the potion slots the version has (four, three, none).
- `bottom_bar/mobile.test.tsx`: on a phone the bar is only the exp strip and the 51 px height, and draws no skill slots, potion slots, vitals or window buttons; the frame art's baked-in boxes are painted over.
- `mobile_controls/mobileLayout.test.ts`: the touch HUD rects at 844x390 - the skill row, the potion row and the vital bars clear the sticks, the chat, the minimap and the bar.
- `mobile_controls/potionTap.test.ts`: one tap on a floating potion icon drinks, unless that tap just bound a carried potion.
- `mobile_controls/potionCluster.test.tsx`: the four potion slots at 28x28 beside the move stick.
- `mu_helper_buttons/vitalBars.test.tsx`: the four top-left vital bars in order HP, SD, AG, MP, in the orb colours (AG purple), with number and percent; HP and MP twice as tall as SD and AG, and the 40 px avatar circle left of them with the hero's class badge and level (FIX26).
- `mu_helper_buttons/index.mobile.test.tsx`: the nine phone squares in order A, cog, D, C, I, keyboard, M, Master, ESC, right of the vital cluster at 184 px, and the Master toggle round trip (FIX26).
- `damage_numbers/index.test.tsx`: no number is made while the page is hidden (they would all rise
  together when it shows).
- `minimap/rotation.test.ts`: the map turn (the camera heading, -45 with no world) and the marker turn.
- `minimap/collapse.test.ts`: the corner panel spans the full map while open and the mini square while folded.
- `mobile_controls/index.test.tsx`: the move stick and the skill row on a touch device, no ATK button, no aim stick; nothing on Classic.
- `mobile_controls/castSkill.test.ts`: a skill that needs a target takes the nearest monster first; a self cast never does.
- `party_list/rows.test.ts`: which members are found on screen, and the name colours.
- `low_health_overlay/heartbeat.test.ts`: the heartbeat beats back to back while due, and books
  no next beat once it is not.
- `match_time/index.test.tsx`: the original's centre line on Classic (red, yellow under a minute, none
  at 0 or past ten minutes); `soccerBoardClock` puts the clock on the board instead.
- `name_tags/tagSync.test.ts`: the tag layout matches the measuring pass and pushes overlapping
- `mu_helper_buttons/index.test.tsx`: the buttons show in the world on Enhanced and draw nothing on Classic.
  slots apart.
