-- ====================================================================
-- WagenRit - MariaDB Database Schema
-- Compatibel met MariaDB 10.5+ en MySQL 8.0+
-- Karakterset: utf8mb4 voor volledige Unicode & emoji-ondersteuning
-- ====================================================================

CREATE DATABASE IF NOT EXISTS `wagenrit`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `wagenrit`;

-- 1. TEAMS (Wagenparken & Afdelingen)
CREATE TABLE IF NOT EXISTS `teams` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` VARCHAR(64) NOT NULL,
  INDEX `idx_teams_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. GEBRUIKERSPROFIELEN
CREATE TABLE IF NOT EXISTS `profiles` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `full_name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `role` VARCHAR(32) NOT NULL DEFAULT 'user', -- 'user', 'fleet_admin', 'admin'
  `team_ids` JSON NULL, -- Array van team ID's: ["team_bouw", "team_service"]
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` VARCHAR(64) NOT NULL,
  INDEX `idx_profiles_role` (`role`),
  INDEX `idx_profiles_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. VOERTUIGEN / BEDRIJFSWAGENS
CREATE TABLE IF NOT EXISTS `vehicles` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `team_id` VARCHAR(64) NOT NULL,
  `license_plate` VARCHAR(32) NOT NULL UNIQUE,
  `brand` VARCHAR(64) NOT NULL,
  `model` VARCHAR(64) NOT NULL,
  `nickname` VARCHAR(128) NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `last_known_km` INT NOT NULL DEFAULT 0,
  `expected_daily_km` INT NULL,
  `created_at` VARCHAR(64) NOT NULL,
  INDEX `idx_vehicles_team` (`team_id`),
  INDEX `idx_vehicles_active` (`is_active`),
  CONSTRAINT `fk_vehicles_team` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. RITTEN (Ritten Logboek)
CREATE TABLE IF NOT EXISTS `trips` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `team_id` VARCHAR(64) NULL,
  `vehicle_id` VARCHAR(64) NOT NULL,
  `user_id` VARCHAR(64) NOT NULL,
  `user_name` VARCHAR(255) NOT NULL,
  `user_email` VARCHAR(255) NULL,
  `license_plate` VARCHAR(32) NOT NULL,
  `vehicle_name` VARCHAR(128) NOT NULL,
  `start_time` VARCHAR(64) NOT NULL,
  `start_km` INT NOT NULL,
  `end_time` VARCHAR(64) NULL,
  `end_km` INT NULL,
  `purpose` VARCHAR(255) NOT NULL,
  `notes` TEXT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'open', -- 'open', 'closed', 'auto_closed'
  `closed_automatically` TINYINT(1) NOT NULL DEFAULT 0,
  `closed_reason` TEXT NULL,
  `closed_by_user_id` VARCHAR(64) NULL,
  `closed_by_user_name` VARCHAR(255) NULL,
  `km_discrepancy` INT NULL,
  `has_km_discrepancy` TINYINT(1) NOT NULL DEFAULT 0,
  `is_unusual_distance` TINYINT(1) NOT NULL DEFAULT 0,
  `expected_trip_km` INT NULL,
  `created_at` VARCHAR(64) NOT NULL,
  `updated_at` VARCHAR(64) NOT NULL,
  INDEX `idx_trips_vehicle` (`vehicle_id`),
  INDEX `idx_trips_user` (`user_id`),
  INDEX `idx_trips_status` (`status`),
  INDEX `idx_trips_start_time` (`start_time`),
  CONSTRAINT `fk_trips_vehicle` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. DAGELIJKSE KM-STANDEN (Ochtend & Avond)
CREATE TABLE IF NOT EXISTS `daily_readings` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `team_id` VARCHAR(64) NULL,
  `vehicle_id` VARCHAR(64) NOT NULL,
  `user_id` VARCHAR(64) NOT NULL,
  `user_name` VARCHAR(255) NOT NULL,
  `reading_date` VARCHAR(32) NOT NULL, -- YYYY-MM-DD
  `reading_type` VARCHAR(16) NOT NULL, -- 'start' of 'stop'
  `km` INT NOT NULL,
  `recorded_at` VARCHAR(64) NOT NULL,
  `created_at` VARCHAR(64) NOT NULL,
  INDEX `idx_readings_veh_date` (`vehicle_id`, `reading_date`),
  CONSTRAINT `fk_readings_vehicle` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. GLOBALE APPLICATIE-INSTELLINGEN (Ritdoelen & Modules)
CREATE TABLE IF NOT EXISTS `app_settings` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY DEFAULT 'global_settings',
  `purposes` JSON NOT NULL, -- Array van doelen/tags
  `default_expected_daily_km` INT NOT NULL DEFAULT 50,
  `ride_request_module_enabled` TINYINT(1) NOT NULL DEFAULT 1,
  `updated_at` VARCHAR(64) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. VERVOERSAANVRAGEN (Module Collega Oppikken)
CREATE TABLE IF NOT EXISTS `ride_requests` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `requester_id` VARCHAR(64) NOT NULL,
  `requester_name` VARCHAR(255) NOT NULL,
  `requester_phone` VARCHAR(64) NULL,
  `team_id` VARCHAR(64) NULL,
  `from_location` VARCHAR(255) NOT NULL,
  `to_location` VARCHAR(255) NOT NULL,
  `has_materials` TINYINT(1) NOT NULL DEFAULT 0,
  `notes` TEXT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'completed', 'cancelled'
  `created_at` VARCHAR(64) NOT NULL,
  `last_notified_at` VARCHAR(64) NOT NULL,
  `retry_count` INT NOT NULL DEFAULT 0,
  `driver_id` VARCHAR(64) NULL,
  `driver_name` VARCHAR(255) NULL,
  `driver_vehicle_id` VARCHAR(64) NULL,
  `driver_license_plate` VARCHAR(32) NULL,
  `driver_vehicle_name` VARCHAR(128) NULL,
  `eta_minutes` INT NULL,
  `accepted_at` VARCHAR(64) NULL,
  INDEX `idx_ride_requests_status` (`status`),
  INDEX `idx_ride_requests_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. PUSH NOTIFICATIE ABONNEMENTEN (Web Push)
CREATE TABLE IF NOT EXISTS `push_subscriptions` (
  `id` VARCHAR(128) NOT NULL PRIMARY KEY,
  `user_id` VARCHAR(64) NOT NULL,
  `subscription` JSON NOT NULL,
  `schedules` JSON NULL,
  `user_agent` TEXT NULL,
  `updated_at` VARCHAR(64) NOT NULL,
  INDEX `idx_push_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
