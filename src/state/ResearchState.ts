import type { ResearchState, ResearchStatus, Thought, ReasoningNode } from '../types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Manages the state of a research session including thought chains and reasoning tree
 */
export class ResearchStateManager {
  private state: ResearchState;

  constructor(topic: string) {
    // Initialize with default state
    this.state = {
      status: 'idle',
      currentTopic: topic,
      thoughts: [],
      collectedInfo: new Map(),
      finalReport: '',
      currentStep: '',
      stepDetails: []
    };
    
    // Initialize reasoning tree with root node
    this.initReasoningTree(topic);
  }

  /**
   * Initialize the reasoning tree with a root thought
   */
  private initReasoningTree(topic: string): void {
    const rootThought: Thought = {
      id: uuidv4(),
      type: 'thought',
      content: `Initial research plan for topic: ${topic}`,
      timestamp: Date.now()
    };
    
    const rootNode: ReasoningNode = {
      id: rootThought.id,
      thought: rootThought,
      children: [],
      isExplored: false,
      confidence: 0.5 // Initial neutral confidence
    };
    
    this.state.reasoningTree = rootNode;
    this.state.currentNode = rootNode;
    this.state.thoughts.push(rootThought);
  }

  /**
   * Update the research status and current step
   */
  public updateStatus(status: ResearchStatus, step: string, detail?: string): void {
    this.state.status = status;
    this.state.currentStep = step;
    
    if (detail) {
      this.state.stepDetails.push(detail);
      console.log(`[${status.toUpperCase()}] ${step}: ${detail}`);
    } else {
      console.log(`[${status.toUpperCase()}] ${step}`);
    }
  }

  /**
   * Add a new thought to the research state and reasoning tree
   */
  public addThought(type: 'thought' | 'action' | 'observation', content: string, confidence?: number): Thought {
    const thought: Thought = {
      id: uuidv4(),
      type,
      content,
      timestamp: Date.now(),
      confidence,
      parentId: this.state.currentNode?.id
    };
    
    // Add to linear thought history
    this.state.thoughts.push(thought);
    
    // Add to reasoning tree if applicable
    if (this.state.currentNode) {
      const newNode: ReasoningNode = {
        id: thought.id,
        thought,
        children: [],
        isExplored: false,
        confidence: confidence || 0.5
      };
      
      this.state.currentNode.children.push(newNode);
      this.state.currentNode = newNode;
    }
    
    return thought;
  }

  /**
   * Move to a different branch in the reasoning tree (backtracking)
   */
  public navigateToNode(nodeId: string): boolean {
    const node = this.findNodeById(nodeId, this.state.reasoningTree);
    if (node) {
      this.state.currentNode = node;
      return true;
    }
    return false;
  }

  /**
   * Find a node in the reasoning tree by ID
   */
  private findNodeById(id: string, node?: ReasoningNode): ReasoningNode | undefined {
    if (!node) return undefined;
    if (node.id === id) return node;
    
    for (const child of node.children) {
      const found = this.findNodeById(id, child);
      if (found) return found;
    }
    
    return undefined;
  }

  /**
   * Store information collected during research
   */
  public storeInfo(key: string, value: any): void {
    this.state.collectedInfo.set(key, value);
  }

  /**
   * Get collected information by key
   */
  public getInfo(key: string): any {
    return this.state.collectedInfo.get(key);
  }

  /**
   * Get the current research state
   */
  public getState(): ResearchState {
    return { ...this.state };
  }

  /**
   * Mark the current node as explored
   */
  public markCurrentNodeExplored(success: boolean = true): void {
    if (this.state.currentNode) {
      this.state.currentNode.isExplored = true;
      
      // Update confidence based on exploration success
      if (success) {
        this.state.currentNode.confidence = Math.min(
          this.state.currentNode.confidence + 0.2, 
          1.0
        );
      } else {
        this.state.currentNode.confidence = Math.max(
          this.state.currentNode.confidence - 0.2, 
          0.1
        );
      }
    }
  }

  /**
   * Set the final research report
   */
  public setFinalReport(report: string): void {
    this.state.finalReport = report;
  }
} 