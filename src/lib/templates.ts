export type Template = {
  id: string;
  name: string;
  category: string;
  description: string;
  idea: string;
};

export const TEMPLATES: Template[] = [
  {
    id: "fitness",
    name: "Fitness Tracker",
    category: "Health",
    description: "Workouts, activity rings, and progress",
    idea: "A minimalist fitness tracking app with dark mode, activity rings, workout sessions, and personal records. Include onboarding, home dashboard, workout detail, and profile.",
  },
  {
    id: "social",
    name: "Social Feed",
    category: "Social",
    description: "Feed, stories, profiles, messaging",
    idea: "A modern social app with a vertical feed of posts, stories row, discovery grid, user profiles, and a message inbox. Playful but clean typography.",
  },
  {
    id: "ecommerce",
    name: "Sneaker Marketplace",
    category: "E-commerce",
    description: "Product drops, detail, cart, checkout",
    idea: "A high-end sneaker marketplace with glassmorphism cards. Discovery drops feed, product detail with size picker, cart, and checkout flow.",
  },
  {
    id: "finance",
    name: "Neobank",
    category: "Finance",
    description: "Balance, transactions, cards, insights",
    idea: "A premium neobank app with account balance, transaction list, card management, and spending insights. Serious, trustworthy design.",
  },
  {
    id: "food",
    name: "Food Delivery",
    category: "Lifestyle",
    description: "Restaurants, dishes, orders, tracking",
    idea: "A food delivery app with restaurant discovery, menu, cart, and order tracking. Warm colors, appetizing photography.",
  },
  {
    id: "travel",
    name: "Travel Planner",
    category: "Travel",
    description: "Trips, bookings, itineraries, maps",
    idea: "A travel planning app with trip discovery, destination detail, itinerary, and booking flow. Airy layout with generous imagery.",
  },
  {
    id: "productivity",
    name: "Task Manager",
    category: "Productivity",
    description: "Projects, tasks, focus, calendar",
    idea: "A focused task management app with project list, today view, task detail, and calendar. Restrained, monochrome design.",
  },
  {
    id: "meditation",
    name: "Meditation",
    category: "Wellness",
    description: "Sessions, sleep, breathing, streaks",
    idea: "A calming meditation app with session library, breathing exercises, sleep stories, and streak tracking. Soft gradients.",
  },
];