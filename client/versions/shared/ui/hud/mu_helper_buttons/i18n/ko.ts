/** Korean text of the `mu_helper_buttons` HUD element. */

import type en from './en';

export default {
  'muHelperButtons.start': '헬퍼 시작',
  'muHelperButtons.stop': '헬퍼 중지',
  'muHelperButtons.settings': '헬퍼 설정',
  'muHelperButtons.command': '명령',
  'muHelperButtons.characterInfo': '캐릭터 정보',
  'muHelperButtons.inventory': '인벤토리',
  'muHelperButtons.keyboard': '키보드',
  'muHelperButtons.move': '이동 목록',
  'muHelperButtons.escape': '닫기 / 메뉴',
  'muHelperButtons.master': '마스터 스킬',
} satisfies Partial<Record<keyof typeof en, string>>;
