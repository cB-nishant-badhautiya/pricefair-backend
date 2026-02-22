import https from "node:https";
import http from "node:http";
import axios from "axios";
import * as cheerio from "cheerio";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// Accept self-signed and invalid certs so scraping works for more sites (e.g. dev/staging, corporate proxies)
const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
  keepAlive: true,
});
const httpAgent = new http.Agent({ keepAlive: true });

const scraperClient = axios.create({
  httpsAgent,
  httpAgent,
  timeout: 15000,
  maxRedirects: 5,
  validateStatus: () => true,
  headers: {
    "User-Agent": USER_AGENT,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
  },
});

function normalizePrice(str) {
  if (!str || typeof str !== "string") return null;
  const num = parseFloat(str.replace(/[^\d.]/g, ""));
  return isNaN(num) ? null : num;
}

function detectSource(url) {
  const u = (url || "").toLowerCase();
  if (u.includes("amzn")) return "Amazon";
  if (u.includes("amazon.")) return "Amazon";
  if (u.includes("flipkart")) return "Flipkart";
  if (u.includes("booking.com") || u.includes("goibibo") || u.includes("makemytrip")) return "Hotel";
  if (u.includes("skyscanner") || u.includes("google.com/travel") || u.includes("flight")) return "Flight";
  return "Unknown";
}

async function fetchHtml(url) {
  const isCertError = (e) =>
    e?.message?.includes("self-signed certificate") ||
    e?.message?.includes("certificate") ||
    e?.code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" ||
    e?.code === "CERT_HAS_EXPIRED";
  try {
    const { data } = await scraperClient.get(url);
    return data;
  } catch (err) {
    if (isCertError(err)) {
      const prev = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
      try {
        const { data } = await scraperClient.get(url);
        return data;
      } finally {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = prev;
      }
    }
    throw err;
  }
}

function isCaptchaPage(html, $) {
  if (!html || typeof html !== "string") return false;
  const lower = html.toLowerCase();
  const title = ($("title").text() || "").toLowerCase();
  return (
    title.includes("recaptcha") ||
    title.includes("captcha") ||
    lower.includes("are you a human") ||
    lower.includes("confirming...") ||
    (lower.includes("recaptcha") && lower.includes("flipkart")) ||
    (lower.includes("recaptcha") && lower.includes("amazon"))
  );
}

export async function scrapeUrl(url) {
  const source = detectSource(url);
  try {
    const data = await fetchHtml(url);
    const $ = cheerio.load(data);

    if (isCaptchaPage(data, $)) {
      const site = source === "Flipkart" ? "Flipkart" : source === "Amazon" ? "Amazon" : "This site";
      return {
        error: "CAPTCHA_BLOCK",
        captchaMessage: `${site} is showing a security check. Try again later or paste the product name and price in the text box below.`,
        type: "product",
        source,
        title: null,
        currentPrice: null,
      };
    }

    if (source === "Amazon") {
      const title =
        $("#productTitle").text().trim() ||
        $("h1#title").text().trim() ||
        $('[data-feature-name="title"]').first().text().trim();
      let price =
        normalizePrice($(".a-price-whole").first().text()) ||
        normalizePrice($("#priceblock_ourprice").text()) ||
        normalizePrice($("#priceblock_dealprice").text()) ||
        normalizePrice($('span[data-a-color="price"] span').first().text());
      return {
        type: "product",
        source: "Amazon",
        title: title || "Product",
        currentPrice: price,
        rawHtml: title ? null : $.html().slice(0, 5000),
      };
    }

    if (source === "Flipkart") {
      const title =
        $("span.B_NuCI").first().text().trim() ||
        $("h1.yhB1nd").first().text().trim();
      let price =
        normalizePrice($("div._30jeq3._16Jk6d").first().text()) ||
        normalizePrice($("div._25b18c ._16Jk6d").first().text()) ||
        normalizePrice($("[class*=_30jeq3]").first().text());
      return {
        type: "product",
        source: "Flipkart",
        title: title || "Product",
        currentPrice: price,
        rawHtml: title ? null : $.html().slice(0, 5000),
      };
    }

    if (source === "Hotel") {
      const title =
        $("h1").first().text().trim() ||
        $('[data-testid="property-name"]').text().trim() ||
        "Hotel";
      const price =
        normalizePrice($('[data-testid="price"]').text()) ||
        normalizePrice($(".prco-valign-middle-helper").first().text()) ||
        normalizePrice($(".room-price").first().text());
      return {
        type: "hotel",
        source: source,
        title,
        currentPrice: price,
        rawHtml: !price ? $.html().slice(0, 5000) : null,
      };
    }

    if (source === "Flight") {
      const title = $("h1").first().text().trim() || "Flight";
      const price =
        normalizePrice($('[data-testid="price"]').text()) ||
        normalizePrice($(".price").first().text());
      return {
        type: "flight",
        source: source,
        title,
        currentPrice: price,
        rawHtml: !price ? $.html().slice(0, 5000) : null,
      };
    }

    const title = $("h1").first().text().trim() || $("title").text().trim() || "Item";
    const price =
      normalizePrice($("[class*='price']").first().text()) ||
      normalizePrice($(".price").first().text());
    return {
      type: "product",
      source: "Unknown",
      title,
      currentPrice: price,
      rawHtml: $.html().slice(0, 3000),
    };
  } catch (err) {
    return {
      error: err.message || "Scrape failed",
      type: source === "Hotel" ? "hotel" : source === "Flight" ? "flight" : "product",
      source: source,
      title: null,
      currentPrice: null,
    };
  }
}

export function parsePastedText(text) {
  if (!text || typeof text !== "string") return null;
  const lines = text.trim().split(/\n/).filter(Boolean);
  let title = "";
  let price = null;
  for (const line of lines) {
    const p = normalizePrice(line);
    if (p && p > 0) price = p;
    else if (line.length > 2 && line.length < 200) title = title ? `${title} ${line}` : line;
  }
  if (!title) title = lines[0]?.slice(0, 200) || "Unknown";
  return { title, currentPrice: price, type: "product", source: "Pasted" };
}
