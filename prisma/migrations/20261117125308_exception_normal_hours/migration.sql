-- Agency override: open with the usual weekly hours on dates the general schedule has an exception.
-- AlterTable
ALTER TABLE `ScheduleException` MODIFY `kind` ENUM('CLOSED', 'SPECIAL_HOURS', 'NORMAL_HOURS') NOT NULL DEFAULT 'CLOSED';

