import { genkit, z } from "genkit";
import type { Genkit, ToolAction } from "genkit";
import type { Thought, ToolRequest } from "../types";
import { ResearchStateManager } from "../state/ResearchState";
import type { ZodTypeAny } from "zod";

// Define extended ToolAction type with description
export interface EnhancedToolAction<TInput extends ZodTypeAny, TOutput extends ZodTypeAny> {
  name: string;
  description: string;
  inputSchema: TInput;
  outputSchema: TOutput;
  handle: (input: z.infer<TInput>) => Promise<z.infer<TOutput>>;
  __action: ToolAction<TInput, TOutput>;
}

/**
 * ReasoningEngine - Implements ReAct (Reasoning+Acting) and Tree of Thoughts
 * for advanced multi-hop reasoning during research.
 */
export class ReasoningEngine {
  private ai: Genkit;
  private stateManager: ResearchStateManager;
  private tools: EnhancedToolAction<any, any>[] = [];
  private toolUsageCount: Map<string, number> = new Map();

  constructor(ai: Genkit, stateManager: ResearchStateManager, tools: EnhancedToolAction<any, any>[]) {
    this.ai = ai;
    this.stateManager = stateManager;
    this.tools = tools;
  }

  /**
   * Generate multiple reasoning paths to explore
   */
  public async generateReasoningPaths(context: string, numPaths: number = 3): Promise<Thought[]> {
    const state = this.stateManager.getState();
    this.stateManager.updateStatus('thinking', 'Reasoning Paths', `Generating ${numPaths} potential reasoning paths`);
    
    const prompt = `
      Given the research topic "${state.currentTopic}" and the following context:
      ${context}
      
      Generate ${numPaths} different reasoning paths to explore next. For each path:
      1. Provide a specific next step in the research process
      2. Explain the rationale for this path
      3. Estimate how promising this path is (low/medium/high)
      
      Ensure the paths are diverse and explore different aspects or approaches.
    `;
    
    const { output } = await this.ai.generate({
      prompt,
      output: {
        schema: z.array(z.object({
          path: z.string(),
          rationale: z.string(),
          promiseLevel: z.enum(['low', 'medium', 'high'])
        }))
      }
    });
    
    if (!output) {
      throw new Error('Failed to generate reasoning paths');
    }
    
    // Convert to thoughts and add to state
    const thoughts: Thought[] = [];
    
    for (const path of output) {
      const confidence = path.promiseLevel === 'high' ? 0.8 : 
                        path.promiseLevel === 'medium' ? 0.5 : 0.3;
      
      const thought = this.stateManager.addThought(
        'thought',
        `Path: ${path.path}\nRationale: ${path.rationale}`,
        confidence
      );
      
      thoughts.push(thought);
    }
    
    return thoughts;
  }

  /**
   * Select the best reasoning path to explore next
   */
  public selectBestPath(paths: Thought[]): Thought | null {
    if (paths.length === 0) return null;
    
    // Sort by confidence (highest first)
    const sortedPaths = [...paths].sort((a, b) => 
      (b.confidence || 0.5) - (a.confidence || 0.5)
    );
    
    return sortedPaths[0] || null;
  }

