-- Employee exit date (fecha de egreso), work data and social media consent. Additive only.
-- AlterTable
ALTER TABLE `AgencyEmployee` ADD COLUMN `consentAt` DATE NULL,
    ADD COLUMN `jobTitle` VARCHAR(191) NULL,
    ADD COLUMN `leftAt` DATE NULL,
    ADD COLUMN `notes` TEXT NULL,
    ADD COLUMN `photoKey` VARCHAR(500) NULL,
    ADD COLUMN `publicName` VARCHAR(191) NULL,
    ADD COLUMN `shift` ENUM('MORNING', 'AFTERNOON', 'FULL_DAY', 'ROTATING') NULL,
    ADD COLUMN `socialMediaConsent` BOOLEAN NOT NULL DEFAULT false;


-- Spec: the exit date cannot be earlier than the hire date.
ALTER TABLE `AgencyEmployee` ADD CONSTRAINT `AgencyEmployee_leftAt_after_hiredAt` CHECK (`leftAt` IS NULL OR `hiredAt` IS NULL OR `leftAt` >= `hiredAt`);
