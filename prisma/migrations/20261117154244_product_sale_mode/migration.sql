-- Machine vs physical products; unit-sale kind for physical official products (Telekino, scratch cards).
-- Existing games stay MACHINE; existing owner products become PHYSICAL (default).
-- AlterTable
ALTER TABLE `GameDefinition` ADD COLUMN `saleMode` ENUM('MACHINE', 'PHYSICAL') NOT NULL DEFAULT 'MACHINE',
    MODIFY `kind` ENUM('QUINIELA', 'NUMBER_PICK', 'UNIT') NOT NULL;

-- AlterTable
ALTER TABLE `OwnerProduct` ADD COLUMN `saleMode` ENUM('MACHINE', 'PHYSICAL') NOT NULL DEFAULT 'PHYSICAL';

