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
   * Execute a ReAct (Reasoning + Acting) cycle
   */
  public async executeReActCycle(context: string): Promise<any> {
    // Step 1: Reasoning - Generate potential paths
    const paths = await this.generateReasoningPaths(context);
    
    // Step 2: Select best path
    const selectedPath = this.selectBestPath(paths);
    if (!selectedPath) {
      throw new Error('Failed to select a reasoning path');
    }
    
    this.stateManager.updateStatus('thinking', 'Tool Selection', 'Selecting appropriate tool based on reasoning');
    
    try {
      // Step 3: Select appropriate tool
      console.log('Selecting appropriate tool...');
      const toolRequest = await this.selectTool(selectedPath.content);
      if (!toolRequest) {
        throw new Error('Failed to select appropriate tool');
      }
      
      console.log(`Selected tool: ${toolRequest.name} with parameters:`, toolRequest.input);
      
      // Step 4: Acting - Execute the tool
      this.stateManager.updateStatus('acting', 'Tool Execution', `Using ${toolRequest.name}`);
      
      // Find the selected tool
      const selectedTool = this.tools.find(tool => tool.name === toolRequest.name);
      if (!selectedTool) {
        throw new Error(`Tool not found: ${toolRequest.name}`);
      }
      
      // Execute the tool
      const result = await selectedTool.handle(toolRequest.input);
      
      // Step 5: Observation - Evaluate results
      this.stateManager.updateStatus('observing', 'Result Evaluation', `Evaluating results from ${toolRequest.name}`);
      
      const observation = this.stateManager.addThought(
        'observation',
        `Results from ${toolRequest.name}: ${JSON.stringify(result, null, 2)}`,
        undefined
      );
      
      // Evaluate how useful the results were
      const score = await this.evaluateResults(result, selectedPath);
      observation.confidence = score;
      
      // Mark current reasoning path as explored
      this.stateManager.markCurrentNodeExplored(score >= 0.5);
      
      // Step 6: Decide whether to continue, backtrack, or explore new paths
      const nextAction = await this.decideNextAction(score);
      
      // Return the results and next action
      return {
        result,
        score,
        nextAction
      };
    } catch (error: unknown) {
      console.error('Error in ReAct cycle:', error);
      
      // Add error observation to state
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.stateManager.addThought(
        'observation',
        `Error during reasoning cycle: ${errorMessage}`,
        0.1
      );
      
      // Return a low score result with error information
      return {
        result: { error: errorMessage },
        score: 0.1,
        nextAction: 'explore_new'
      };
    }
  }

  /**
   * Get tool usage statistics
   */
  public getToolUsageStats(): Record<string, number> {
    return Object.fromEntries(this.toolUsageCount.entries());
  }
} 