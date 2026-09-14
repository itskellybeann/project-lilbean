import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const prisma = new PrismaClient();

const EXERCISES: { name: string; category: string; equipment?: string; muscleGroups: string[] }[] = [
  { name: "Barbell Back Squat", category: "Legs", equipment: "Barbell", muscleGroups: ["Quads", "Glutes", "Hamstrings"] },
  { name: "Barbell Front Squat", category: "Legs", equipment: "Barbell", muscleGroups: ["Quads", "Glutes"] },
  { name: "Romanian Deadlift", category: "Legs", equipment: "Barbell", muscleGroups: ["Hamstrings", "Glutes"] },
  { name: "Conventional Deadlift", category: "Back", equipment: "Barbell", muscleGroups: ["Back", "Hamstrings", "Glutes"] },
  { name: "Leg Press", category: "Legs", equipment: "Machine", muscleGroups: ["Quads", "Glutes"] },
  { name: "Walking Lunge", category: "Legs", equipment: "Dumbbell", muscleGroups: ["Quads", "Glutes"] },
  { name: "Leg Curl", category: "Legs", equipment: "Machine", muscleGroups: ["Hamstrings"] },
  { name: "Calf Raise", category: "Legs", equipment: "Machine", muscleGroups: ["Calves"] },
  { name: "Barbell Bench Press", category: "Chest", equipment: "Barbell", muscleGroups: ["Chest", "Triceps", "Shoulders"] },
  { name: "Incline Dumbbell Press", category: "Chest", equipment: "Dumbbell", muscleGroups: ["Chest", "Shoulders"] },
  { name: "Push-Up", category: "Chest", equipment: "Bodyweight", muscleGroups: ["Chest", "Triceps"] },
  { name: "Cable Fly", category: "Chest", equipment: "Cable", muscleGroups: ["Chest"] },
  { name: "Pull-Up", category: "Back", equipment: "Bodyweight", muscleGroups: ["Back", "Biceps"] },
  { name: "Lat Pulldown", category: "Back", equipment: "Cable", muscleGroups: ["Back", "Biceps"] },
  { name: "Barbell Row", category: "Back", equipment: "Barbell", muscleGroups: ["Back", "Biceps"] },
  { name: "Seated Cable Row", category: "Back", equipment: "Cable", muscleGroups: ["Back"] },
  { name: "Overhead Press", category: "Shoulders", equipment: "Barbell", muscleGroups: ["Shoulders", "Triceps"] },
  { name: "Lateral Raise", category: "Shoulders", equipment: "Dumbbell", muscleGroups: ["Shoulders"] },
  { name: "Face Pull", category: "Shoulders", equipment: "Cable", muscleGroups: ["Shoulders", "Back"] },
  { name: "Barbell Curl", category: "Arms", equipment: "Barbell", muscleGroups: ["Biceps"] },
  { name: "Hammer Curl", category: "Arms", equipment: "Dumbbell", muscleGroups: ["Biceps"] },
  { name: "Triceps Pushdown", category: "Arms", equipment: "Cable", muscleGroups: ["Triceps"] },
  { name: "Skull Crusher", category: "Arms", equipment: "Barbell", muscleGroups: ["Triceps"] },
  { name: "Plank", category: "Core", equipment: "Bodyweight", muscleGroups: ["Core"] },
  { name: "Hanging Leg Raise", category: "Core", equipment: "Bodyweight", muscleGroups: ["Core"] },
  { name: "Cable Crunch", category: "Core", equipment: "Cable", muscleGroups: ["Core"] },
  { name: "Hip Thrust", category: "Legs", equipment: "Barbell", muscleGroups: ["Glutes"] },
  { name: "Dumbbell Shoulder Press", category: "Shoulders", equipment: "Dumbbell", muscleGroups: ["Shoulders", "Triceps"] },
  { name: "Chin-Up", category: "Back", equipment: "Bodyweight", muscleGroups: ["Back", "Biceps"] },
  { name: "Goblet Squat", category: "Legs", equipment: "Dumbbell", muscleGroups: ["Quads", "Glutes"] },
];

