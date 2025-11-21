-- Login to MariaDB: mysql -u root -p
-- Create Database: CREATE DATABASE hungr;
-- Use Database: USE hungr;
-- Source this file: SOURCE /var/www/html/websites/nfcrevolution/hungr/database.sql;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS restaurants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    cuisine_type VARCHAR(50),
    image_url VARCHAR(255),
    rating DECIMAL(2,1) DEFAULT 5.0,
    delivery_time_min INT,
    delivery_time_max INT,
    is_featured BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS menu_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    restaurant_id INT,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    image_url VARCHAR(255),
    category VARCHAR(50), -- e.g., 'Mains', 'Drinks', 'Add-ons'
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    restaurant_id INT,
    total_amount DECIMAL(10,2),
    status ENUM('pending', 'preparing', 'delivering', 'delivered', 'cancelled') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
);

CREATE TABLE IF NOT EXISTS order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT,
    menu_item_id INT,
    quantity INT NOT NULL,
    price_at_time DECIMAL(10,2),
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
);

-- Seed some initial data for testing
INSERT INTO restaurants (name, cuisine_type, image_url, rating, delivery_time_min, delivery_time_max, is_featured) VALUES 
('Manila BBQ Spot', 'Filipino', 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&q=80&w=800', 4.8, 25, 40, TRUE),
('Sakura Ramen', 'Japanese', 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&q=80&w=800', 4.5, 30, 50, TRUE),
('Burgers & Brews', 'American', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=800', 4.2, 20, 35, FALSE);

INSERT INTO menu_items (restaurant_id, name, description, price, category) VALUES
(1, 'Chicken Inasal', 'Grilled chicken marinated in lemongrass and calamansi', 180.00, 'Mains'),
(1, 'Pork Sisig', 'Sizzling chopped pork with onions and chili', 220.00, 'Mains'),
(2, 'Tonkotsu Ramen', 'Rich pork bone broth with chashu', 350.00, 'Noodles'),
(3, 'Cheeseburger Deluxe', 'Quarter pounder with cheddar and fries', 250.00, 'Burgers');
