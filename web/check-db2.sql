SELECT 'admin_exists' AS k, count(*)::text AS v FROM data."Account" WHERE "LoginName" = 'admin'
UNION ALL SELECT 'accounts', count(*)::text FROM data."Account"
UNION ALL SELECT 'characters', count(*)::text FROM data."Character";
SELECT "Id"::text, split_part("Name", '|', 1) AS name FROM config."CharacterClass" ORDER BY "Id";
SELECT "Designation" FROM config."AttributeDefinition" ORDER BY "Designation";
SELECT column_name, data_type FROM information_schema.columns
 WHERE table_schema='config' AND table_name='GameConfiguration' ORDER BY ordinal_position;
SELECT "Id"::text AS id, "ExperienceRate" AS exp FROM config."GameConfiguration" LIMIT 3;
