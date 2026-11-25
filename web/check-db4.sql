SELECT "ExperienceRate" AS exp_rate, "MaximumLevel" AS max_level FROM config."GameConfiguration";
SELECT column_name, data_type FROM information_schema.columns
 WHERE table_schema='data' AND table_name='StatAttribute' ORDER BY ordinal_position;
SELECT c."Name" AS name, split_part(cc."Name", '|', 1) AS class,
       sa."Value" AS level, c."Experience" AS exp, s."Money" AS zen,
       split_part(m."Name", '|', 1) AS map, c."PositionX" AS x, c."PositionY" AS y
  FROM data."Character" c
  JOIN config."CharacterClass" cc ON cc."Id" = c."CharacterClassId"
  JOIN data."StatAttribute" sa ON sa."CharacterId" = c."Id"
  JOIN config."AttributeDefinition" ad ON ad."Id" = sa."DefinitionId" AND ad."Designation" = 'Level'
  LEFT JOIN data."ItemStorage" s ON s."Id" = c."InventoryId"
  LEFT JOIN config."GameMapDefinition" m ON m."Id" = c."CurrentMapId"
 WHERE c."Name" = 'test0Dk';
SELECT "Name", "Experience" FROM data."Character" ORDER BY "Experience" DESC LIMIT 3;
