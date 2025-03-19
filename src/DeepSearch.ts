import { genkit, z } from "genkit";
import { openAI, gpt4oMini } from "genkitx-openai";
import type { Browser, BrowserContext, Page } from 'playwright';
import { chromium } from 'playwright';
import { getJson } from 'serpapi';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * DeepSearch - A TypeScript class for deep research using GenKit, Playwright, and SerpAPI.
 * Similar to Grok3 and Gemini 2.0's deep research capabilities.
 */
export class DeepSearch {
  private ai;
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private searchState: {
    status: 'idle' | 'searching' | 'analyzing' | 'thinking' | 'reporting';
    currentTopic: string;
    searchResults: any[];
    webPageContents: Map<string, string>;
    thoughts: string[];
    finalReport: string;
    currentStep: string;
    stepDetails: string[];
  };
  private apiKey: string;

  /**
   * Constructor for DeepSearch
   * @param apiKey Optional SerpAPI API key (defaults to env variable)
   */
  constructor(apiKey?: string) {
    // Initialize GenKit with OpenAI plugin and GPT-4o-mini model
    this.ai = genkit({
      plugins: [openAI({ apiKey: process.env.OPENAI_API_KEY })],
      model: gpt4oMini,
    });

    // Store API key for SerpAPI (use environment variable as fallback)
    this.apiKey = apiKey || process.env.SERPAPI_KEY || '';
    
    if (!this.apiKey) {
      throw new Error('SerpAPI key not provided. Set SERPAPI_KEY in .env file or pass to constructor.');
    }

    // Initialize search state
    this.searchState = {
      status: 'idle',
      currentTopic: '',
      searchResults: [],
      webPageContents: new Map(),
      thoughts: [],
      finalReport: '',
      currentStep: '',
      stepDetails: [],
    };
  }

  /**
   * Initialize the browser for web scraping
   * Using a different approach with multiple isolation
   */
  private async initBrowser(): Promise<Browser> {
    // Always create a fresh browser instance to avoid memory issues
    try {
      if (this.browser) {
        await this.browser.close().catch(() => {});
        this.browser = null;
      }
      
      this.browser = await chromium.launch({ 
        headless: true,
        args: [
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--disable-setuid-sandbox',
          '--no-sandbox',
          '--disable-extensions',
          '--disable-web-security'
        ]
      });
      
      return this.browser;
    } catch (error) {
      console.error("Browser initialization error:", error);
      throw new Error("Failed to initialize browser");
    }
  }

  /**
   * Update the search state and trigger UI updates
   * @param status Current status of the search
   * @param step Current step description
   * @param detail Detail about the current step
   */
  private updateState(status: 'idle' | 'searching' | 'analyzing' | 'thinking' | 'reporting', step: string, detail?: string): void {
    this.searchState.status = status;
    this.searchState.currentStep = step;
    
    if (detail) {
      this.searchState.stepDetails.push(detail);
      console.log(`[${status.toUpperCase()}] ${step}: ${detail}`);
    } else {
      console.log(`[${status.toUpperCase()}] ${step}`);
    }
  }

  /**
   * Search the web using SerpAPI
   * @param query Search query
   * @returns Search results
   */
  private async searchWeb(query: string): Promise<any[]> {
    this.updateState('searching', 'Web Search', `Searching for: ${query}`);
    
    try {
      const response = await getJson({
        api_key: this.apiKey,
        engine: 'google',
        q: query,
        num: 10,
      });
      
      // Extract organic results
      const results = response.organic_results || [];
      this.updateState('searching', 'Web Search', `Found ${results.length} results for: ${query}`);
      
      return results;
    } catch (error) {
      this.updateState('searching', 'Web Search', `Error searching: ${(error as Error).message}`);
      return [];
    }
  }

  /**
   * Extract content from a webpage using Playwright
   * @param url URL to extract content from
   * @returns Extracted text content
   */
  private async extractWebContent(url: string): Promise<string> {
    this.updateState('searching', 'Content Extraction', `Extracting content from: ${url}`);
    
    let browser: Browser | null = null;
    let context: BrowserContext | null = null;
    let page: Page | null = null;
    
    try {
      // Create a new browser instance for each extraction to avoid memory issues
      browser = await this.initBrowser();
      context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        viewport: { width: 1280, height: 800 }
      });
      
      // Enable JS console to debug issues
      context.on('console', message => {
        if (message.type() === 'error') {
          console.log(`Page Console Error: ${message.text()}`);
        }
      });
      
      page = await context.newPage();
      
      // Set short timeouts to avoid hanging
      page.setDefaultTimeout(10000);
      page.setDefaultNavigationTimeout(15000);
      
      // Use Promise.race to implement a hard timeout
      const timeoutPromise = new Promise<string>(resolve => {
        setTimeout(() => {
          console.log(`Hard timeout for URL: ${url}`);
          resolve('');
        }, 20000);
      });
      
