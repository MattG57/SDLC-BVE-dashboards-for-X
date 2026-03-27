#!/usr/bin/env node

/**
 * Data Validation CLI Tool
 * Validates JSON data files against their schemas
 * 
 * Usage:
 *   node validate-data.js <file> <type>
 *   
 * Types:
 *   - ai-assisted-efficiency: For AI-assisted coding efficiency data
 *   - agentic-ai: For agentic AI coding data  
 *   - structural-quality: For structural quality/PR review data
 *
 * Example:
 *   node validate-data.js data.json ai-assisted-efficiency
 */

import fs from 'fs';
import path from 'path';
import { validate } from './schema-validator.js';

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length < 2) {
  console.error('Usage: node validate-data.js <file> <type>');
  console.error('');
  console.error('Types:');
  console.error('  - ai-assisted-efficiency');
  console.error('  - agentic-ai');
  console.error('  - structural-quality');
  process.exit(1);
}

const [filePath, validatorType] = args;

// Check if file exists
if (!fs.existsSync(filePath)) {
  console.error(`Error: File not found: ${filePath}`);
  process.exit(1);
}

// Read and parse JSON file
let data;
try {
  const content = fs.readFileSync(filePath, 'utf8');
  data = JSON.parse(content);
} catch (error) {
  console.error(`Error reading/parsing file: ${error.message}`);
  process.exit(1);
}

// Validate data
console.log(`Validating ${path.basename(filePath)} as ${validatorType}...`);
console.log('');

try {
  const results = validate(data, validatorType);
  
  // Display results
  if (results.valid) {
    console.log('✓ Validation PASSED');
    
    if (results.warnings.length > 0) {
      console.log('');
      console.log('⚠ Warnings:');
      results.warnings.forEach(warning => {
        console.log(`  ${warning.path}: ${warning.message}`);
      });
    }
    
    process.exit(0);
  } else {
    console.log('✗ Validation FAILED');
    console.log('');
    console.log('Errors:');
    results.errors.forEach(error => {
      console.log(`  ${error.path}: ${error.message}`);
    });
    
    if (results.warnings.length > 0) {
      console.log('');
      console.log('Warnings:');
      results.warnings.forEach(warning => {
        console.log(`  ${warning.path}: ${warning.message}`);
      });
    }
    
    process.exit(1);
  }
} catch (error) {
  console.error(`Error during validation: ${error.message}`);
  process.exit(1);
}
