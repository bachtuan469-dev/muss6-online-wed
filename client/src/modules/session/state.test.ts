import { describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  const g = globalThis as Record<string, unknown>;
  g.location ??= { href: 'http://localhost/', search: '', hostname: 'localhost', protocol: 'http:' };
});

const { Session } = await import('./state');

describe('Session.sendToGS', () => {
  it('sends only the bytes its DataView covers, not the whole buffer under it', () => {
    const sent: Uint8Array[] = [];
    Session.gsSocket = { readyState: WebSocket.OPEN, send: (p: Uint8Array) => sent.push(p) } as unknown as WebSocket;
    const buffer = new Uint8Array([9, 9, 9, 9, 0xc1, 4, 0xe8, 0, 9, 9]).buffer;

    Session.sendToGS(new DataView(buffer, 4, 4));
    Session.gsSocket = undefined;

    expect(sent).toHaveLength(1);
    expect(sent[0].byteLength).toBe(4);
    expect([sent[0][0], sent[0][1]]).toEqual([0xc1, 4]);
  });
});

// CLoginWin::CancelLogin (LoginWin.cpp:416-427): the game server goes, the connect server is
// dialled again and the server list shows; the typed fields stay.
describe('Session.cancelLogin', () => {
  it('goes back to the server list', async () => {
    const { AppState, UIState } = await import('@/controllers/interface/uiState');
    const dial = vi.spyOn(Session, 'connectToConnectServer').mockImplementation(() => undefined);
    const close = vi.fn();
    Session.gsSocket = { close } as unknown as WebSocket;
    Session.username = 'hero';
    Session.loginError = 'Wrong password';
    AppState.uiState = UIState.Login;

    Session.cancelLogin();

    expect(close).toHaveBeenCalled();
    expect(Session.gsSocket).toBeUndefined();
    expect(dial).toHaveBeenCalled();
    expect(AppState.uiState).toBe(UIState.Servers);
    expect(Session.loginError).toBeUndefined();
    expect(Session.username).toBe('hero');
  });
});

// The login packet carries the password in a ten-byte field, so a password
// of exactly 10 characters leaves no NUL terminator and the server answers
// InvalidPassword. The window must say so before anything is sent.
describe('Session.loginPasswordProblem', () => {
  it('is null for an empty password: the saved token goes instead', () => {
    Session.username = 'test0';
    Session.password = '';

    expect(Session.loginPasswordProblem).toBeNull();
  });

  it('names a password shorter than 3 characters', () => {
    Session.password = 'ab';

    expect(Session.loginPasswordProblem).toBe('passwordShort');
  });

  it('accepts the 3 and 9 character bounds', () => {
    Session.password = 'abc';
    expect(Session.loginPasswordProblem).toBeNull();

    Session.password = 'abcdefghi';
    expect(Session.loginPasswordProblem).toBeNull();
  });

  it('names a password longer than 9 characters', () => {
    Session.password = 'abcdefghij';

    expect(Session.loginPasswordProblem).toBe('passwordLong');
  });

  it('leaves the submit gate as it was: empty with no token cannot submit', () => {
    Session.username = 'test0';
    Session.password = '';

    expect(Session.savedToken).toBeNull();
    expect(Session.canSubmitLogin).toBe(false);

    Session.password = 'abc';
    expect(Session.canSubmitLogin).toBe(true);
  });
});
