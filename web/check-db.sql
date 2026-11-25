-- Kiem tra DB cho portal mu-web (chi doc)
SELECT 'admin_exists' AS k, count(*)::text AS v FROM data."Account" WHERE "LoginName" = 'admin'
UNION ALL SELECT 'accounts', count(*)::text FROM data."Account"
UNION ALL SELECT 'characters', count(*)::text FROM data."Character";
SELECT 'class' AS k, "Id"::text AS id, "Name" AS name FROM config."CharacterClass" ORDER BY "Name";
SELECT column_name, data_type FROM information_schema.columns
 WHERE table_schema='data' AND table_name='Character' ORDER BY ordinal_position;
SELECT column_name, data_type FROM information_schema.columns
 WHERE table_schema='config' AND table_name='AttributeDefinition' ORDER BY ordinal_position;
SELECT "Designation", "Name" FROM config."AttributeDefinition" WHERE "Designation" IN ('Level','LevelUpPoints') OR "Name" ILIKE '%level%';
SELECT "Id", "Name", "MaximumLevel" FROM config."GameConfiguration" LIMIT 5;
