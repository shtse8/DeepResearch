// Type definitions for DeepSearch

// Research state types
export type ResearchStatus = 'idle' | 'thinking' | 'acting' | 'observing' | 'reporting';

export type Thought = {
  id: string;
  type: 'thought' | 'action' | 'observation';
  content: string;
  timestamp: number;
  confidence?: number;
  parentId?: string;
};

export type ReasoningNode = {
  id: string;
  thought: Thought;
  children: ReasoningNode[];
  isExplored: boolean;
  confidence: number;
};

export interface ResearchState {
  status: ResearchStatus;
  currentTopic: string;
  thoughts: Thought[];
  reasoningTree?: ReasoningNode;
  currentNode?: ReasoningNode;
  collectedInfo: Map<string, any>;
  finalReport: string;
  currentStep: string;
  stepDetails: string[];
}

// Tool types
export type ToolRequest = {
  name: string;
  input: any;
};

export interface ToolInput {
  query?: string;
  url?: string;
  content?: string;
  numResults?: number;
  sources?: Array<{ name: string; content: string }>;
  data?: any;
  options?: Record<string, any>;
}

// Report types
export interface ResearchReport {
  topic: string;
  searchResults: any;
  sections: Array<{
    title: string;
    content?: string;
    subsections?: Array<{
      title: string;
      content: string;
    }>;
  }>;
  reasoningProcess?: {
    exploredPaths: Thought[];
    discardedPaths?: Thought[];
    confidenceScores?: Record<string, number>;
  };
  toolsUsed?: Array<{
    name: string;
    purpose: string;
    timesUsed: number;
  }>;
} 