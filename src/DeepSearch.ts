import { genkit } from "genkit";
import { openAI, gpt4oMini } from "genkitx-openai";
import dotenv from 'dotenv';
import type { ResearchReport } from './types';
import { ResearchStateManager } from './state/ResearchState';
import { ReasoningEngine } from './reasoning/ReasoningEngine';
import { BrowserManager } from './browser/BrowserManager';
import { ToolRegistry } from './tools/ToolDefinitions';
import { ReportGenerator } from './reporting/ReportGenerator';

// Load environment variables
dotenv.config();

/**
 * DeepSearch - A TypeScript class for deep research using advanced reasoning.
 * Implements ReAct (Reasoning + Acting) and Tree of Thoughts for more effective reasoning.
 */
export class DeepSearch {
  private ai;
  private stateManager!: ResearchStateManager; // Using definite assignment assertion
  private browserManager: BrowserManager;
  private reasoningEngine!: ReasoningEngine; // Using definite assignment assertion
  private toolRegistry: ToolRegistry;
  private reportGenerator: ReportGenerator;
  private maxReasoningCycles: number = 20;
  private contextWindow: string[] = [];
  private maxContextSize: number = 10;

  constructor() {
    // Ensure API keys are available
    if (!process.env.SERPAPI_KEY) {
      throw new Error('SerpAPI key not provided. Set SERPAPI_KEY in .env file.');
    }
    
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not provided. Set OPENAI_API_KEY in .env file.');
    }
    
    // Initialize GenKit with OpenAI plugin
    this.ai = genkit({
      plugins: [openAI({ apiKey: process.env.OPENAI_API_KEY })],
      model: gpt4oMini,
    });
    
    // Initialize managers and components
    this.browserManager = new BrowserManager();
    this.toolRegistry = new ToolRegistry(this.ai, this.browserManager, process.env.SERPAPI_KEY);
    this.reportGenerator = new ReportGenerator(this.ai);
  }

  /**
   * Conduct autonomous research on a topic with advanced reasoning
   */
  public async research(topic: string): Promise<string> {
    try {
      console.log("\n🔍 Starting deep reasoning research on: " + topic);
      
      // Initialize state manager for this research session
      this.stateManager = new ResearchStateManager(topic);
      
      // Initialize reasoning engine with tools
      this.reasoningEngine = new ReasoningEngine(
        this.ai, 
        this.stateManager, 
        this.toolRegistry.getTools()
      );
      
      this.stateManager.updateStatus('thinking', 'Research Planning', 'Initiating deep research process');
      this.addToContext(`Starting research on: ${topic}`);
      
      // Track research state
      let currentContext = `Research topic: ${topic}`;
      let reasoningCycles = 0;
      
      // Main research loop with ReAct cycles
      while (reasoningCycles < this.maxReasoningCycles) {
        reasoningCycles++;
        console.log(`\n[Cycle ${reasoningCycles}/${this.maxReasoningCycles}] Executing reasoning cycle...`);
        
        // Execute a ReAct cycle (Reasoning + Acting)
        const { result, score, nextAction } = await this.reasoningEngine.executeReActCycle(currentContext);
        
        // Update context with result summary
        const resultSummary = typeof result === 'string' ? 
          result.substring(0, 300) + (result.length > 300 ? '...' : '') : 
          JSON.stringify(result).substring(0, 300) + '...';
        
        this.addToContext(`Cycle ${reasoningCycles} - Explored path scored ${score.toFixed(2)}`);
        currentContext = this.getContext();
        
        // Check if we should continue or take a different action
        if (nextAction === 'backtrack') {
          this.stateManager.updateStatus('thinking', 'Backtracking', 'Current path not promising, backtracking');
          // Logic to backtrack to a previous node would go here
        } else if (nextAction === 'explore_new') {
          this.stateManager.updateStatus('thinking', 'Exploring New Path', 'Generating alternative reasoning paths');
        }
        
        // Check if we have enough information
        if (score > 0.8 && reasoningCycles > 5) {
          this.stateManager.updateStatus('thinking', 'Evaluating Research', 'Checking if enough information has been gathered');
          
          const shouldContinue = await this.shouldContinueResearch(currentContext);
          if (!shouldContinue) {
            console.log(`\n✅ Sufficient information gathered after ${reasoningCycles} cycles.`);
            break;
          }
        }
      }
      
      // Generate the final report
      this.stateManager.updateStatus('reporting', 'Generating Report', 'Creating comprehensive research report');
      
      // Gather the findings from state
      const state = this.stateManager.getState();
      const findings = Array.from(state.collectedInfo.entries())
        .map(([key, value]) => `## ${key}\n${typeof value === 'string' ? value : JSON.stringify(value, null, 2)}`)
        .join('\n\n');
      
      // Generate report
      const reportData = await this.reportGenerator.generateReport(
        topic,
        findings,
        state.thoughts,
        this.reasoningEngine.getToolUsageStats()
      );
      
      // Save report to file
      const filepath = await this.reportGenerator.saveReport(reportData);
      
      // Extract readable report text
      const reportText = this.formatReportForOutput(reportData);
      this.stateManager.setFinalReport(reportText);
      
      // Clean up resources
      await this.browserManager.closeBrowser();
      
      console.log("\n✅ Research completed successfully.");
      return reportText;
    } catch (error) {
      console.error("Error during research:", error);
      
      // Ensure browser is closed even if research fails
      await this.browserManager.closeBrowser();
      
      throw error;
    }
  }

  /**
   * Determine if research should continue or if enough information has been gathered
   */
  private async shouldContinueResearch(context: string): Promise<boolean> {
    const state = this.stateManager.getState();
    
    const prompt = `
      You are researching the topic: "${state.currentTopic}"
      
      Based on the information gathered so far:
      ${context}
      
      Evaluate whether enough information has been gathered to generate a comprehensive research report.
      Consider:
      1. Have the main aspects of the topic been covered?
      2. Is there sufficient depth in the information?
      3. Have multiple perspectives been explored?
      4. Is there enough evidence and factual data?
      
      Respond with YES if more research is needed, or NO if sufficient information has been gathered.
    `;
    
    const { text } = await this.ai.generate(prompt);
    
    // Check if the response indicates we should continue
    return text.toUpperCase().includes('YES');
  }

  /**
   * Format the research report for output
   */
  private formatReportForOutput(report: ResearchReport): string {
    let output = `# ${report.topic}\n\n`;
    
    for (const section of report.sections) {
      output += `## ${section.title}\n\n`;
      
      if (section.content) {
        output += `${section.content}\n\n`;
      }
      
      if (section.subsections) {
        for (const subsection of section.subsections) {
          output += `### ${subsection.title}\n\n`;
          output += `${subsection.content}\n\n`;
        }
      }
    }
    
    return output;
  }

  /**
   * Add an item to the context window
   */
  private addToContext(item: string): void {
    this.contextWindow.push(item);
    
    // Keep context window size limited
    if (this.contextWindow.length > this.maxContextSize) {
      this.contextWindow.shift();
    }
  }

  /**
   * Get the current context window as a string
   */
  private getContext(): string {
    return this.contextWindow.join('\n\n');
  }

  /**
   * Get the current state of the research process
   */
  public getState(): any {
    return this.stateManager ? this.stateManager.getState() : { status: 'idle' };
  }
} 