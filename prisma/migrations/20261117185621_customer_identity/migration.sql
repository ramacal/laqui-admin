-- Customers: a person (first/last name, Argentine cellphone, optional DNI) and, per agency,
-- the alias the agency knows them by. Fiados move from CreditAccount to the agency customer.

-- Keep an index for the agencyId foreign key before changing the primary key.
CREATE UNIQUE INDEX `AgencyCustomer_agencyId_customerId_key` ON `AgencyCustomer`(`agencyId`, `customerId`);

ALTER TABLE `AgencyCustomer` DROP PRIMARY KEY,
    DROP COLUMN `displayName`,
    ADD COLUMN `active` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `alias` VARCHAR(191) NOT NULL,
    ADD COLUMN `id` VARCHAR(191) NOT NULL,
    ADD COLUMN `notes` TEXT NULL,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL,
    ADD PRIMARY KEY (`id`);
CREATE INDEX `AgencyCustomer_agencyId_alias_idx` ON `AgencyCustomer`(`agencyId`, `alias`);

ALTER TABLE `Customer` DROP COLUMN `name`,
    ADD COLUMN `dni` VARCHAR(191) NULL,
    ADD COLUMN `firstName` VARCHAR(191) NOT NULL,
    ADD COLUMN `lastName` VARCHAR(191) NULL,
    MODIFY `cellphoneNumber` VARCHAR(191) NULL;
CREATE UNIQUE INDEX `Customer_dni_key` ON `Customer`(`dni`);

-- Existing fiado accounts become agency customers (same id), named after their alias.
INSERT INTO `Customer` (`id`, `firstName`, `lastName`, `cellphoneNumber`, `dni`, `createdAt`, `updatedAt`)
  SELECT `id`, `name`, NULL, NULL, NULL, `createdAt`, NOW(3) FROM `CreditAccount`;
INSERT INTO `AgencyCustomer` (`id`, `agencyId`, `customerId`, `alias`, `notes`, `active`, `createdAt`, `updatedAt`)
  SELECT `id`, `agencyId`, `id`, `name`, `notes`, `active`, `createdAt`, NOW(3) FROM `CreditAccount`;

-- Fiado entries point to the agency customer (same ids as the old accounts).
ALTER TABLE `CreditEntry` DROP FOREIGN KEY `CreditEntry_accountId_fkey`;
DROP INDEX `CreditEntry_accountId_date_idx` ON `CreditEntry`;
ALTER TABLE `CreditEntry` RENAME COLUMN `accountId` TO `customerId`;
CREATE INDEX `CreditEntry_customerId_date_idx` ON `CreditEntry`(`customerId`, `date`);
ALTER TABLE `CreditEntry` ADD CONSTRAINT `CreditEntry_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `AgencyCustomer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `CreditAccount` DROP FOREIGN KEY `CreditAccount_agencyId_fkey`;
ALTER TABLE `CreditAccount` DROP FOREIGN KEY `CreditAccount_customerId_fkey`;
DROP TABLE `CreditAccount`;
