-- local-test-db.sql — DB TOI THIEU local de smoke-test backend mu-web.
-- CHI dung o local (DB muwebtest), khong dung cho VPS.
-- Chi co dung ten bang/cot ma server.js + openmu-accounts.js cham toi,
-- du lieu gia (1 account test0 + 1 nhan vat test0Dk Lv 400).
--   sudo -u postgres psql -f local-test-db.sql

DROP DATABASE IF EXISTS muwebtest;
CREATE DATABASE muwebtest;
\c muwebtest

CREATE SCHEMA data;
CREATE SCHEMA config;
CREATE SCHEMA web;

CREATE TABLE config."AttributeDefinition" ("Id" uuid PRIMARY KEY, "Designation" varchar(50) NOT NULL);
CREATE TABLE config."CharacterClass" ("Id" uuid PRIMARY KEY, "Name" varchar(100) NOT NULL);
CREATE TABLE config."GameMapDefinition" ("Id" uuid PRIMARY KEY, "Name" varchar(100) NOT NULL);
CREATE TABLE config."GameConfiguration" ("Id" uuid PRIMARY KEY, "ExperienceRate" int NOT NULL DEFAULT 1, "MaximumLevel" smallint NOT NULL DEFAULT 400);

CREATE TABLE data."ItemStorage" ("Id" uuid PRIMARY KEY, "Money" int NOT NULL DEFAULT 0);
CREATE TABLE data."Account" (
  "Id" uuid PRIMARY KEY, "VaultId" uuid, "LoginName" varchar(10) NOT NULL,
  "PasswordHash" varchar(128) NOT NULL, "SecurityCode" varchar(20) NOT NULL DEFAULT '',
  "EMail" text NOT NULL DEFAULT '', "RegistrationDate" timestamp NOT NULL DEFAULT now(),
  "State" smallint NOT NULL DEFAULT 0, "TimeZone" smallint NOT NULL DEFAULT 0,
  "VaultPassword" varchar(20) NOT NULL DEFAULT '', "IsVaultExtended" boolean NOT NULL DEFAULT false,
  "ChatBanUntil" timestamp, "IsTemplate" boolean NOT NULL DEFAULT false,
  "LanguageIsoCode" varchar(10) NOT NULL DEFAULT 'en', "IsBot" boolean NOT NULL DEFAULT false,
  "IsNetworkObservationActive" boolean NOT NULL DEFAULT false,
  "GoblinPoints" int NOT NULL DEFAULT 0, "WCoinC" int NOT NULL DEFAULT 0, "WCoinP" int NOT NULL DEFAULT 0
);
CREATE TABLE data."Character" (
  "Id" uuid PRIMARY KEY, "Name" varchar(10) NOT NULL, "CharacterClassId" uuid NOT NULL,
  "AccountId" uuid NOT NULL, "InventoryId" uuid, "CharacterSlot" smallint NOT NULL DEFAULT 0,
  "CreateDate" timestamp NOT NULL DEFAULT now(), "Experience" bigint NOT NULL DEFAULT 0,
  "LevelUpPoints" int NOT NULL DEFAULT 0, "PositionX" smallint NOT NULL DEFAULT 0,
  "PositionY" smallint NOT NULL DEFAULT 0, "CurrentMapId" uuid
);
CREATE TABLE data."StatAttribute" (
  "Id" uuid PRIMARY KEY, "DefinitionId" uuid NOT NULL, "CharacterId" uuid NOT NULL,
  "Value" float NOT NULL DEFAULT 0, "AccountId" uuid
);

-- Seed: dinh nghia, class, map, cau hinh
INSERT INTO config."AttributeDefinition" ("Id", "Designation") VALUES ('11111111-1111-1111-1111-111111111111', 'Level');
INSERT INTO config."CharacterClass" ("Id", "Name") VALUES
  ('22222222-2222-2222-2222-222222222222', 'Dark Knight'),
  ('33333333-3333-3333-3333-333333333333', 'Dark Wizard');
INSERT INTO config."GameMapDefinition" ("Id", "Name") VALUES ('44444444-4444-4444-4444-444444444444', 'Lorencia');
INSERT INTO config."GameConfiguration" ("Id", "ExperienceRate", "MaximumLevel") VALUES ('55555555-5555-5555-5555-555555555555', 1, 400);

-- Seed: account test0 (mat khau 'test0', hash bcrypt cost 11) + nhan vat test0Dk Lv 400
INSERT INTO data."ItemStorage" ("Id", "Money") VALUES
  ('66666666-6666-6666-6666-666666666666', 0),
  ('77777777-7777-7777-7777-777777777777', 1999984000);
INSERT INTO data."Account" ("Id", "VaultId", "LoginName", "PasswordHash", "EMail", "RegistrationDate", "State")
VALUES ('88888888-8888-8888-8888-888888888888', '66666666-6666-6666-6666-666666666666', 'test0',
        '$2b$11$srLDY3nI.sXL0AWdCtrq..uJzkKqmrwnzhuWlwiv9XP6TdUOnRcZ2', 'test0@local', now(), 0);
INSERT INTO data."Character" ("Id", "Name", "CharacterClassId", "AccountId", "InventoryId", "CharacterSlot",
  "CreateDate", "Experience", "LevelUpPoints", "PositionX", "PositionY", "CurrentMapId")
VALUES ('99999999-9999-9999-9999-999999999999', 'test0Dk', '22222222-2222-2222-2222-222222222222',
  '88888888-8888-8888-8888-888888888888', '77777777-7777-7777-7777-777777777777', 0,
  now(), 3822148080, 100, 133, 133, '44444444-4444-4444-4444-444444444444');
INSERT INTO data."StatAttribute" ("Id", "DefinitionId", "CharacterId", "Value", "AccountId")
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111',
  '99999999-9999-9999-9999-999999999999', 400, '88888888-8888-8888-8888-888888888888');

SELECT 'accounts', count(*) FROM data."Account"
UNION ALL SELECT 'characters', count(*) FROM data."Character";
