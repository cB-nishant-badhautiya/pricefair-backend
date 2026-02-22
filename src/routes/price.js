import { Router } from "express";
import { runPriceCheck, getRecentChecks, getRecentChecksPaginated, getCheckById } from "../services/priceAnalysis.js";

export const priceRoutes = Router();

priceRoutes.post("/check", async (req, res) => {
  try {
    const { url, pastedText, type } = req.body || {};
    const result = await runPriceCheck({ url, pastedText, type });
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message || "Analysis failed" });
  }
});

priceRoutes.get("/history", async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
    const type = req.query.type || undefined;
    const recommendation = req.query.recommendation || undefined;
    if (page >= 1 && limit >= 1) {
      const result = await getRecentChecksPaginated({ page, limit, type, recommendation });
      return res.json(result);
    }
    const list = await getRecentChecks(limit);
    res.json(list);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

priceRoutes.get("/check/:id", async (req, res) => {
  try {
    const record = await getCheckById(req.params.id);
    if (!record) return res.status(404).json({ error: "Not found" });
    res.json(record);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});
