import 'dotenv/config';

async function listModels() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  console.log("Using API Key:", apiKey);
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  if (!response.ok) {
    console.error("Failed to fetch models:", response.status, response.statusText);
    const text = await response.text();
    console.error(text);
    return;
  }
  const data = await response.json();
  console.log("Models:", data.models.map((m: any) => m.name));
}

listModels();
