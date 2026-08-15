CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`userId` int NOT NULL,
	`action` varchar(120) NOT NULL,
	`agent` varchar(120) NOT NULL,
	`model` varchar(120),
	`tool` varchar(120),
	`status` enum('success','failure','denied') NOT NULL,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `church_cells` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`leaderName` varchar(160) NOT NULL,
	`supervisorName` varchar(160) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `church_cells_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `conversation_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversationId` int NOT NULL,
	`organizationId` int NOT NULL,
	`userId` int NOT NULL,
	`role` enum('user','assistant') NOT NULL,
	`content` text NOT NULL,
	`model` varchar(120),
	`tool` varchar(120),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `conversation_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(180) NOT NULL DEFAULT 'Conversa pastoral',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `leaders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`cellId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`contact` varchar(160),
	`attentionNote` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `leaders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `meetings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`cellId` int NOT NULL,
	`occurredAt` timestamp NOT NULL,
	`wasHeld` boolean NOT NULL,
	`attendanceCount` int NOT NULL DEFAULT 0,
	CONSTRAINT `meetings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`cellId` int,
	`name` varchar(160) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `members_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `organization_memberships` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`userId` int NOT NULL,
	`role` enum('admin','pastor','supervisor','leader') NOT NULL DEFAULT 'pastor',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `organization_memberships_id` PRIMARY KEY(`id`),
	CONSTRAINT `membership_organization_user_unique` UNIQUE(`organizationId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(80) NOT NULL,
	`name` varchar(160) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `organizations_id` PRIMARY KEY(`id`),
	CONSTRAINT `organizations_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`cellId` int NOT NULL,
	`weekLabel` varchar(80) NOT NULL,
	`delivered` boolean NOT NULL DEFAULT false,
	`submittedAt` timestamp,
	CONSTRAINT `reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `visitor_followups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`visitorId` int NOT NULL,
	`completedByUserId` int NOT NULL,
	`note` text NOT NULL,
	`idempotencyKey` varchar(96) NOT NULL,
	`completedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `visitor_followups_id` PRIMARY KEY(`id`),
	CONSTRAINT `visitor_followups_idempotencyKey_unique` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `visitors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`firstVisitAt` timestamp NOT NULL,
	`phone` varchar(40),
	`followedUp` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `visitors_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `audit_organization_created_idx` ON `audit_logs` (`organizationId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `cells_organization_idx` ON `church_cells` (`organizationId`);--> statement-breakpoint
CREATE INDEX `messages_conversation_idx` ON `conversation_messages` (`conversationId`,`id`);--> statement-breakpoint
CREATE INDEX `conversations_tenant_user_idx` ON `conversations` (`organizationId`,`userId`);--> statement-breakpoint
CREATE INDEX `leaders_organization_idx` ON `leaders` (`organizationId`);--> statement-breakpoint
CREATE INDEX `meetings_organization_idx` ON `meetings` (`organizationId`);--> statement-breakpoint
CREATE INDEX `members_organization_idx` ON `members` (`organizationId`);--> statement-breakpoint
CREATE INDEX `membership_user_idx` ON `organization_memberships` (`userId`);--> statement-breakpoint
CREATE INDEX `reports_organization_idx` ON `reports` (`organizationId`);--> statement-breakpoint
CREATE INDEX `followups_organization_idx` ON `visitor_followups` (`organizationId`);--> statement-breakpoint
CREATE INDEX `visitors_organization_idx` ON `visitors` (`organizationId`);