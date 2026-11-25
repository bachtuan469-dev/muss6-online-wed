import { afterEach, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { runInAction } from 'mobx';
import { MsgBox, MsgWinCode } from '@/controllers/interface/msgWin';
import { MsgWindow } from '.';

afterEach(() => {
  runInAction(() => {
    MsgBox.msgWin = null;
  });
});

describe('MsgWindow input', () => {
  it('shows a plain text field for the trade name prompt', () => {
    runInAction(() => {
      MsgBox.msgWin = { code: MsgWinCode.EnterPlayerName, text: 'Enter the name of the player to trade with:' };
    });
    const html = renderToStaticMarkup(<MsgWindow />);
    expect(html).toContain('type="text"');
    expect(html).not.toContain('type="password"');
  });

  it('keeps the security code masked', () => {
    runInAction(() => {
      MsgBox.msgWin = { code: MsgWinCode.DeleteCharacterResident, text: 'Please enter your security code.' };
    });
    const html = renderToStaticMarkup(<MsgWindow />);
    expect(html).toContain('type="password"');
  });
});
