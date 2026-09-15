import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
// The SDK's zodOutputFormat helper is typed against zod's v4 API surface,
// which zod 3.25+ ships as a compatibility subpath even on the 3.x line.
import { z } from "zod/v4";

export const foodPhotoEnabled = Boolean(process.env.ANTHROPIC_API_KEY);

const client = foodPhotoEnabled ? new Anthropic() : null;

const FoodEstimateSchema = z.object({
  name: z.string().describe("Short name of the dish or food item(s) visible"),
  servingSize: z.number().describe("Estimated portion size, in the unit given by servingUnit"),
  servingUnit: z.string().describe('Unit for servingSize, e.g. "g", "bowl", "plate", "cup"'),
  calories: z.number().describe("Estimated total calories for the portion shown"),
  protein: z.number().describe("Estimated grams of protein for the portion shown"),
  carbs: z.number().describe("Estimated grams of carbohydrates for the portion shown"),
  fat: z.number().describe("Estimated grams of fat for the portion shown"),
  confidence: z.enum(["low", "medium", "high"]).describe("How confident this estimate is"),
  notes: z.string().describe("One short sentence on what was identified or any uncertainty (e.g. hidden oils, sauces)"),
});

export type FoodEstimate = z.infer<typeof FoodEstimateSchema>;

const PROMPT = `Look at this photo of food and estimate its nutrition. Identify what's in the photo, estimate the portion size, and estimate total calories, protein, carbs, and fat for that portion. This is a rough visual estimate for someone tracking macros casually — do your best from appearance alone (typical recipes/preparations, visible portion size), and use the confidence field and notes to flag anything you're unsure about (mixed dishes, hidden oils/sauces, unclear portion size).`;

export async function analyzeFoodPhoto(imageBase64: string, mediaType: string): Promise<FoodEstimate> {
  if (!client) throw new Error("Food photo analysis is not configured on this server (no ANTHROPIC_API_KEY)");

  const response = await client.messages.parse({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType as "image/jpeg", data: imageBase64 },
          },
          { type: "text", text: PROMPT },
        ],
      },
    ],
    output_config: {
      format: zodOutputFormat(FoodEstimateSchema),
    },
  });

  if (!response.parsed_output) {
    throw new Error("Could not parse a nutrition estimate from that photo");
  }
  return response.parsed_output;
}
