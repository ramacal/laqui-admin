-- Each owner has a single "Horario general" (spec agency-schedule). Checked: one template per owner today.
-- AlterTable
ALTER TABLE `ScheduleTemplate` MODIFY `name` VARCHAR(191) NOT NULL DEFAULT 'Horario general';

-- CreateIndex
CREATE UNIQUE INDEX `ScheduleTemplate_ownerUserId_key` ON `ScheduleTemplate`(`ownerUserId`);

