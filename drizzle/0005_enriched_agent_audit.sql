ALTER TABLE `audit_logs` ADD `provider` varchar(80);--> statement-breakpoint
ALTER TABLE `audit_logs` ADD `requestId` varchar(80);--> statement-breakpoint
ALTER TABLE `audit_logs` ADD `result` varchar(120);--> statement-breakpoint
ALTER TABLE `audit_logs` ADD `confirmationStatus` enum('not_required','pending','confirmed','duplicate','denied','failed');--> statement-breakpoint
CREATE INDEX `audit_organization_request_idx` ON `audit_logs` (`organizationId`,`requestId`);