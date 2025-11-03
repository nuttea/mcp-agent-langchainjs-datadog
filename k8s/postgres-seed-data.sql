-- Seed data for burgers and toppings
-- This script populates the database with all burgers and toppings from the JSON files

-- Clear existing data
TRUNCATE TABLE burgers CASCADE;
TRUNCATE TABLE toppings CASCADE;

-- Insert all 10 burgers
INSERT INTO burgers (id, name, description, price, image) VALUES
('1', 'Classic American Cheeseburger', 'Juicy Angus beef patty topped with melted American cheese, crisp lettuce, tomato, red onion, and house special sauce on a toasted sesame bun.', 10.99, 'burger-pic-1.jpg'),
('2', 'Smoky BBQ Bacon Burger', 'Flame-grilled beef patty covered in smoky barbecue sauce, crispy bacon, cheddar cheese, onion rings, and sliced pickles on a brioche bun.', 12.49, 'burger-pic-2.jpg'),
('3', 'Spicy Jalapeño Fiesta Burger', 'Beef patty with pepper jack cheese, jalapeños, pickled red onions, chipotle mayo, and fresh avocado, served on a corn-dusted bun.', 11.99, 'burger-pic-3.jpg'),
('4', 'Mushroom Swiss Gourmet', 'Savory beef patty topped with sautéed mushrooms, Swiss cheese, caramelized onions, and garlic aioli on a potato roll.', 12.29, 'burger-pic-4.jpg'),
('5', 'Southern Fried Chicken Burger', 'Crispy buttermilk fried chicken breast, tangy coleslaw, spicy mayo, and dill pickles stacked on a soft bun.', 11.49, 'burger-pic-5.jpg'),
('6', 'Cali Veggie Supreme', 'Grilled veggie patty with melted provolone, fresh sprouts, tomato, red onion, cucumber, and herb aioli on a multigrain bun. (Vegetarian)', 10.79, 'burger-pic-6.jpg'),
('7', 'Spiced Chickpea Vegan Burger', 'Crispy spiced chickpea patty topped with vegan tzatziki, arugula, sliced tomato, pickled cucumbers, and red onion on a vegan bun. (Vegan)', 10.99, 'burger-pic-7.jpg'),
('8', 'Tokyo Teriyaki Fusion Burger', 'Seared beef patty glazed with teriyaki sauce, grilled pineapple, wasabi mayo, crisp lettuce, and sesame seeds on a toasted bun.', 12.59, 'burger-pic-8.jpg'),
('9', 'Mediterranean Lamb Burger', 'Juicy lamb patty with feta cheese, tzatziki, grilled eggplant, arugula, and tomato on a ciabatta roll.', 13.49, 'burger-pic-9.jpg'),
('10', 'Gluten-Free Avocado Turkey Burger', 'Grilled turkey patty topped with sliced avocado, pepper jack cheese, lettuce, tomato, and honey mustard, served on a gluten-free bun. (Gluten-Free)', 11.99, 'burger-pic-10.jpg');

-- Add image column to toppings if it doesn't exist
ALTER TABLE toppings ADD COLUMN IF NOT EXISTS image VARCHAR(500);

-- Insert all 22 toppings
INSERT INTO toppings (id, name, category, price, image) VALUES
('1', 'Iceberg Lettuce', 'vegetable', 0.50, 'topping-pic-1.jpg'),
('2', 'Tomato Slices', 'vegetable', 0.70, 'topping-pic-2.jpg'),
('3', 'Red Onion', 'vegetable', 0.40, 'topping-pic-3.jpg'),
('4', 'Pickles', 'vegetable', 0.40, 'topping-pic-4.jpg'),
('5', 'Grilled Mushrooms', 'vegetable', 0.80, 'topping-pic-5.jpg'),
('6', 'Jalapeños', 'vegetable', 0.50, 'topping-pic-6.jpg'),
('7', 'Bacon', 'meat', 1.20, 'topping-pic-7.jpg'),
('8', 'Beef Patty', 'meat', 2.50, 'topping-pic-8.jpg'),
('9', 'Chicken Breast', 'meat', 2.30, 'topping-pic-9.jpg'),
('10', 'Fried Egg', 'extras', 1.00, 'topping-pic-10.jpg'),
('11', 'Cheddar Cheese', 'cheese', 0.70, 'topping-pic-11.jpg'),
('12', 'Swiss Cheese', 'cheese', 0.80, 'topping-pic-12.jpg'),
('13', 'American Cheese', 'cheese', 0.60, 'topping-pic-13.jpg'),
('14', 'Blue Cheese Crumbles', 'cheese', 1.00, 'topping-pic-14.jpg'),
('15', 'Ketchup', 'sauce', 0.20, 'topping-pic-15.jpg'),
('16', 'Mayonnaise', 'sauce', 0.20, 'topping-pic-16.jpg'),
('17', 'Mustard', 'sauce', 0.20, 'topping-pic-17.jpg'),
('18', 'BBQ Sauce', 'sauce', 0.30, 'topping-pic-18.jpg'),
('19', 'Chipotle Mayo', 'sauce', 0.40, 'topping-pic-19.jpg'),
('20', 'Fried Onions', 'extras', 0.60, 'topping-pic-20.jpg'),
('21', 'Avocado', 'extras', 1.10, 'topping-pic-21.jpg'),
('22', 'Pineapple', 'extras', 0.90, 'topping-pic-22.jpg');

-- Display counts
SELECT 'Burgers inserted:' as info, COUNT(*) as count FROM burgers;
SELECT 'Toppings inserted:' as info, COUNT(*) as count FROM toppings;
