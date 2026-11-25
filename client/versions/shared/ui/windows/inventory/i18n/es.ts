/** Spanish text of the `inventory` window. */

import type en from './en';

export default {
  'inventory.title': 'Inventario',
  'inventory.close': 'Cerrar (I,V)',
  'inventory.repair': 'Reparar (L)',
  'inventory.personalShop': 'Tienda personal',
  'inventory.expand': 'Abrir el inventario ampliado (K)',
  'inventory.useItem': 'Usar',
  'inventory.equipItem': 'Equipar',
  'inventory.learnSkill': 'Aprender',
} satisfies Partial<Record<keyof typeof en, string>>;
