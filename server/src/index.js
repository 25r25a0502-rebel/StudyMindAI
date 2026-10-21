import { createApp } from './app.js';
import { config } from './config/index.js';
const app = createApp();
app.listen(config.port, () => console.log(
  `StudyMind API on :${config.port} | llm=${config.llmProvider}/${config.llmModel} | embedDim=${config.embeddingDim} | keys: groq=${!!process.env.GROQ_API_KEY} gemini=${!!process.env.GEMINI_API_KEY} openai=${!!process.env.OPENAI_API_KEY}`
));
