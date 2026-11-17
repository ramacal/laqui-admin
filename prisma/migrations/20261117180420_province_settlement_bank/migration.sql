-- Bank where each provincial lottery settles with its agencies.
-- AlterTable
ALTER TABLE `Province` ADD COLUMN `settlementBank` VARCHAR(191) NULL;


-- Lotería de la Provincia de Buenos Aires settles through Banco Provincia.
UPDATE `Province` SET `settlementBank` = 'Banco de la Provincia de Buenos Aires' WHERE `code` = 'B';

-- Existing Buenos Aires agencies: their bank account is at Banco Provincia.
UPDATE `AgencyFund` f JOIN `Agency` a ON a.`id` = f.`agencyId` JOIN `Province` p ON p.`id` = a.`provinceId`
SET f.`provider` = p.`settlementBank`, f.`name` = IF(f.`name` = 'Cuenta bancaria', 'Cuenta Banco Provincia', f.`name`)
WHERE f.`kind` = 'BANK_ACCOUNT' AND f.`provider` IS NULL AND p.`code` = 'B';
