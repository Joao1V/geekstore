-- CreateTable
CREATE TABLE `category` (
    `category_id` CHAR(36) NOT NULL,
    `parent_id` CHAR(36) NULL,
    `name` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(255) NOT NULL,
    `featured` BOOLEAN NOT NULL DEFAULT false,
    `position` INTEGER NOT NULL DEFAULT 0,
    `seo_title` VARCHAR(255) NULL,
    `seo_description` VARCHAR(500) NULL,
    `canonical_url` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `category_slug_key`(`slug`),
    INDEX `category_parent_id_idx`(`parent_id`),
    PRIMARY KEY (`category_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `product` (
    `product_id` CHAR(36) NOT NULL,
    `category_id` CHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `brand` VARCHAR(120) NULL,
    `status` ENUM('draft', 'active', 'archived') NOT NULL DEFAULT 'draft',
    `seo_title` VARCHAR(255) NULL,
    `seo_description` VARCHAR(500) NULL,
    `canonical_url` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `product_slug_key`(`slug`),
    INDEX `product_category_id_idx`(`category_id`),
    INDEX `product_status_idx`(`status`),
    PRIMARY KEY (`product_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `sku` (
    `sku_id` CHAR(36) NOT NULL,
    `product_id` CHAR(36) NOT NULL,
    `code` VARCHAR(64) NOT NULL,
    `ean` VARCHAR(14) NULL,
    `attributes` JSON NOT NULL,
    `weight_g` INTEGER NULL,
    `length_mm` INTEGER NULL,
    `width_mm` INTEGER NULL,
    `height_mm` INTEGER NULL,
    `ncm` VARCHAR(8) NULL,
    `cost_cents` INTEGER NULL,
    `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `sku_code_key`(`code`),
    INDEX `sku_product_id_idx`(`product_id`),
    INDEX `sku_ean_idx`(`ean`),
    PRIMARY KEY (`sku_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `collection` (
    `collection_id` CHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(255) NOT NULL,
    `kind` ENUM('franchise', 'curated') NOT NULL DEFAULT 'franchise',
    `description` TEXT NULL,
    `featured` BOOLEAN NOT NULL DEFAULT false,
    `position` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `collection_slug_key`(`slug`),
    PRIMARY KEY (`collection_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `collection_product` (
    `collection_product_id` CHAR(36) NOT NULL,
    `collection_id` CHAR(36) NOT NULL,
    `product_id` CHAR(36) NOT NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `collection_product_product_id_idx`(`product_id`),
    UNIQUE INDEX `collection_product_collection_id_product_id_key`(`collection_id`, `product_id`),
    PRIMARY KEY (`collection_product_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `media` (
    `media_id` CHAR(36) NOT NULL,
    `product_id` CHAR(36) NOT NULL,
    `sku_id` CHAR(36) NULL,
    `url` VARCHAR(500) NOT NULL,
    `alt` VARCHAR(255) NOT NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `media_product_id_position_idx`(`product_id`, `position`),
    INDEX `media_sku_id_idx`(`sku_id`),
    PRIMARY KEY (`media_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `location` (
    `location_id` CHAR(36) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `type` ENUM('warehouse', 'store', 'quarantine') NOT NULL DEFAULT 'warehouse',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`location_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `stock_level` (
    `stock_level_id` CHAR(36) NOT NULL,
    `sku_id` CHAR(36) NOT NULL,
    `location_id` CHAR(36) NOT NULL,
    `on_hand` INTEGER NOT NULL DEFAULT 0,
    `reserved` INTEGER NOT NULL DEFAULT 0,
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `stock_level_location_id_idx`(`location_id`),
    UNIQUE INDEX `stock_level_sku_id_location_id_key`(`sku_id`, `location_id`),
    PRIMARY KEY (`stock_level_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `stock_movement` (
    `stock_movement_id` CHAR(36) NOT NULL,
    `sku_id` CHAR(36) NOT NULL,
    `location_id` CHAR(36) NOT NULL,
    `type` ENUM('inbound', 'outbound', 'adjustment', 'reservation', 'release', 'return') NOT NULL,
    `quantity` INTEGER NOT NULL,
    `reason` VARCHAR(255) NULL,
    `reference_type` VARCHAR(32) NULL,
    `reference_id` CHAR(36) NULL,
    `user_id` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `stock_movement_sku_id_location_id_created_at_idx`(`sku_id`, `location_id`, `created_at`),
    INDEX `stock_movement_reference_type_reference_id_idx`(`reference_type`, `reference_id`),
    PRIMARY KEY (`stock_movement_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `stock_reservation` (
    `stock_reservation_id` CHAR(36) NOT NULL,
    `sku_id` CHAR(36) NOT NULL,
    `location_id` CHAR(36) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `checkout_id` CHAR(36) NULL,
    `order_id` CHAR(36) NULL,
    `status` ENUM('active', 'committed', 'consumed', 'released', 'expired') NOT NULL DEFAULT 'active',
    `expires_at` DATETIME(3) NOT NULL,
    `idempotency_key` VARCHAR(128) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `stock_reservation_idempotency_key_key`(`idempotency_key`),
    INDEX `stock_reservation_sku_id_location_id_idx`(`sku_id`, `location_id`),
    INDEX `stock_reservation_status_expires_at_idx`(`status`, `expires_at`),
    PRIMARY KEY (`stock_reservation_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `channel` (
    `channel_id` CHAR(36) NOT NULL,
    `code` VARCHAR(32) NOT NULL,
    `name` VARCHAR(64) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `credentials_encrypted` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `channel_code_key`(`code`),
    PRIMARY KEY (`channel_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `price` (
    `price_id` CHAR(36) NOT NULL,
    `sku_id` CHAR(36) NOT NULL,
    `channel_id` CHAR(36) NOT NULL,
    `price_cents` INTEGER NOT NULL,
    `compare_at_cents` INTEGER NULL,
    `starts_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `ends_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `price_channel_id_idx`(`channel_id`),
    UNIQUE INDEX `price_sku_id_channel_id_starts_at_key`(`sku_id`, `channel_id`, `starts_at`),
    PRIMARY KEY (`price_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- AddForeignKey
ALTER TABLE `category` ADD CONSTRAINT `category_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `category`(`category_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product` ADD CONSTRAINT `product_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `category`(`category_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sku` ADD CONSTRAINT `sku_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `product`(`product_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `collection_product` ADD CONSTRAINT `collection_product_collection_id_fkey` FOREIGN KEY (`collection_id`) REFERENCES `collection`(`collection_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `collection_product` ADD CONSTRAINT `collection_product_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `product`(`product_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `media` ADD CONSTRAINT `media_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `product`(`product_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `media` ADD CONSTRAINT `media_sku_id_fkey` FOREIGN KEY (`sku_id`) REFERENCES `sku`(`sku_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_level` ADD CONSTRAINT `stock_level_sku_id_fkey` FOREIGN KEY (`sku_id`) REFERENCES `sku`(`sku_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_level` ADD CONSTRAINT `stock_level_location_id_fkey` FOREIGN KEY (`location_id`) REFERENCES `location`(`location_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_movement` ADD CONSTRAINT `stock_movement_sku_id_fkey` FOREIGN KEY (`sku_id`) REFERENCES `sku`(`sku_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_movement` ADD CONSTRAINT `stock_movement_location_id_fkey` FOREIGN KEY (`location_id`) REFERENCES `location`(`location_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_reservation` ADD CONSTRAINT `stock_reservation_sku_id_fkey` FOREIGN KEY (`sku_id`) REFERENCES `sku`(`sku_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_reservation` ADD CONSTRAINT `stock_reservation_location_id_fkey` FOREIGN KEY (`location_id`) REFERENCES `location`(`location_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `price` ADD CONSTRAINT `price_sku_id_fkey` FOREIGN KEY (`sku_id`) REFERENCES `sku`(`sku_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `price` ADD CONSTRAINT `price_channel_id_fkey` FOREIGN KEY (`channel_id`) REFERENCES `channel`(`channel_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Integridade do estoque (RNF-09): saldo nunca negativo e reservado nunca acima do físico.
ALTER TABLE `stock_level` ADD CONSTRAINT `stock_level_non_negative_chk`
    CHECK (`on_hand` >= 0 AND `reserved` >= 0 AND `reserved` <= `on_hand`);

-- Canais de venda e local padrão da operação.
INSERT INTO `channel` (`channel_id`, `code`, `name`) VALUES
    (UUID(), 'site', 'Site'),
    (UUID(), 'ml', 'Mercado Livre'),
    (UUID(), 'shopee', 'Shopee');
INSERT INTO `location` (`location_id`, `name`, `type`) VALUES
    (UUID(), 'Depósito', 'warehouse');
