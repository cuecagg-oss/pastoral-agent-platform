CREATE TABLE `organization_agent_settings` (
	`organizationId` int NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`provider` enum('legacy','hermes') NOT NULL DEFAULT 'legacy',
	`model` varchar(120) NOT NULL DEFAULT 'legacy-router',
	`fallbackPolicy` enum('deterministic') NOT NULL DEFAULT 'deterministic',
	`updatedByUserId` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `organization_agent_settings_organizationId` PRIMARY KEY(`organizationId`)
);
--> statement-breakpoint
CREATE INDEX `agent_settings_updated_idx` ON `organization_agent_settings` (`updatedAt`);