const FOODS: {
  name: string;
  brand?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
}[] = [
  { name: "Chicken Breast, cooked", calories: 165, protein: 31, carbs: 0, fat: 3.6 },
  { name: "White Rice, cooked", calories: 130, protein: 2.7, carbs: 28, fat: 0.3 },
  { name: "Brown Rice, cooked", calories: 123, protein: 2.7, carbs: 26, fat: 1 },
  { name: "Egg, whole", calories: 155, protein: 13, carbs: 1.1, fat: 11 },
  { name: "Egg Whites", calories: 52, protein: 11, carbs: 0.7, fat: 0.2 },
  { name: "Rolled Oats, dry", calories: 389, protein: 17, carbs: 66, fat: 7 },
  { name: "Greek Yogurt, plain nonfat", calories: 59, protein: 10, carbs: 3.6, fat: 0.4 },
  { name: "Banana", calories: 89, protein: 1.1, carbs: 23, fat: 0.3 },
  { name: "Broccoli, cooked", calories: 35, protein: 2.4, carbs: 7, fat: 0.4 },
  { name: "Sweet Potato, baked", calories: 90, protein: 2, carbs: 21, fat: 0.1 },
  { name: "Salmon, cooked", calories: 208, protein: 20, carbs: 0, fat: 13 },
  { name: "Ground Beef 90/10, cooked", calories: 176, protein: 20, carbs: 0, fat: 10 },
  { name: "Almonds", calories: 579, protein: 21, carbs: 22, fat: 50 },
  { name: "Peanut Butter", calories: 588, protein: 25, carbs: 20, fat: 50 },
  { name: "Whey Protein Powder", calories: 400, protein: 80, carbs: 8, fat: 6 },
  { name: "Whole Wheat Bread", calories: 247, protein: 13, carbs: 41, fat: 3.4 },
  { name: "Avocado", calories: 160, protein: 2, carbs: 9, fat: 15 },
  { name: "Olive Oil", calories: 884, protein: 0, carbs: 0, fat: 100 },
  { name: "Black Beans, cooked", calories: 132, protein: 8.9, carbs: 24, fat: 0.5 },
  { name: "Cottage Cheese, low fat", calories: 72, protein: 12, carbs: 3, fat: 1 },
];

async function main() {
  const users = [
    {
      email: process.env.USER1_EMAIL || "kellyeads37@gmail.com",
      name: process.env.USER1_NAME || "Kelly",
      password: process.env.USER1_PASSWORD || crypto.randomBytes(9).toString("base64url"),
    },
    {
      email: process.env.USER2_EMAIL || "partner@example.com",
      name: process.env.USER2_NAME || "Partner",
      password: process.env.USER2_PASSWORD || crypto.randomBytes(9).toString("base64url"),
    },
  ];

  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, 12);
    const existing = await prisma.user.findUnique({ where: { email: u.email.toLowerCase() } });
    if (existing) {
      console.log(`User ${u.email} already exists, skipping password reset.`);
      continue;
    }
    await prisma.user.create({
      data: { email: u.email.toLowerCase(), name: u.name, passwordHash },
    });
    console.log(`Created user ${u.email} (name: ${u.name})`);
    if (!process.env[`USER1_PASSWORD`] && u === users[0]) {
      console.log(`  -> generated password: ${u.password} (set USER1_PASSWORD env var to control this)`);
    }
    if (!process.env[`USER2_PASSWORD`] && u === users[1]) {
      console.log(`  -> generated password: ${u.password} (set USER2_PASSWORD env var to control this)`);
    }
  }

  for (const ex of EXERCISES) {
    await prisma.exercise.upsert({
      where: { name_createdByUserId: { name: ex.name, createdByUserId: null } as any },
      update: {},
      create: { ...ex, isCustom: false },
    }).catch(async () => {
      const existing = await prisma.exercise.findFirst({ where: { name: ex.name, createdByUserId: null } });
      if (!existing) {
        await prisma.exercise.create({ data: { ...ex, isCustom: false } });
      }
    });
  }
  console.log(`Seeded ${EXERCISES.length} exercises.`);

  for (const f of FOODS) {
    const existing = await prisma.food.findFirst({ where: { name: f.name, ownerUserId: null } });
    if (!existing) {
      await prisma.food.create({ data: { ...f, ownerUserId: null, source: "seed" } });
    }
  }
  console.log(`Seeded ${FOODS.length} foods.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
