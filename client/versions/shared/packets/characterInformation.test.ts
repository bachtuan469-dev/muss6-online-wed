import { describe, expect, it } from 'vitest';
import { CharacterInformationPacket } from './ServerToClientPackets';

/**
 * A decrypted CharacterInformation (F3 03) as the socket hands it over:
 * header, X, Y, then the map byte and the facing byte. The bytes below are
 * a real second-entry packet (a switch back to a Lorencia character whose
 * facing was 3): OpenMU's struct keeps MapId in one byte (Span[6]) and the
 * Direction in the next (Span[7]), so the map is 0, not 768.
 */
function packet(x: number, y: number, mapId: number, direction: number) {
  const bytes = new Uint8Array(CharacterInformationPacket.Length);
  bytes[0] = 0xc3;
  bytes[1] = CharacterInformationPacket.Length;
  bytes[2] = 0xf3;
  bytes[3] = 0x03;
  bytes[4] = x;
  bytes[5] = y;
  bytes[6] = mapId;
  bytes[7] = direction;
  return new CharacterInformationPacket(new DataView(bytes.buffer));
}

describe('CharacterInformation map and facing', () => {
  it('reads the map as one byte, not merged with the facing', () => {
    const p = packet(137, 125, 0, 3);
    expect(p.X).toBe(137);
    expect(p.Y).toBe(125);
    expect(p.MapId).toBe(0);
    expect(p.Direction).toBe(3);
  });

  it('still reads a nonzero map with a zero facing', () => {
    const p = packet(175, 110, 3, 0);
    expect(p.MapId).toBe(3);
    expect(p.Direction).toBe(0);
  });

  it('writing the map leaves the facing byte alone', () => {
    const p = packet(137, 125, 0, 3);
    p.MapId = 5;
    expect(p.MapId).toBe(5);
    expect(p.Direction).toBe(3);
  });
});
