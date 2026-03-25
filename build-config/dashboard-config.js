/**
 * Dashboard Build Configuration
 * 
 * Defines the structure and build requirements for all BVE dashboards
 */

export const dashboardConfig = {
  /**
   * Common build settings applied to all dashboards
   */
  common: {
    // External dependencies loaded via CDN (not bundled)
    externals: [
      'react',
      'react-dom',
      'highcharts'
    ],
    
    // CDN links for external dependencies
    cdnLinks: {
      react: 'https://unpkg.com/react@18/umd/react.production.min.js',
      reactDom: 'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
      highcharts: 'https://cdn.jsdelivr.net/npm/highcharts@11.4.8/highcharts.js',
      highchartsAccessibility: 'https://cdn.jsdelivr.net/npm/highcharts@11.4.8/modules/accessibility.js',
      primerCSS: 'https://unpkg.com/@primer/css@21.3.1/dist/primer.css'
    },
    
    // Build output settings
    output: {
      format: 'iife', // Immediately Invoked Function Expression
      minify: true,
      sourcemap: false, // No sourcemaps in production single-file HTML
      inlineStyles: true,
      inlineScripts: true
    },
    
    // Dark theme colors (GitHub-aligned)
    theme: {
      mode: 'dark',
      colors: {
        primary: '#58a6ff',
        success: '#3fb950',
        warning: '#d29922',
        danger: '#f85149',
        accent: '#bc8cff'
      }
    }
  },

  /**
   * Dashboard-specific configurations
   */
  dashboards: {
    'ai-assisted-coding-efficiency': {
      path: 'BVE-dashboards-for-ai-assisted-coding/dashboard/efficiency',
      name: 'AI Assisted Coding — Efficiency Dashboard',
      entry: 'src/main.js', // Main entry point (to be created)
      template: 'src/template.html', // HTML template (to be created)
      output: 'dist/index.html',
      dataSchema: '../../data/schemas/df-ai-assisted-coding-schema.json',
      exampleData: '../../data/examples/ai-assisted-coding-example.json',
      modules: [
        'src/core/estimators.js',
        'src/core/data-processor.js',
        'src/utils/math.js'
      ]
    },
    
    'ai-assisted-coding-structural': {
      path: 'BVE-dashboards-for-ai-assisted-coding/dashboard/structural',
      name: 'AI Assisted Coding — Structural Dashboard',
      entry: 'src/main.js',
      template: 'src/template.html',
      output: 'dist/index.html',
      dataSchema: '../../data/schemas/df-structural-ai-schema.json',
      exampleData: '../../data/examples/ai-assisted-coding-example.json',
      modules: []
    },
    
    'agentic-ai-coding-efficiency': {
      path: 'BVE-dashboards-for-agentic-ai-coding/dashboard/efficiency',
      name: 'Agentic AI Coding — Efficiency Dashboard',
      entry: 'src/main.js',
      template: 'src/template.html',
      output: 'dist/index.html',
      dataSchema: '../../data/schemas/df-agentic-ai-coding-schema.json',
      exampleData: '../../data/examples/agentic-ai-coding-example.json',
      modules: []
    }
  },

  /**
   * Validation rules for dashboard structure
   */
  validation: {
    requiredFiles: [
      'package.json',
      'README.md',
      'src/',
      'tests/',
      'dist/'
    ],
    requiredScripts: [
      'test',
      'build'
    ],
    requiredTestCoverage: 80 // Minimum 80% coverage
  }
};

export default dashboardConfig;
