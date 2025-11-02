#!/bin/bash
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Create users table
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Create burgers table
    CREATE TABLE IF NOT EXISTS burgers (
      id VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      price DECIMAL(10, 2) NOT NULL,
      image VARCHAR(500),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Create orders table
    CREATE TABLE IF NOT EXISTS orders (
      id VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      total DECIMAL(10, 2) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Create order_items table
    CREATE TABLE IF NOT EXISTS order_items (
      id SERIAL PRIMARY KEY,
      order_id VARCHAR(255) NOT NULL,
      burger_id VARCHAR(255) NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      price DECIMAL(10, 2) NOT NULL,
      toppings JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (burger_id) REFERENCES burgers(id) ON DELETE CASCADE
    );

    -- Insert sample burgers
    INSERT INTO burgers (id, name, description, price, image) VALUES
      ('classic-burger', 'Classic Burger', 'A timeless favorite with lettuce, tomato, onion, pickles, and our special sauce', 8.99, '/images/classic-burger.jpg'),
      ('cheese-burger', 'Cheese Burger', 'Classic burger topped with melted cheddar cheese', 9.99, '/images/cheese-burger.jpg'),
      ('bacon-burger', 'Bacon Burger', 'Loaded with crispy bacon strips and cheese', 10.99, '/images/bacon-burger.jpg'),
      ('veggie-burger', 'Veggie Burger', 'Plant-based patty with fresh vegetables', 9.49, '/images/veggie-burger.jpg'),
      ('double-burger', 'Double Burger', 'Two beef patties with double cheese', 12.99, '/images/double-burger.jpg'),
      ('spicy-burger', 'Spicy Burger', 'Spiced patty with jalapeños and spicy mayo', 10.49, '/images/spicy-burger.jpg')
    ON CONFLICT (id) DO NOTHING;

    -- Create indexes for better performance
    CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
    CREATE INDEX IF NOT EXISTS idx_order_items_burger_id ON order_items(burger_id);

    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $POSTGRES_USER;
    GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $POSTGRES_USER;

    \echo 'Database initialized successfully!'
EOSQL
