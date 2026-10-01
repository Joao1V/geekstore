-- CreateTable
CREATE TABLE `role` (
    `role_id` CHAR(36) NOT NULL,
    `code` VARCHAR(32) NOT NULL,
    `name` VARCHAR(64) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `role_code_key`(`code`),
    PRIMARY KEY (`role_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- Perfis do admin (RF-PLA-03). O mapa perfil -> permissões vive em `packages/shared/src/rbac.ts`.
INSERT INTO `role` (`role_id`, `code`, `name`) VALUES
    (UUID(), 'owner', 'Dono'),
    (UUID(), 'manager', 'Gerente'),
    (UUID(), 'stock', 'Estoque'),
    (UUID(), 'support', 'Atendimento'),
    (UUID(), 'viewer', 'Leitura');

-- AlterTable: usuários já existentes (criados na F0) viram `owner`.
ALTER TABLE `user` ADD COLUMN `role_id` CHAR(36) NULL;
UPDATE `user` SET `role_id` = (SELECT `role_id` FROM `role` WHERE `code` = 'owner');
ALTER TABLE `user` MODIFY `role_id` CHAR(36) NOT NULL;

-- CreateTable
CREATE TABLE `audit_log` (
    `audit_log_id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NULL,
    `entity` VARCHAR(64) NOT NULL,
    `entity_id` CHAR(36) NOT NULL,
    `action` ENUM('create', 'update', 'delete') NOT NULL,
    `before` JSON NULL,
    `after` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_log_entity_entity_id_idx`(`entity`, `entity_id`),
    INDEX `audit_log_user_id_idx`(`user_id`),
    INDEX `audit_log_created_at_idx`(`created_at`),
    PRIMARY KEY (`audit_log_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateIndex
CREATE INDEX `user_role_id_idx` ON `user`(`role_id`);

-- AddForeignKey
ALTER TABLE `user` ADD CONSTRAINT `user_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `role`(`role_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_log` ADD CONSTRAINT `audit_log_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;
