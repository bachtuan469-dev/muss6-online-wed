-- Export tu database OpenMU live (muss20web), ngay 2026-11-25.
-- Chi chua du lieu CAU HINH (khong co tai khoan, nhan vat, mat khau, hash).
-- Ap tren database OpenMU da khoi tao (schema config.* do OpenMU tu tao).
-- 01-game-configuration.sql
-- EXP hien tai: ExperienceRate = 100, MasterExperienceRate = 100
-- (user lenh tang tu 10 len 100 ngay 2026-11-25). Level toi da 400,
-- master toi da 200. UPDATE 1 dong GameConfiguration hien co.
-- Ap: psql -d <db> -v ON_ERROR_STOP=1 -f 01-game-configuration.sql

UPDATE config."GameConfiguration" SET
    "MaximumLevel" = '400',
    "MaximumMasterLevel" = '200',
    "ExperienceRate" = '100',
    "MinimumMonsterLevelForMasterExperience" = '95',
    "InfoRange" = '12',
    "AreaSkillHitsPlayer" = 'f',
    "MaximumInventoryMoney" = '2147483647',
    "MaximumVaultMoney" = '2147483647',
    "RecoveryInterval" = '3000',
    "MaximumLetters" = '50',
    "LetterSendPrice" = '1000',
    "MaximumCharactersPerAccount" = '5',
    "CharacterNameRegex" = '^[a-zA-Z0-9]{3,10}$',
    "MaximumPasswordLength" = '20',
    "MaximumPartySize" = '5',
    "ShouldDropMoney" = 't',
    "DamagePerOneItemDurability" = '69',
    "DamagePerOnePetDurability" = '100',
    "HitsPerOneItemDurability" = '564',
    "ItemDropDuration" = '00:01:00',
    "DuelConfigurationId" = 'e5f8a101-0000-70ed-4ac5-8f1c8e1c7835',
    "ExperienceFormula" = 'if(level == 0, 0, if(level < 256, 10 * (level + 8) * (level - 1) * (level - 1), (10 * (level + 8) * (level - 1) * (level - 1)) + (1000 * (level - 247) * (level - 256) * (level - 256))))',
    "MasterExperienceFormula" = '(505 * level * level * level) + (35278500 * level) + (228045 * level * level)',
    "MaximumItemOptionLevelDrop" = '3',
    "ClampMoneyOnPickup" = 'f',
    "PreventExperienceOverflow" = 'f',
    "MasterExperienceRate" = '100',
    "ExcellentItemDropLevelDelta" = '25',
    "CastleSiegeConfigurationId" = 'e5f8a101-0000-78ec-4eaf-6bf527ed37e1',
    "CashShopConfigurationId" = 'e5f8a101-0000-7282-8e68-8beac16111e6',
    "AncientDropLevelBonus" = '30',
    "ExcellentDropLevelBonus" = '25'
WHERE "Id" = '00000001-0001-0000-0000-000000000000';
