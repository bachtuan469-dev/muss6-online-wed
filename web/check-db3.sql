SELECT "Designation" FROM config."AttributeDefinition" WHERE "Designation" = 'Level';
SELECT column_name, data_type FROM information_schema.columns
 WHERE table_schema='config' AND table_name='GameConfiguration' ORDER BY ordinal_position;
SELECT "Id"::text AS id, "ExperienceRate" AS exp, "ItemDropRate" AS drop FROM config."GameConfiguration";
SELECT split_part(cc."Name", '|', 1) AS class, count(*) AS n FROM data."Character" c
 JOIN config."CharacterClass" cc ON cc."Id" = c."CharacterClassId" GROUP BY 1 ORDER BY 2 DESC;
SELECT "Name" AS mapname FROM config."GameMapDefinition" ORDER BY "Number" LIMIT 5;
