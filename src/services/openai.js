import OpenAI from "openai";
import dotenv from "dotenv";
import path from "path";
dotenv.config({
  path: path.join(process.cwd(), "./backend/.env"),
  override: true,
});

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

const SYSTEM_PROMPT = `You are an expert price fairness analyst. Given product, hotel, or flight details and current price, you must:

1. Estimate a fair price range (low and high in same currency).
2. Detect surge/dynamic pricing: score 0-100 (0=no surge, 100=heavy surge).
3. Recommend: "buy_now" if price is fair or below fair, "wait" if likely to drop, "neutral" if unsure.
4. Suggest best time to buy if waiting (e.g. "next week", "off-season", "Tuesday morning").
5. Give a confidence score 0-100 for your analysis.
6. Write a short insight summary (2-3 sentences).

Use heuristic reasoning: category, typical margins, seasonality, demand signals. If historical data is not provided, base on general market knowledge. Always respond with valid JSON only.`;

export async function analyzePrice({ type, title, currentPrice, source, currency = "INR" }) {
  const prompt = `Type: ${type}
Source: ${source || "Unknown"}
Title/Name: ${title || "Not provided"}
Current price: ${currentPrice} ${currency}

Respond with exactly this JSON (no markdown, no code block):
{
  "fairPriceLow": number,
  "fairPriceHigh": number,
  "surgeScore": number,
  "recommendation": "buy_now" | "wait" | "neutral",
  "confidenceScore": number,
  "insightSummary": "string",
  "bestTimeToBuy": "string",
  "reasons": ["short reason 1", "short reason 2"]
}`;

  if (!openai) {
    return {
      fairPriceLow: currentPrice * 0.85,
      fairPriceHigh: currentPrice * 1.15,
      surgeScore: 45,
      recommendation: "neutral",
      confidenceScore: 30,
      insightSummary: "Set OPENAI_API_KEY for AI-powered analysis. This is a placeholder.",
      bestTimeToBuy: "Unknown",
      reasons: ["OpenAI key not configured"],
    };
  }
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    temperature: 0.3,
  });

  const raw = completion.choices[0]?.message?.content?.trim() || "{}";
  let parsed;
  try {
    const cleaned = raw.replace(/```json?\s*/g, "").replace(/```\s*/g, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    parsed = {
      fairPriceLow: currentPrice * 0.9,
      fairPriceHigh: currentPrice * 1.1,
      surgeScore: 50,
      recommendation: "neutral",
      confidenceScore: 40,
      insightSummary: "Analysis could not be parsed. Consider rechecking the price manually.",
      bestTimeToBuy: "Unknown",
      reasons: [],
    };
  }
  return parsed;
}
