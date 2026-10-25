ALTER TABLE `user` ADD `department` text;--> statement-breakpoint
ALTER TABLE `user` ADD `batch` text;--> statement-breakpoint
ALTER TABLE `user` ADD `semester` text;--> statement-breakpoint
ALTER TABLE `user` ADD `phone` text;--> statement-breakpoint
ALTER TABLE `user` ADD `employee_id` text;--> statement-breakpoint
ALTER TABLE `user` ADD `designation` text;--> statement-breakpoint
CREATE INDEX `user_role_idx` ON `user` (`role`);