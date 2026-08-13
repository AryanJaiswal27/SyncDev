import 'dotenv/config';
import { HNSWLib } from "@langchain/community/vectorstores/hnswlib";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { Document } from "@langchain/core/documents";
import * as path from "path";
import * as fs from "fs";

export class CodebaseIndexer {
  private vectorStore: HNSWLib | null = null;
  private indexPath = path.join(process.env.PROJECT_ROOT || "g:\\SyncDev", ".prompt", "vector_index");

  async initStore() {
    const embeddings = new GoogleGenerativeAIEmbeddings({ 
      model: "text-embedding-004",
      apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
    });
    
    // In production, we check if the index exists on disk.
    if (fs.existsSync(this.indexPath)) {
      this.vectorStore = await HNSWLib.load(this.indexPath, embeddings);
      console.log("Loaded existing local vector index.");
    } else {
      console.log("No vector index found. Please trigger indexing.");
    }
  }

  async buildIndex(files: { path: string, content: string }[]) {
    console.log(`Indexing ${files.length} files...`);
    const embeddings = new GoogleGenerativeAIEmbeddings({ 
      model: "text-embedding-004",
      apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
    });
    
    // Chunking logic would go here. For now, 1 file = 1 doc
    const docs = files.map(f => new Document({ 
      pageContent: f.content, 
      metadata: { source: f.path } 
    }));
    
    this.vectorStore = await HNSWLib.fromDocuments(docs, embeddings);
    
    const rootDir = process.env.PROJECT_ROOT || "g:\\SyncDev";
    const promptDir = path.join(rootDir, ".prompt");
    if (!fs.existsSync(promptDir)) fs.mkdirSync(promptDir, { recursive: true });
    
    await this.vectorStore.save(this.indexPath);
    console.log(`Successfully saved index to ${this.indexPath}`);
  }

  async search(query: string): Promise<string> {
    if (!this.vectorStore) {
      await this.initStore();
      if (!this.vectorStore) return "Index not built yet.";
    }
    
    const results = await this.vectorStore.similaritySearch(query, 3);
    return results.map(r => `--- ${r.metadata.source} ---\n${r.pageContent}\n`).join("\n");
  }
}

export const indexer = new CodebaseIndexer();
