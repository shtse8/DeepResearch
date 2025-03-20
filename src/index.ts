import { DeepSearch } from './DeepSearch';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config();

// Check if required environment variables are set
function checkEnvironment() {
  const missingVars = [];
  
  if (!process.env.SERPAPI_KEY) {
    missingVars.push('SERPAPI_KEY');
  }
  
  if (!process.env.OPENAI_API_KEY) {
    missingVars.push('OPENAI_API_KEY');
  }
  
  if (missingVars.length > 0) {
    console.error('\nError: Missing required environment variables:');
    console.error(missingVars.join(', '));
    console.error('\nPlease add these to your .env file in the root directory.');
    console.error('Example:');
    console.error('SERPAPI_KEY=your_serpapi_key_here');
    console.error('OPENAI_API_KEY=your_openai_api_key_here\n');
    return false;
  }
  
  return true;
}

// Save research report to file
function saveReport(topic: string, report: string): string {
  // Create reports directory if it doesn't exist
  const reportsDir = path.join(process.cwd(), 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir);
  }
  
  // Create sanitized filename from topic
  const sanitizedTopic = topic.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${sanitizedTopic}_${timestamp}.md`;
  const filepath = path.join(reportsDir, filename);
  
  // Write report to file
  fs.writeFileSync(filepath, `# Research Report: ${topic}\n\n${report}`);
  
  return filepath;
}

// Run DeepSearch with command line arguments
async function runResearch() {
  try {
    console.log('\n🧠 DeepSearch - AI-Powered Research with Advanced Reasoning');
    console.log('=============================================================');
    
    // Check environment variables first
    if (!checkEnvironment()) {
      process.exit(1);
    }
    
    // Get research topic from command line args or use default
    const researchTopic = process.argv[2] || 'Impact of artificial intelligence on job market';
    
    // Display research banner
    console.log(`\n📋 Research Topic: "${researchTopic}"`);
    console.log('=============================================================');
    
    // Display diagnostics information
    console.log('\n🖥️  System Information:');
    console.log(`• Platform: ${process.platform}`);
    console.log(`• Node version: ${process.version}`);
    console.log(`• Memory usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`);
    
    // Start the research process with a clear visual separator
    console.log('\n=============================================================');
    console.log('🔍 Starting Deep Research Process');
    console.log('=============================================================\n');
    
    // Track start time
    const startTime = Date.now();
    
    // Initialize DeepSearch
    const deepSearch = new DeepSearch();
    
    // Display progress bar and state information
    let lastStatusUpdate = '';
    const statusInterval = setInterval(() => {
      const state = deepSearch.getState();
      const elapsedMinutes = ((Date.now() - startTime) / 60000).toFixed(1);
      
      // Only log if status has changed to reduce console clutter
      const currentStatus = `${state.status} - ${state.currentStep}`;
      if (currentStatus !== lastStatusUpdate) {
        console.log(`\n⏱️  [${elapsedMinutes} min] Current status: ${state.status.toUpperCase()} - ${state.currentStep}`);
        console.log(`💾 Memory usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`);
        lastStatusUpdate = currentStatus;
      }
    }, 10000); // Log every 10 seconds if status changes
    
    // Run the research
    const reportText = await deepSearch.research(researchTopic);
    
    // Clear the interval timer
    clearInterval(statusInterval);
    
    // Calculate total time
    const totalMinutes = ((Date.now() - startTime) / 60000).toFixed(1);
    
    // Display completion message with visual separator
    console.log('\n=============================================================');
    console.log(`✅ Research completed in ${totalMinutes} minutes`);
    console.log('=============================================================\n');
    
    // Display report preview with better formatting
    console.log('📊 RESEARCH REPORT PREVIEW');
    console.log('=============================================================\n');
    
    // Get the first 3 paragraphs of the report for the preview
    const previewParagraphs = reportText.split('\n\n').slice(0, 3).join('\n\n');
    console.log(previewParagraphs + '...\n');
    
    console.log('=============================================================');
    console.log('📝 Full report is saved in the reports directory');
    console.log('=============================================================\n');
    
  } catch (error) {
    console.error('\n❌ Error running research:', (error as Error).message);
    console.error('Stack trace:', (error as Error).stack);
    process.exit(1);
  }
}

// Run the research process
runResearch().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
}); 