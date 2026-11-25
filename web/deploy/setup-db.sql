-- setup-db.sql — Tao schema + cap quyen cho backend website MU.
-- Chay bang postgres superuser TREN VPS (role muweb da duoc tao truoc
-- trong deploy.sh — file nay KHONG dung bien psql de tranh loi thay the
-- bien trong chuoi dollar-quoted):
--   sudo -u postgres psql -v ON_ERROR_STOP=1 -f setup-db.sql
-- Idempotent: chay lai an toan.
-- Backend KHONG can quyen CREATE ON DATABASE: schema web do script nay
-- tao (superuser); backend chi kiem tra ton tai roi tao bang trong schema
-- (xem initDb trong server.js).
-- Quyen toi thieu cho role muweb:
--   Account: SELECT/INSERT/UPDATE (dang ky, dang nhap, doi MK, admin dat lai MK)
--   ItemStorage: SELECT/INSERT (tao vault khi dang ky; doc Money khi xem nhan vat)
--   Character / StatAttribute / CharacterClass / AttributeDefinition /
--   GameMapDefinition / GameConfiguration: SELECT (xem nhan vat, ranking, ti le)
--   Schema web: USAGE + CREATE (backend tu tao web.sessions / web.news / web.admin_log)

CREATE SCHEMA IF NOT EXISTS web;

GRANT USAGE ON SCHEMA data TO muweb;
GRANT USAGE ON SCHEMA config TO muweb;
GRANT SELECT, INSERT, UPDATE ON data."Account" TO muweb;
GRANT SELECT, INSERT ON data."ItemStorage" TO muweb;
GRANT SELECT ON data."Character" TO muweb;
GRANT SELECT ON data."StatAttribute" TO muweb;
GRANT SELECT ON config."CharacterClass" TO muweb;
GRANT SELECT ON config."AttributeDefinition" TO muweb;
GRANT SELECT ON config."GameMapDefinition" TO muweb;
GRANT SELECT ON config."GameConfiguration" TO muweb;
GRANT USAGE, CREATE ON SCHEMA web TO muweb;
