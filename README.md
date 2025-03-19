# DeepSearch

A TypeScript class for deep research using GenKit, Playwright, and SerpAPI. Similar to Grok3 and Gemini 2.0's deep research capabilities.

## Features

- **Web Search**: Uses SerpAPI to search Google for information
- **Web Content Extraction**: Uses Playwright to extract content from websites
- **Critical Thinking**: Uses GenKit with OpenAI's GPT-4o to analyze findings
- **Status Tracking**: Provides detailed information about the research process
- **Comprehensive Reporting**: Generates professional research reports

## Requirements

- Node.js 20.x or higher (recommended)
- Bun 1.x
- SerpAPI API key
- OpenAI API key

## Installation

1. Clone this repository
2. Install dependencies:
```bash
bun install
```

## Configuration

1. Create a `.env` file in the root directory (copy from `.env.example` if available)
2. Add your API keys to the `.env` file:
```
SERPAPI_KEY=your_serpapi_key_here
OPENAI_API_KEY=your_openai_api_key_here
```

## Usage

Run the example:

```bash
bun start
```

Run in development mode with hot-reloading:

```bash
bun dev
```

Build for production:

```bash
bun build
```

## Code Example

```typescript
import { DeepSearch } from './DeepSearch';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize DeepSearch (API keys loaded from .env file)
const deepSearch = new DeepSearch();

// Start the research process
const report = await deepSearch.research('Your research topic here');

// Get the current state of the research
const state = deepSearch.getState();
```

## Research Process

DeepSearch follows this process:

1. **Initial Search**: Performs web searches using SerpAPI
2. **Content Extraction**: Extracts relevant content from web pages using Playwright
3. **Critical Analysis**: Analyzes initial findings using AI
4. **Follow-up Research**: Identifies and researches gaps in information
5. **Deep Analysis**: Synthesizes all findings
6. **Report Generation**: Creates a comprehensive research report

## Output

The research report includes:

1. Executive Summary
2. Key Findings
3. Detailed Analysis
4. Supporting Evidence
5. Conclusions and Recommendations

## License

MIT
