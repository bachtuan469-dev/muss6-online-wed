/** Portuguese text of the `inventory` window. */

import type en from './en';

export default {
  'inventory.title': 'Inventário',
  'inventory.close': 'Fechar (I,V)',
  'inventory.repair': 'Reparar (L)',
  'inventory.personalShop': 'Loja pessoal',
  'inventory.expand': 'Abrir o inventário estendido (K)',
  'inventory.useItem': 'Usar',
  'inventory.equipItem': 'Equipar',
  'inventory.learnSkill': 'Aprender',
} satisfies Partial<Record<keyof typeof en, string>>;
