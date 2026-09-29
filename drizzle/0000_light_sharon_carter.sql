CREATE TABLE `alarms` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`node_id` integer NOT NULL,
	`ts` integer NOT NULL,
	`type` text NOT NULL,
	`severity` text NOT NULL,
	`message` text NOT NULL,
	`value` real,
	`threshold` real,
	`status` text DEFAULT 'open' NOT NULL,
	`ack_by` integer,
	`ack_at` integer,
	`resolved_at` integer,
	`note` text,
	FOREIGN KEY (`node_id`) REFERENCES `nodes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ack_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `alarms_status_ts_idx` ON `alarms` (`status`,`ts`);--> statement-breakpoint
CREATE INDEX `alarms_node_ts_idx` ON `alarms` (`node_id`,`ts`);--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ts` integer NOT NULL,
	`user_id` integer,
	`action` text NOT NULL,
	`entity` text NOT NULL,
	`entity_id` text,
	`details` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `audit_ts_idx` ON `audit_log` (`ts`);--> statement-breakpoint
CREATE TABLE `consumers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`node_id` integer,
	`lat` real NOT NULL,
	`lng` real NOT NULL,
	`address` text,
	`connected_on` integer,
	`approved_load_sm3h` real,
	`meter_serial` text,
	`tariff_group` text,
	FOREIGN KEY (`node_id`) REFERENCES `nodes`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `consumers_code_uq` ON `consumers` (`code`);--> statement-breakpoint
CREATE INDEX `consumers_category_idx` ON `consumers` (`category`);--> statement-breakpoint
CREATE INDEX `consumers_node_idx` ON `consumers` (`node_id`);--> statement-breakpoint
CREATE TABLE `nodes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`zone` text NOT NULL,
	`status` text DEFAULT 'operational' NOT NULL,
	`lat` real NOT NULL,
	`lng` real NOT NULL,
	`gx` real NOT NULL,
	`gy` real NOT NULL,
	`address` text,
	`commissioned_on` integer,
	`notes` text,
	`meta` text DEFAULT '{}'
);
--> statement-breakpoint
CREATE UNIQUE INDEX `nodes_code_uq` ON `nodes` (`code`);--> statement-breakpoint
CREATE TABLE `readings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`consumer_id` integer NOT NULL,
	`period` text NOT NULL,
	`opening_idx` real NOT NULL,
	`closing_idx` real NOT NULL,
	`consumption_sm3` real NOT NULL,
	`amount` real NOT NULL,
	`status` text DEFAULT 'unpaid' NOT NULL,
	`due_on` integer,
	`paid_on` integer,
	FOREIGN KEY (`consumer_id`) REFERENCES `consumers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `readings_consumer_period_uq` ON `readings` (`consumer_id`,`period`);--> statement-breakpoint
CREATE INDEX `readings_period_idx` ON `readings` (`period`);--> statement-breakpoint
CREATE TABLE `segments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name` text,
	`from_node` integer NOT NULL,
	`to_node` integer NOT NULL,
	`zone` text NOT NULL,
	`material` text NOT NULL,
	`diameter_mm` real NOT NULL,
	`length_m` real NOT NULL,
	`maop_bar` real NOT NULL,
	`laid_on` integer,
	`status` text DEFAULT 'operational' NOT NULL,
	`route_name` text,
	`shape` text,
	FOREIGN KEY (`from_node`) REFERENCES `nodes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_node`) REFERENCES `nodes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `segments_code_uq` ON `segments` (`code`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`token` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`user_agent` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `station_detail` (
	`node_id` integer PRIMARY KEY NOT NULL,
	`capacity_mmscfd` real,
	`inlet_set_bar` real,
	`outlet_set_bar` real,
	`monitor_regulator` integer DEFAULT false,
	`slam_shut` integer DEFAULT false,
	`odorizer` integer DEFAULT false,
	`scada_rtu` integer DEFAULT false,
	`last_inspection_on` integer,
	FOREIGN KEY (`node_id`) REFERENCES `nodes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `station_detail_node_idx` ON `station_detail` (`node_id`);--> statement-breakpoint
CREATE TABLE `telemetry` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`node_id` integer NOT NULL,
	`ts` integer NOT NULL,
	`pressure_bar` real NOT NULL,
	`flow_sm3h` real NOT NULL,
	`temp_c` real NOT NULL,
	FOREIGN KEY (`node_id`) REFERENCES `nodes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `telemetry_node_ts_idx` ON `telemetry` (`node_id`,`ts`);--> statement-breakpoint
CREATE TABLE `telemetry_hourly` (
	`node_id` integer NOT NULL,
	`hour_ts` integer NOT NULL,
	`p_avg` real NOT NULL,
	`p_max` real NOT NULL,
	`p_min` real NOT NULL,
	`f_avg` real NOT NULL,
	`f_max` real NOT NULL,
	`samples` integer NOT NULL,
	PRIMARY KEY(`node_id`, `hour_ts`),
	FOREIGN KEY (`node_id`) REFERENCES `nodes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `hourly_node_ts_idx` ON `telemetry_hourly` (`node_id`,`hour_ts`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`full_name` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'viewer' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_uq` ON `users` (`username`);--> statement-breakpoint
CREATE TABLE `valves` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`node_id` integer NOT NULL,
	`segment_id` integer,
	`type` text DEFAULT 'isolation' NOT NULL,
	`state` text DEFAULT 'open' NOT NULL,
	`last_exercised_on` integer,
	FOREIGN KEY (`node_id`) REFERENCES `nodes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`segment_id`) REFERENCES `segments`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `valves_node_id_unique` ON `valves` (`node_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `valves_code_uq` ON `valves` (`code`);--> statement-breakpoint
CREATE TABLE `work_orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`type` text DEFAULT 'corrective' NOT NULL,
	`priority` text DEFAULT 'medium' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`node_id` integer,
	`segment_id` integer,
	`assigned_to` integer,
	`due_on` integer,
	`created_by` integer,
	`created_at` integer NOT NULL,
	`closed_at` integer,
	FOREIGN KEY (`node_id`) REFERENCES `nodes`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`segment_id`) REFERENCES `segments`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`assigned_to`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `work_orders_code_uq` ON `work_orders` (`code`);--> statement-breakpoint
CREATE INDEX `work_orders_status_idx` ON `work_orders` (`status`);