  /**
   * Evaluate the results of a reasoning step
   */
  public async evaluateResults(results: any, pathThought: Thought): Promise<number> {
    const state = this.stateManager.getState();
    
    const prompt = `
      Evaluate how useful the following results are for researching "${state.currentTopic}":
      
      Original reasoning path: ${pathThought.content}
      
      Results obtained:
      ${JSON.stringify(results, null, 2)}
      
      Rate the usefulness on a scale from 0.0 to 1.0 where:
      - 0.0: Completely irrelevant or useless
      - 0.3: Somewhat relevant but minimal value
      - 0.5: Moderately useful
      - 0.7: Very useful, provides good insights
      - 1.0: Exceptionally valuable, directly answers research needs
      
      Provide just the numerical score.
    `;
    
    const { text } = await this.ai.generate(prompt);
    
    // Extract number from response
    const match = text.match(/([0-9]*\.?[0-9]+)/);
    const score = match ? parseFloat(match[0]) : 0.5;
    
    // Clamp between 0 and 1
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Decide whether to explore a new path or backtrack
   */
  public async decideNextAction(currentScore: number): Promise<'continue' | 'backtrack' | 'explore_new'> {
    const state = this.stateManager.getState();
    
    // If high confidence, continue on current path
    if (currentScore >= 0.7) {
      return 'continue';
    }
    
    // If we have a reasonably promising path but not great, explore alternatives occasionally
    if (currentScore >= 0.4) {
      // 70% continue, 30% explore new
      return Math.random() < 0.7 ? 'continue' : 'explore_new';
    }
    
    // For low scores, either backtrack or explore new
    return Math.random() < 0.5 ? 'backtrack' : 'explore_new';
  }

  /**
   * Select the appropriate tool based on reasoning
   */
  public async selectTool(context: string): Promise<ToolRequest | null> {
    const state = this.stateManager.getState();
    
    // Extract tool names and descriptions for the prompt
    const toolDescriptions = this.tools.map(tool => {
      return `- ${tool.name}: ${tool.description}`;
    }).join('\n');
    
    const prompt = `
      Given the research task on "${state.currentTopic}" and the current context:
      ${context}
      
      Available tools:
      ${toolDescriptions}
      
      Select the most appropriate tool to use next and provide its input parameters.
      Think step by step about which tool will provide the most valuable information at this stage of research.
    `;
    
    try {
      // Define the schema directly with genkit z schema
      const toolSelectionSchema = z.object({
        toolName: z.string().describe('The name of the selected tool'),
        reason: z.string().describe('The reason for selecting this tool'),
        parameters: z.record(z.any()).describe('The parameters to pass to the tool')
      });

      const { output } = await this.ai.generate({
        prompt,
        output: {
          schema: toolSelectionSchema
        }
      });
      
      if (!output) {
        return null;
      }
      
      // Update tool usage count
      const currentCount = this.toolUsageCount.get(output.toolName) || 0;
      this.toolUsageCount.set(output.toolName, currentCount + 1);
      
      // Create tool request
      return {
        name: output.toolName,
        input: output.parameters
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Tool selection error:', errorMessage);
      
      // Fallback to a simple search tool if there's an error
      console.log('Falling back to default search tool due to selection error');
      
      // Update tool usage count for fallback
      const fallbackToolName = 'searchWeb';
      const currentCount = this.toolUsageCount.get(fallbackToolName) || 0;
      this.toolUsageCount.set(fallbackToolName, currentCount + 1);
      
      // Return a fallback search request with the topic as query
      return {
        name: fallbackToolName,
        input: {
          query: state.currentTopic
        }
      };
    }
  }

  /**
   * Execute a ReAct (Reasoning + Acting) cycle with natural thinking
   */
  public async executeReActCycle(context: string): Promise<any> {
    try {
      // Track the research state 
      const state = this.stateManager.getState();
      let researchThoughts = '';
      let searchResults: any[] = [];
      let score = 0.5;
      let nextAction = 'continue';
      
      // Use a more natural approach to reasoning - let the model think openly
      console.log('\nThinking about this research question...');
      
      // First, let the model freely explore the research topic in an open-ended way
      const openThinkingPrompt = `You're researching: "${state.currentTopic}"

Context so far: 
${context}

Think through this research question. Explore different aspects, consider what information you need, what might be interesting to explore, and how you'll approach finding answers.

Think step by step, exploring different facets of the topic. Don't structure your thoughts in any particular way - just think naturally as you would when researching something interesting.`;
      
      const { text: openThinking } = await this.ai.generate(openThinkingPrompt);
      
      // Display and capture the thinking process
      console.log(openThinking);
      researchThoughts += openThinking;
      
      // Allow the model to decide what search to perform next based on its thinking
      console.log('\nDeciding what to search for...');
      
      const searchDecisionPrompt = `Based on your thinking about "${state.currentTopic}", what specific search query would be most helpful to perform next? 

Your previous thoughts:
${researchThoughts}

Decide on a specific search query that would help answer an important aspect of this research question.
First, explain your reasoning for why this particular search would be valuable.
Then end with the exact search query on its own line, formatted as: "SEARCH QUERY: your query here"`;
      
      const { text: searchDecision } = await this.ai.generate(searchDecisionPrompt);
      console.log(searchDecision);
      
      // Extract the search query using a simple approach
      let finalQuery = state.currentTopic; // Default to the original topic
      
      // Check for the formatted query first
      const queryLineMatch = searchDecision.match(/SEARCH QUERY:\s*(.+)$/m);
      if (queryLineMatch && queryLineMatch[1]) {
        finalQuery = queryLineMatch[1].trim();
      } else {
        // Fall back to extracting the last short line
        const lines = searchDecision.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        const shortLines = lines.filter(line => 
          line.length >= 5 && 
          line.length <= 100 && 
          !line.toLowerCase().includes('query') &&
          !line.toLowerCase().includes('search') &&
          !line.toLowerCase().includes('because') &&
          !line.toLowerCase().includes('therefore') &&
          !line.toLowerCase().includes('however') 
        );
        
        if (shortLines.length > 0) {
          // Take the last short line
          finalQuery = shortLines[shortLines.length - 1] || state.currentTopic;
          
          // If it ends with a period, remove it
          finalQuery = finalQuery.replace(/\.$/, '');
          
          // Remove quotes if they wrap the entire string
          finalQuery = finalQuery.replace(/^["'`](.+)["'`]$/, '$1');
        }
      }
      
      // Ensure we have a valid non-empty query
      if (!finalQuery || finalQuery.trim() === '') {
        finalQuery = state.currentTopic;
      }
      
      // Execute search with extracted query
      console.log(`\nResearching: "${finalQuery}"`);
      this.stateManager.updateStatus('acting', 'Searching', `Researching "${finalQuery}"`);
      
      // Select the search web tool
      const searchTool = this.tools.find(tool => tool.name === 'searchWeb');
      if (!searchTool) {
        throw new Error('Search tool not available');
      }
      
      // Execute the search
      searchResults = await searchTool.handle({ query: finalQuery });
      
      // Display results
      if (searchResults && Array.isArray(searchResults)) {
        this.displaySearchResults(searchResults);
      } else {
        console.log("No results found or invalid results format");
        searchResults = [];
      }
      
      // Let the model analyze and reflect on the search results
      console.log('\nAnalyzing these results...');
      
      const analysisPrompt = `You searched for "${finalQuery}" related to your research on "${state.currentTopic}" and found these results:

${JSON.stringify(searchResults.slice(0, 3), null, 2)}

Analyze these search results. What interesting information do you find? What patterns do you notice? What's missing? What new questions arise? How do these results impact your understanding of the topic?

Think freely and analyze the information you've found. Connect it to what you already know and consider what to explore next.`;
      
      const { text: analysis } = await this.ai.generate(analysisPrompt);
      console.log(analysis);
      researchThoughts += '\n\n' + analysis;
      
      // Store the results and observation in state
      const observation = this.stateManager.addThought(
        'observation',
        `Results from search "${finalQuery}": ${JSON.stringify(searchResults, null, 2)}`,
        undefined
      );
      
      // Let the model evaluate the usefulness of these results more naturally
      const evaluationPrompt = `How useful were these search results for "${finalQuery}" in answering your research question about "${state.currentTopic}"?

Rate the usefulness on a scale of 0 to 10 and explain your rating.`;
      
      const { text: evaluation } = await this.ai.generate(evaluationPrompt);
      console.log('\n' + evaluation);
      
      // Extract numeric score from evaluation
      const scoreMatch = evaluation.match(/(\d+(\.\d+)?)\s*\/\s*10|(\d+(\.\d+)?)\s*out of\s*10/i);
      if (scoreMatch) {
        const scoreStr = scoreMatch[1] || scoreMatch[3];
        if (scoreStr) {
          score = parseFloat(scoreStr) / 10; // Convert to 0-1 scale
        }
      } else {
        // Fallback using keyword analysis
        const lowerEval = evaluation.toLowerCase();
        if (lowerEval.includes('very useful') || lowerEval.includes('extremely useful')) {
          score = 0.9;
        } else if (lowerEval.includes('useful') || lowerEval.includes('helpful')) {
          score = 0.7;
        } else if (lowerEval.includes('somewhat') || lowerEval.includes('partially')) {
          score = 0.5;
        } else if (lowerEval.includes('not very') || lowerEval.includes('limited')) {
          score = 0.3;
        } else if (lowerEval.includes('not useful') || lowerEval.includes('unhelpful')) {
          score = 0.1;
        }
      }
      
      observation.confidence = score;
      
      // Let the model freely decide what to do next
      console.log('\nDeciding what to explore next...');
      
      const nextStepPrompt = `Based on everything you've learned so far about "${state.currentTopic}", what would you like to explore next? 

Your research process so far:
${researchThoughts}

Consider different directions you could take this research. What aspects haven't been explored yet? What would deepen your understanding the most? What contradictions or gaps exist in what you've found?

Decide on your next research step and explain why this direction is promising.`;
      
      const { text: nextStep } = await this.ai.generate(nextStepPrompt);
      console.log(nextStep);
      
      // Determine next action based on model's reasoning
      if (nextStep.toLowerCase().includes('different') || 
          nextStep.toLowerCase().includes('new direction') || 
          nextStep.toLowerCase().includes('alternative')) {
        nextAction = 'explore_new';
      } else if (nextStep.toLowerCase().includes('previous') || 
                nextStep.toLowerCase().includes('earlier') || 
                nextStep.toLowerCase().includes('back')) {
        nextAction = 'backtrack';
      } else {
        nextAction = 'continue';
      }
      
      // Store insights from this cycle
      if (score > 0.4 && searchResults.length > 0) {
        const insightsPrompt = `Based on your research about "${state.currentTopic}" and specifically the search for "${finalQuery}", extract 3-5 key insights or facts that you've learned.

Provide these insights in a concise bullet-point format, focusing on the most important information.`;
        
        const { text: insights } = await this.ai.generate(insightsPrompt);
        console.log('\nKey insights:');
        console.log(insights);
        
        // Store in state for final report
        const infoKey = `Search: ${finalQuery}`;
        this.stateManager.storeInfo(infoKey, {
          query: finalQuery,
          results: searchResults.slice(0, 3),
          insights: insights,
          score: score
        });
      }
      
      // Return results in the expected format
      return {
        result: searchResults,
        score,
        nextAction
      };
      
    } catch (error: unknown) {
      console.error('Error in research cycle:', error);
      
      // Show the error as part of natural thinking
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`\nI've encountered a problem: ${errorMessage}`);
      console.log('I should try a different approach instead...');
      
      this.stateManager.addThought(
        'observation',
        `Error during reasoning cycle: ${errorMessage}`,
        0.1
      );
      
      return {
        result: { error: errorMessage },
        score: 0.1,
        nextAction: 'explore_new'
      };
    }
  }
  
  /**
   * Generate an expectation for a search query
   */
  private generateExpectation(query: string): string {
    // Simple but effective way to generate expectations
    const queryParts = query.toLowerCase().split(' ');
    
    if (queryParts.includes('how')) {
      return "methods or processes";
    } else if (queryParts.includes('why')) {
      return "reasons or explanations";
    } else if (queryParts.includes('when')) {
      return "timing or dates";
    } else if (queryParts.includes('statistics') || queryParts.includes('data')) {
      return "numbers and statistical information";
    } else if (queryParts.includes('comparison') || queryParts.includes('vs')) {
      return "comparative analyses";
    } else {
      // Generic expectation based on query
      return `key facts and information about ${query}`;
    }
  }
  
  /**
   * Display search results in a more natural, analytical way
   */
  private displaySearchResults(results: any[]): void {
    console.log(`\nFound ${results.length} results\n`);
    
    // Display top results with source annotation
    results.slice(0, 5).forEach((result, index) => {
      console.log(`${result.title || 'Untitled'}`);
      console.log(`${result.url || result.link || 'No URL'} - ${result.source || 'unknown source'}`);
      if (result.snippet) {
        console.log(`"${result.snippet}"`);
      }
      console.log('');
    });
    
    if (results.length > 5) {
      console.log(`View more (${results.length - 5})`);
    }
    console.log('');
  }
  
  /**
   * Analyze search results with natural language insights
   */
  private async analyzeSearchResults(results: any[], query: string): Promise<void> {
    if (results.length === 0) {
      console.log("I didn't find any results for this query. I should try a different approach.");
      return;
    }
    
    // Prepare a prompt for the AI to analyze the search results
    const prompt = `
      I searched for "${query}" and got these results:
      ${JSON.stringify(results.slice(0, 3), null, 2)}
      
      As a researcher, analyze these search results. Consider:
      - What sources appeared (websites, publications)
      - Any patterns in the results
      - What these results suggest about my query
      - What might be missing or biased
      
      Express your analysis in first person, as if you're examining these results and thinking out loud.
      Keep it concise but insightful.
    `;
    
    const { text } = await this.ai.generate(prompt);
    
    console.log('\nBrowsing results');
    const lines = text.split('\n').filter(line => line.trim() !== '');
    for (const line of lines) {
      console.log(line);
    }
  }

  /**
   * Get tool usage statistics
   */
  public getToolUsageStats(): Record<string, number> {
    return Object.fromEntries(this.toolUsageCount.entries());
  }
} 