-- Agencies stay linked to the owner's general schedule; customHours marks personalized weekly hours.
-- AlterTable
ALTER TABLE `Agency` ADD COLUMN `customHours` BOOLEAN NOT NULL DEFAULT false;


-- Agencies without a general schedule that already have weekly hours are personalized.
UPDATE `Agency` a SET a.`customHours` = true WHERE a.`scheduleTemplateId` IS NULL AND EXISTS (SELECT 1 FROM `AgencyScheduleRule` r WHERE r.`agencyId` = a.`id`);
