import { z } from 'zod';
import { burgerApiUrl } from './config.js';

export const tools = [
  {
    name: 'get_burgers',
    description: 'Get a list of all burgers in the menu',
    async handler() {
      return fetchBurgerApi('/api/burgers');
    },
  },
  {
    name: 'get_burger_by_id',
    description: 'Get a specific burger by its ID',
    schema: z.object({
      id: z.string().describe('ID of the burger to retrieve'),
    }),
    async handler(args: z.ZodRawShape) {
      return fetchBurgerApi(`/api/burgers/${args.id}`);
    },
  },
  {
    name: 'get_toppings',
    description: 'Get a list of all toppings in the menu',
    schema: z.object({
      category: z.string().optional().describe('Category of toppings to filter by (can be empty)'),
    }),
    async handler(args: z.ZodRawShape) {
      return fetchBurgerApi(`/api/toppings?category=${args.category ?? ''}`);
    },
  },
  {
    name: 'get_topping_by_id',
    description: 'Get a specific topping by its ID',
    schema: z.object({
      id: z.string().describe('ID of the topping to retrieve'),
    }),
    async handler(args: z.ZodRawShape) {
      return fetchBurgerApi(`/api/toppings/${args.id}`);
    },
  },
  {
    name: 'get_topping_categories',
    description: 'Get a list of all topping categories',
    async handler(args: z.ZodRawShape) {
      return fetchBurgerApi('/api/toppings/categories');
    },
  },
  {
    name: 'get_orders',
    description: 'Get a list of orders in the system',
    schema: z.object({
      userId: z.string().optional().describe('Filter orders by user ID'),
      status: z.string().optional().describe('Filter by order status. Comma-separated list allowed.'),
      last: z.string().optional().describe("Filter orders created in the last X minutes or hours (e.g. '60m', '2h')"),
    }),
    async handler(args: { userId?: string; status?: string; last?: string }) {
      const parameters = new URLSearchParams();
      if (args.userId) parameters.append('userId', args.userId);
      if (args.status) parameters.append('status', args.status);
      if (args.last) parameters.append('last', args.last);
      const query = parameters.toString();
      const url = query ? `/api/orders?${query}` : '/api/orders';
      return fetchBurgerApi(url);
    },
  },
  {
    name: 'get_order_by_id',
    description: 'Get a specific order by its ID',
    schema: z.object({
      id: z.string().describe('ID of the order to retrieve'),
    }),
    async handler(args: z.ZodRawShape) {
      return fetchBurgerApi(`/api/orders/${args.id}`);
    },
  },
  {
    name: 'place_order',
    description: 'Place a new order with burgers (requires userId)',
    schema: z.object({
      userId: z.string().describe('ID of the user placing the order'),
      nickname: z.string().optional().describe('Optional nickname for the order (only first 10 chars displayed)'),
      items: z
        .array(
          z.object({
            burgerId: z.string().describe('ID of the burger'),
            quantity: z.number().min(1).describe('Quantity of the burger'),
            extraToppingIds: z.array(z.string()).describe('List of extra topping IDs'),
          }),
        )
        .nonempty()
        .describe('List of items in the order'),
    }),
    async handler(args: z.ZodRawShape) {
      return fetchBurgerApi('/api/orders', {
        method: 'POST',
        body: JSON.stringify(args),
      });
    },
  },
  {
    name: 'delete_order_by_id',
    description: 'Cancel an order if it has not yet been started (status must be "pending", requires userId)',
    schema: z.object({
      id: z.string().describe('ID of the order to cancel'),
      userId: z.string().describe('ID of the user that placed the order'),
    }),
    async handler(args: z.ZodRawShape) {
      return fetchBurgerApi(`/api/orders/${args.id}?userId=${args.userId}`, {
        method: 'DELETE',
      });
    },
  },
  {
    name: 'get_weather',
    description: 'Get current weather information for a location. Useful for suggesting menu items based on weather conditions.',
    schema: z.object({
      city: z.string().optional().describe('City name (defaults to "San Francisco")'),
    }),
    async handler(args: { city?: string }) {
      const city = args.city || 'San Francisco';
      // Using wttr.in - a free weather service that doesn't require API keys
      const url = `https://wttr.in/${encodeURIComponent(city)}?format=j1`;
      console.error(`Fetching weather for ${city}`);
      try {
        const response = await fetch(url);
        if (!response.ok) {
          return JSON.stringify({ error: 'Unable to fetch weather data', city });
        }
        const data = await response.json();
        const current = data.current_condition[0];
        const weather = {
          city,
          temperature_f: current.temp_F,
          temperature_c: current.temp_C,
          condition: current.weatherDesc[0].value,
          humidity: current.humidity,
          feels_like_f: current.FeelsLikeF,
          feels_like_c: current.FeelsLikeC,
        };
        return JSON.stringify(weather);
      } catch (error: any) {
        console.error(`Error fetching weather:`, error);
        return JSON.stringify({ error: 'Weather service unavailable', city });
      }
    },
  },
  {
    name: 'get_fun_fact',
    description: 'Get a random fun fact or joke to entertain users while they wait. Great for keeping customers engaged!',
    schema: z.object({
      type: z.enum(['food', 'number', 'joke']).optional().describe('Type of fun fact: food trivia, number fact, or dad joke'),
    }),
    async handler(args: { type?: 'food' | 'number' | 'joke' }) {
      const type = args.type || 'joke';

      try {
        if (type === 'joke') {
          // Dad jokes API - no key required
          const response = await fetch('https://icanhazdadjoke.com/', {
            headers: { 'Accept': 'application/json' },
          });
          const data = await response.json();
          return JSON.stringify({ type: 'joke', fact: data.joke });
        } else if (type === 'number') {
          // Numbers API - random trivia
          const randomNum = Math.floor(Math.random() * 1000);
          const response = await fetch(`http://numbersapi.com/${randomNum}/trivia`);
          const fact = await response.text();
          return JSON.stringify({ type: 'number', fact });
        } else {
          // Food-related fun facts (hardcoded for reliability)
          const foodFacts = [
            "The world's largest burger weighed 2,014 pounds and was created in Minnesota!",
            "Americans eat about 50 billion burgers per year – that's 3 burgers per person per week!",
            "The hamburger got its name from Hamburg, Germany, where a similar dish was popular.",
            "Cheese was first added to burgers in the 1920s by Lionel Sternberger in California.",
            "The most expensive burger ever sold cost $5,000 and was topped with foie gras and truffles.",
            "McDonald's sells 75 burgers every second worldwide!",
            "The oldest hamburger chain in the US is White Castle, founded in 1921.",
            "A burger patty should be handled as little as possible to keep it tender and juicy.",
          ];
          const fact = foodFacts[Math.floor(Math.random() * foodFacts.length)];
          return JSON.stringify({ type: 'food', fact });
        }
      } catch (error: any) {
        console.error(`Error fetching fun fact:`, error);
        return JSON.stringify({ type, fact: "Did you know? Burgers are one of America's favorite foods!" });
      }
    },
  },
  {
    name: 'get_nutrition_info',
    description: 'Get nutritional information for common burger ingredients. Helps health-conscious customers make informed choices.',
    schema: z.object({
      ingredient: z.string().describe('Ingredient name (e.g., "beef patty", "cheese", "lettuce")'),
    }),
    async handler(args: { ingredient: string }) {
      // Simplified nutrition data for common burger ingredients
      const nutritionData: Record<string, any> = {
        'beef patty': {
          ingredient: 'Beef Patty (4 oz)',
          calories: 287,
          protein: '19g',
          fat: '23g',
          carbs: '0g',
          sodium: '75mg',
        },
        'cheese': {
          ingredient: 'Cheese Slice',
          calories: 113,
          protein: '7g',
          fat: '9g',
          carbs: '1g',
          sodium: '215mg',
        },
        'lettuce': {
          ingredient: 'Lettuce',
          calories: 5,
          protein: '0.5g',
          fat: '0g',
          carbs: '1g',
          sodium: '3mg',
        },
        'tomato': {
          ingredient: 'Tomato Slice',
          calories: 5,
          protein: '0.2g',
          fat: '0g',
          carbs: '1g',
          sodium: '1mg',
        },
        'onion': {
          ingredient: 'Onion',
          calories: 10,
          protein: '0.3g',
          fat: '0g',
          carbs: '2g',
          sodium: '1mg',
        },
        'bacon': {
          ingredient: 'Bacon (2 strips)',
          calories: 86,
          protein: '6g',
          fat: '7g',
          carbs: '0g',
          sodium: '310mg',
        },
        'bun': {
          ingredient: 'Burger Bun',
          calories: 145,
          protein: '5g',
          fat: '2g',
          carbs: '28g',
          sodium: '241mg',
        },
        'pickle': {
          ingredient: 'Pickle Slices',
          calories: 5,
          protein: '0g',
          fat: '0g',
          carbs: '1g',
          sodium: '210mg',
        },
      };

      const key = args.ingredient.toLowerCase();
      const info = nutritionData[key] || {
        ingredient: args.ingredient,
        error: 'Nutritional information not available for this ingredient',
        suggestion: 'Try: beef patty, cheese, lettuce, tomato, onion, bacon, bun, pickle',
      };

      return JSON.stringify(info);
    },
  },
];

// Wraps standard fetch to include the base URL and handle errors
async function fetchBurgerApi(url: string, options: RequestInit = {}): Promise<string> {
  const fullUrl = new URL(url, burgerApiUrl).toString();
  console.error(`Fetching ${fullUrl}`);
  try {
    const response = await fetch(fullUrl, {
      ...options,
      headers: {
        ...options.headers,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
    if (!response.ok) {
      throw new Error(`Error fetching ${fullUrl}: ${response.statusText}`);
    }

    if (response.status === 204) {
      return 'Operation completed successfully. No content returned.';
    }

    return JSON.stringify(await response.json());
  } catch (error: any) {
    console.error(`Error fetching ${fullUrl}:`, error);
    throw error;
  }
}
