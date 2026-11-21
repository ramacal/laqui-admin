-- Each official game can be sold at the agency counter and/or on the web (public betting flow).
ALTER TABLE `AgencyGameAvailability` ADD COLUMN `onWeb` BOOLEAN NOT NULL DEFAULT true;

-- A game hidden at the agency was not offered anywhere: keep it off the web too.
UPDATE `AgencyGameAvailability` SET `onWeb` = false WHERE `visible` = false;
