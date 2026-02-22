import "dotenv/config";
import express from "express";
import cors from "cors";
import { priceRoutes } from "./routes/price.js";
import morgan from "morgan";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use(morgan("dev"));

app.get("/health", (_, res) => res.json({ ok: true }));
app.use("/api", priceRoutes);

app.listen(PORT, () => console.log(`Backend running at http://localhost:${PORT}`));
