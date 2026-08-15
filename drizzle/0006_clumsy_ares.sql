CREATE TABLE `chat_synthetic_check_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`monitor_id` int NOT NULL,
	`organization_id` int NOT NULL,
	`scheduled_for` timestamp NOT NULL,
	`status` enum('healthy','unhealthy','skipped') NOT NULL,
	`response_valid` boolean NOT NULL,
	`duration_ms` int NOT NULL,
	`reason` varchar(120),
	`checked_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chat_synthetic_check_runs_id` PRIMARY KEY(`id`),
	CONSTRAINT `chat_synthetic_check_run_unique` UNIQUE(`monitor_id`,`organization_id`,`scheduled_for`)
);
--> statement-breakpoint
CREATE TABLE `chat_synthetic_monitors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(80) NOT NULL,
	`schedule_cron_task_uid` varchar(65),
	`enabled` boolean NOT NULL DEFAULT true,
	`cadence_minutes` int NOT NULL DEFAULT 15,
	`last_run_at` timestamp,
	`last_status` enum('healthy','unhealthy','skipped'),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chat_synthetic_monitors_id` PRIMARY KEY(`id`),
	CONSTRAINT `chat_synthetic_monitors_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE INDEX `chat_synthetic_check_runs_organization_idx` ON `chat_synthetic_check_runs` (`organization_id`,`checked_at`);--> statement-breakpoint
CREATE INDEX `chat_synthetic_monitor_task_uid_idx` ON `chat_synthetic_monitors` (`schedule_cron_task_uid`);