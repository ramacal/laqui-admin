-- The license holder ("titular") is now the agency's OWNER staff record.
-- Copy "Apellido, Nombres" into the owner's name before dropping the column.
UPDATE `AgencyEmployee` e
JOIN `Agency` a ON a.`id` = e.`agencyId`
SET e.`lastName`  = TRIM(SUBSTRING_INDEX(a.`licenseHolder`, ',', 1)),
    e.`firstName` = TRIM(SUBSTRING(a.`licenseHolder`, LOCATE(',', a.`licenseHolder`) + 1))
WHERE e.`role` = 'OWNER'
  AND a.`licenseHolder` LIKE '%,%';

-- AlterTable
ALTER TABLE `Agency` DROP COLUMN `licenseHolder`;
