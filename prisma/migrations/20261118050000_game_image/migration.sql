-- Official games can have a picture (public bucket).
-- AlterTable
ALTER TABLE `GameDefinition` ADD COLUMN `imageKey` VARCHAR(500) NULL;

