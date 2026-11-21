-- The legajo's account (where Lotería settles) is set apart from the other payment methods.
ALTER TABLE `AgencyFund` ADD COLUMN `settlesAgencyId` VARCHAR(191) NULL;
CREATE UNIQUE INDEX `AgencyFund_settlesAgencyId_key` ON `AgencyFund`(`settlesAgencyId`);

-- Until now each agency had a single bank account and it was the settlement one.
UPDATE `AgencyFund` SET `settlesAgencyId` = `agencyId` WHERE `kind` = 'BANK_ACCOUNT';
