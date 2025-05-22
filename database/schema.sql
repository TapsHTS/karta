CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE merchants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    logo_url VARCHAR(255),
    loyalty_program_type VARCHAR(100), -- e.g., 'points', 'stamps'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE loyalty_cards (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    merchant_id INT NOT NULL,
    card_identifier VARCHAR(255) NOT NULL UNIQUE, -- For QR code/barcode
    points INT DEFAULT 0,
    stamps INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (merchant_id) REFERENCES merchants(id),
    UNIQUE KEY `user_merchant_unique` (`user_id`, `merchant_id`)
);

CREATE TABLE transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    loyalty_card_id INT NOT NULL,
    merchant_id INT NOT NULL, -- To track which merchant processed it
    points_added INT DEFAULT 0,
    stamps_added INT DEFAULT 0,
    transaction_type VARCHAR(50), -- e.g., 'earn_points', 'redeem'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (loyalty_card_id) REFERENCES loyalty_cards(id),
    FOREIGN KEY (merchant_id) REFERENCES merchants(id)
);