      const extractionPromise = (async () => {
        try {
          // Navigate with basic options
          await page.goto(url, { 
            waitUntil: 'domcontentloaded',
            timeout: 15000 
          });
          
          // Use a simpler extraction method
          const content = await page.evaluate(() => {
            return document.body.innerText || '';
          }).catch(() => '');
          
          return content.replace(/\s+/g, ' ').trim().substring(0, 15000);
        } catch (error) {
          console.error(`Extraction error for ${url}:`, error);
          return '';
        }
      })();
      
      // Race between extraction and timeout
      const content = await Promise.race([extractionPromise, timeoutPromise]);
      
      if (content) {
        this.updateState('searching', 'Content Extraction', `Extracted ${content.length} characters from: ${url}`);
      } else {
        this.updateState('searching', 'Content Extraction', `No content extracted from: ${url}`);
      }
      
      return content;
    } catch (error) {
      this.updateState('searching', 'Content Extraction', `Error extracting content: ${(error as Error).message}`);
      return '';
    } finally {
      // Clean up resources regardless of success or failure
      try {
        if (page) await page.close().catch(() => {});
        if (context) await context.close().catch(() => {});
        if (browser) await browser.close().catch(() => {});
      } catch (e) {
        console.error("Error closing browser resources:", e);
      }
    }
  }

  /**
   * Use search result snippet instead of full page content
   * @param result Search result object from SerpAPI
   * @returns Formatted snippet text
   */
  private getSnippetFromResult(result: any): string {
    const snippet = result.snippet || '';
    const title = result.title || '';
    
    // Use both title and snippet from search results
    return `${title}\n${snippet}`.trim();
  }

  /**
   * Generate a thought or analysis using AI
   * @param prompt Prompt for the AI
   * @returns AI-generated thought
   */
  private async generateThought(prompt: string): Promise<string> {
    this.updateState('thinking', 'Critical Thinking', 'Analyzing information...');
    
    try {
      const { text } = await this.ai.generate(prompt);
      
      this.searchState.thoughts.push(text);
      this.updateState('thinking', 'Critical Thinking', 'Analysis complete');
      
      return text;
    } catch (error) {
      this.updateState('thinking', 'Critical Thinking', `Error generating thought: ${(error as Error).message}`);
      return '';
    }
  }

  /**
   * Generate a detailed research report based on collected information
   * @param topic Research topic
   * @param collectedInfo Collected information
   * @returns Research report
   */
  private async generateReport(topic: string, collectedInfo: string): Promise<string> {
    this.updateState('reporting', 'Report Generation', 'Generating comprehensive research report...');
    
    const reportPrompt = `
      You are a professional research analyst. Based on the following information, 
      create a comprehensive, accurate, and detailed research report on the topic: "${topic}".
      
      Structure your report with:
      1. Executive Summary
      2. Key Findings
      3. Detailed Analysis
      4. Supporting Evidence
      5. Conclusions and Recommendations
      
      The report should be well-structured, factual, and professionally written.
      
      Here is the collected information:
      ${collectedInfo}
    `;
    
    try {
      const { text } = await this.ai.generate(reportPrompt);
      
      this.searchState.finalReport = text;
      this.updateState('reporting', 'Report Generation', 'Research report complete');
      
      return text;
    } catch (error) {
      this.updateState('reporting', 'Report Generation', `Error generating report: ${(error as Error).message}`);
      return '';
    }
  }

  /**
   * Conduct a deep search on a topic
   * @param topic Research topic
   * @returns Research report
   */
  public async research(topic: string): Promise<string> {
    try {
      // Reset state
      this.searchState = {
        status: 'idle',
        currentTopic: topic,
        searchResults: [],
        webPageContents: new Map(),
        thoughts: [],
        finalReport: '',
        currentStep: '',
        stepDetails: [],
      };
      
      this.updateState('searching', 'Research Initialization', `Starting deep research on: ${topic}`);
      
      // Phase 1: Initial search
      this.updateState('searching', 'Phase 1', 'Performing initial web search');
      const searchResults = await this.searchWeb(topic);
      this.searchState.searchResults = searchResults;
      
      if (searchResults.length === 0) {
        this.updateState('idle', 'Research Error', 'No search results found. Try a different topic.');
        return "No search results found. Please try a different topic or search term.";
      }
      
      // Phase 2: Try to extract content, but fallback to snippets if needed
      this.updateState('searching', 'Phase 2', 'Processing search results');
      
      // First, collect the snippets from search results as a fallback
      const searchSnippets = searchResults.slice(0, 8).map((result, index) => {
        this.updateState('searching', 'Phase 2', `Collecting snippet ${index + 1} of 8`);
        const snippet = this.getSnippetFromResult(result);
        return { 
          link: result.link, 
          content: snippet,
          source: 'snippet'
        };
      });
      
      // Then try to extract first page content with a very strict timeout
      let extractedContent = null;
      if (searchResults.length > 0) {
        this.updateState('searching', 'Phase 2', 'Attempting extraction from first result');
        try {
          const firstResult = searchResults[0];
          const content = await this.extractWebContent(firstResult.link);
          if (content && content.length > 200) {
            extractedContent = { 
              link: firstResult.link, 
              content,
              source: 'extraction'
            };
            this.searchState.webPageContents.set(firstResult.link, content);
          }
        } catch (error) {
          console.error("First page extraction failed:", error);
        }
      }
      
      // Combine snippets with any successfully extracted content
      const researchMaterials = extractedContent 
        ? [extractedContent, ...searchSnippets]
        : searchSnippets;
      
      // Phase 3: Critical thinking - Analysis of initial findings
      this.updateState('analyzing', 'Phase 3', 'Analyzing search results');
      const sourcesDescription = extractedContent 
        ? "Detailed content from one source and snippets from search results"
        : "Snippets from search results";
      
      const initialAnalysisPrompt = `
        Analyze the following information about "${topic}":
        
        Note: This information consists of ${sourcesDescription}.
        
        ${researchMaterials
          .map(item => `Source: ${item.link} (${item.source})\nContent: ${item.content}\n`)
          .join('\n\n')}
        
        Provide a critical analysis of this information. Identify key points, contradictions, 
        and areas that need further research. Be objective and analytical.
      `;
      
      const initialAnalysis = await this.generateThought(initialAnalysisPrompt);
      
      // Phase 4: Follow-up research based on gaps identified
      this.updateState('thinking', 'Phase 4', 'Generating follow-up search queries');
      const followUpQueriesPrompt = `
        Based on the following analysis about "${topic}":
        
        ${initialAnalysis}
        
        Generate 3 specific follow-up search queries to address gaps in the information
        or to explore important aspects that were not covered adequately.
        Return ONLY the queries as a numbered list without any additional text.
      `;
      
      const { text: followUpQueriesText } = await this.ai.generate(followUpQueriesPrompt);
      
      const followUpQueries = followUpQueriesText
        .split('\n')
        .filter(line => line.trim().match(/^\d+\.\s/))
        .map(line => line.replace(/^\d+\.\s/, '').trim());
      
      this.updateState('searching', 'Phase 4', `Generated ${followUpQueries.length} follow-up queries`);
      
      // Phase 5: Execute follow-up searches (using snippets to avoid hanging)
      this.updateState('searching', 'Phase 5', 'Performing follow-up research');
      const followUpResultsPromises = followUpQueries.map(async (query, qIndex) => {
        this.updateState('searching', 'Phase 5', `Researching follow-up query ${qIndex + 1}: ${query}`);
        const results = await this.searchWeb(query);
        
        // Use snippets from search results
        const snippets = results.slice(0, 4).map((result, rIndex) => {
          this.updateState('searching', 'Phase 5', `Processing result ${rIndex + 1} for query: ${query}`);
          const snippet = this.getSnippetFromResult(result);
          return { 
            query, 
            link: result.link, 
            content: snippet,
            source: 'snippet'
          };
        });
        
        return snippets;
      });
      
      const followUpResults = await Promise.all(followUpResultsPromises);
      const flattenedFollowUpResults = followUpResults.flat();
      
      this.updateState('searching', 'Phase 5', `Obtained ${flattenedFollowUpResults.length} follow-up results`);
      
      // Phase 6: Deep analysis - Synthesize all findings
      this.updateState('analyzing', 'Phase 6', 'Synthesizing all findings');
      const deepAnalysisPrompt = `
        Synthesize all the following information about "${topic}":
        
        Initial findings:
        ${initialAnalysis}
        
        Follow-up research:
        ${flattenedFollowUpResults
          .map(item => `Query: ${item.query}\nSource: ${item.link} (${item.source})\nContent: ${item.content}\n`)
          .join('\n\n')}
        
        Provide a comprehensive analysis that synthesizes all the information gathered.
        Identify key insights, patterns, and conclusions. Be objective, critical, and thorough.
      `;
      
      const deepAnalysis = await this.generateThought(deepAnalysisPrompt);
      
      // Phase 7: Generate comprehensive report
      this.updateState('reporting', 'Phase 7', 'Generating final research report');
      const collectedInfo = `
        Initial Analysis:
        ${initialAnalysis}
        
        Deep Analysis:
        ${deepAnalysis}
        
        Sources:
        ${[...researchMaterials, ...flattenedFollowUpResults]
          .map(item => `- ${item.link} (${item.source})`)
          .join('\n')}
      `;
      
      const finalReport = await this.generateReport(topic, collectedInfo);
      
      // Clean up browser resources
      this.updateState('idle', 'Cleanup', 'Closing browser and releasing resources');
      if (this.browser) {
        await this.browser.close().catch(() => {});
        this.browser = null;
        this.context = null;
      }
      
      this.updateState('idle', 'Research Complete', `Completed deep research on: ${topic}`);
      
      return finalReport;
    } catch (error) {
      console.error('Research error:', error);
      this.updateState('idle', 'Research Error', `Error during research: ${(error as Error).message}`);
      
      // Clean up browser resources on error
      if (this.browser) {
        await this.browser.close().catch(() => {});
        this.browser = null;
        this.context = null;
      }
      
      return `Error conducting research: ${(error as Error).message}`;
    }
  }

  /**
   * Get the current state of the search process
   * @returns Current search state
   */
  public getState(): any {
    return { ...this.searchState };
  }
} 