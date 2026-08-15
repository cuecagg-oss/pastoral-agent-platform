CREATE TABLE `organization_tool_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`toolName` varchar(120) NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`updatedByUserId` int NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `organization_tool_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `organization_tool_settings_org_tool_unique` UNIQUE(`organizationId`,`toolName`)
);
--> statement-breakpoint
CREATE INDEX `organization_tool_settings_updated_idx` ON `organization_tool_settings` (`organizationId`,`updatedAt`);