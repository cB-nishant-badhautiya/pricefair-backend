import { scrapeUrl, parsePastedText } from "./scraper.js";
import { analyzePrice } from "./openai.js";
import { prisma } from "../lib/prisma.js";

export async function runPriceCheck(input) {
  const { url, pastedText, type: forcedType } = input;

  let payload = {
    type: "product",
    source: "Manual",
    title: "Unknown",
    currentPrice: null,
    rawInput: url || pastedText || null,
  };

  if (url && url.startsWith("http")) {
    const scraped = await scrapeUrl(url);
    if (scraped.error) {
      payload.rawInput = JSON.stringify({ url, error: scraped.error });
      if (scraped.error === "CAPTCHA_BLOCK" && scraped.captchaMessage) {
        return {
          success: false,
          error: scraped.captchaMessage,
          code: "CAPTCHA_BLOCK",
        };
      }
      if (!scraped.currentPrice && pastedText) {
        const pasted = parsePastedText(pastedText);
        if (pasted) {
          payload.title = pasted.title;
          payload.currentPrice = pasted.currentPrice;
          payload.source = pasted.source || "Pasted";
        }
      } else {
        payload.title = scraped.title;
        payload.currentPrice = scraped.currentPrice;
        payload.source = scraped.source || "URL";
        payload.type = scraped.type;
      }
    } else {
      payload.type = scraped.type;
      payload.source = scraped.source;
      payload.title = scraped.title;
      payload.currentPrice = scraped.currentPrice;
    }
  } else if (pastedText) {
    const pasted = parsePastedText(pastedText);
    if (pasted) {
      payload.title = pasted.title;
      payload.currentPrice = pasted.currentPrice;
      payload.type = pasted.type || "product";
      payload.source = pasted.source || "Pasted";
    }
  }

  if (forcedType) payload.type = forcedType;
  if (payload.currentPrice == null || payload.currentPrice <= 0) {
    return {
      success: false,
      error: "Could not determine a valid price. Please provide a URL or paste product/price details.",
    };
  }

  const ai = await analyzePrice({
    type: payload.type,
    title: payload.title,
    currentPrice: payload.currentPrice,
    source: payload.source,
  });

  const record = await prisma.priceCheck.create({
    data: {
      type: payload.type,
      sourceUrl: url || null,
      sourceName: payload.source,
      title: payload.title,
      currentPrice: payload.currentPrice,
      currency: "INR",
      rawInput: payload.rawInput ? payload.rawInput.slice(0, 5000) : null,
      fairPriceLow: ai.fairPriceLow,
      fairPriceHigh: ai.fairPriceHigh,
      surgeScore: ai.surgeScore,
      recommendation: ai.recommendation,
      confidenceScore: ai.confidenceScore,
      insightSummary: ai.insightSummary,
      fullAnalysis: JSON.stringify(ai),
    },
  });

  return {
    success: true,
    id: record.id,
    type: record.type,
    source: record.sourceName,
    title: record.title,
    currentPrice: record.currentPrice,
    currency: record.currency,
    fairPriceLow: ai.fairPriceLow,
    fairPriceHigh: ai.fairPriceHigh,
    surgeScore: ai.surgeScore,
    recommendation: ai.recommendation,
    confidenceScore: ai.confidenceScore,
    insightSummary: ai.insightSummary,
    bestTimeToBuy: ai.bestTimeToBuy,
    reasons: ai.reasons || [],
  };
}

const historySelect = {
  id: true,
  type: true,
  sourceName: true,
  title: true,
  currentPrice: true,
  surgeScore: true,
  recommendation: true,
  confidenceScore: true,
  createdAt: true,
};

export async function getRecentChecks(limit = 20) {
  return prisma.priceCheck.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: historySelect,
  });
}

export async function getRecentChecksPaginated({ page = 1, limit = 10, type, recommendation }) {
  const skip = (Math.max(1, page) - 1) * limit;
  const take = Math.min(50, Math.max(1, limit));
  const where = {};
  if (type && ["product", "hotel", "flight"].includes(type)) where.type = type;
  if (recommendation && ["buy_now", "wait", "neutral"].includes(recommendation)) {
    where.recommendation = recommendation;
  }
  const [items, total] = await Promise.all([
    prisma.priceCheck.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      select: historySelect,
    }),
    prisma.priceCheck.count({ where }),
  ]);
  const totalPages = Math.ceil(total / take) || 1;
  return { items, total, page: Math.max(1, page), limit: take, totalPages };
}

export async function getCheckById(id) {
  return prisma.priceCheck.findUnique({
    where: { id },
  });
}
