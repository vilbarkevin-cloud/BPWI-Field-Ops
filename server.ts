import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import fs from "fs";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));

  // API route for Gemini Auto-Classification
  app.post("/api/classify-incident", async (req, res) => {
    try {
      const { imageBase64, summary } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "Gemini API key is missing." });
      }

      const ai = new GoogleGenAI({ apiKey });

      const prompt = `You are a maintenance incident auto-classifier for a water utility.
Please analyze the provided image and/or summary of the issue:
Summary: ${summary || "No summary provided"}

Classify the incident based strictly on the following parameters:
- type: "leak" | "no_water" | "quality" | "pressure" | "equipment" | "other"
- severity: "critical" | "high" | "medium" | "low"

Return ONLY a JSON response in this exact format, with no markdown formatting or extra text:
{"type": "leak", "severity": "medium", "suggestedAction": "brief suggestion"}
`;

      let response;
      if (imageBase64) {
        // base64 contains the data url like data:image/jpeg;base64,...
        const match = imageBase64.match(/^data:(image\/[a-z]+);base64,(.+)$/);
        if (match) {
          const mimeType = match[1];
          const b64Data = match[2];
          response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [
              prompt,
              {
                inlineData: {
                  data: b64Data,
                  mimeType,
                },
              },
            ],
          });
        }
      } 
      
      if (!response) {
        response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
        });
      }

      const text = response.text || "{}";
      const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
      const result = JSON.parse(cleaned);

      res.json(result);
    } catch (err) {
      console.error("Gemini classification error:", err);
      res.status(500).json({ error: "Failed to classify incident" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
