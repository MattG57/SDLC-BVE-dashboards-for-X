/**
 * Processed Data Schema Validators
 * Validates internal data structures after transformation
 */

/**
 * Validate normalized daily metrics (output of flattenDayTotal)
 */
export function validateNormalizedDayTotal(record, index = 0) {
  const errors = [];
  const context = `normalizedDay[${index}]`;
  
  if (!record || typeof record !== 'object') {
    return [`${context}: expected object, got ${typeof record}`];
  }
  
  // Required date field
  if (typeof record.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(record.day)) {
    errors.push(`${context}.day: expected YYYY-MM-DD format, got "${record.day}"`);
  }
  
  // All numeric fields should be numbers (not NaN, not null)
  const numericFields = [
    'dailyActiveUsers', 'dailyActiveCliUsers', 'weeklyActiveUsers', 
    'monthlyActiveUsers', 'monthlyChatUsers', 'monthlyAgentUsers',
    'interactions', 'codeGenerations', 'codeAcceptances',
    'locSuggestedToAdd', 'locSuggestedToDelete', 'locAdded', 'locDeleted',
    'prTotalReviewed', 'prTotalCreated', 'prCreatedByCopilot', 'prReviewedByCopilot',
    'cliSessionCount', 'cliRequestCount', 'agentModeInteractions'
  ];
  
  for (const field of numericFields) {
    if (typeof record[field] !== 'number' || isNaN(record[field])) {
      errors.push(`${context}.${field}: expected number, got ${typeof record[field]} (${record[field]})`);
    }
    if (record[field] < 0) {
      errors.push(`${context}.${field}: expected non-negative, got ${record[field]}`);
    }
  }
  
  return errors;
}

/**
 * Validate normalized user record (output of flattenUserRecord)
 */
export function validateNormalizedUserRecord(record, index = 0) {
  const errors = [];
  const context = `normalizedUser[${index}]`;
  
  if (!record || typeof record !== 'object') {
    return [`${context}: expected object, got ${typeof record}`];
  }
  
  // Required fields
  if (typeof record.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(record.day)) {
    errors.push(`${context}.day: expected YYYY-MM-DD format, got "${record.day}"`);
  }
  
  if (typeof record.userLogin !== 'string' || record.userLogin.length === 0) {
    errors.push(`${context}.userLogin: expected non-empty string, got "${record.userLogin}"`);
  }
  
  const numericFields = [
    'dailyActiveUsers', 'interactions', 'codeGenerations', 
    'codeAcceptances', 'locAdded'
  ];
  
  for (const field of numericFields) {
    if (typeof record[field] !== 'number' || isNaN(record[field])) {
      errors.push(`${context}.${field}: expected number, got ${typeof record[field]}`);
    }
    if (record[field] < 0) {
      errors.push(`${context}.${field}: expected non-negative, got ${record[field]}`);
    }
  }
  
  return errors;
}

/**
 * Validate aggregated day structure (from aggregateUserRecordsByDay)
 */
export function validateAggregatedDay(record, date) {
  const errors = [];
  const context = `aggregatedDay[${date}]`;
  
  if (!record || typeof record !== 'object') {
    return [`${context}: expected object, got ${typeof record}`];
  }
  
  if (record.day !== date) {
    errors.push(`${context}.day: expected "${date}", got "${record.day}"`);
  }
  
  const numericFields = [
    'activeUsers', 'interactions', 'codeGenerations', 
    'codeAcceptances', 'locAdded'
  ];
  
  for (const field of numericFields) {
    if (typeof record[field] !== 'number' || isNaN(record[field])) {
      errors.push(`${context}.${field}: expected number, got ${typeof record[field]}`);
    }
  }
  
  if (!Array.isArray(record.users)) {
    errors.push(`${context}.users: expected array, got ${typeof record.users}`);
  }
  
  return errors;
}

/**
 * Validate agentic AI day-level record
 */
export function validateAgenticDayRecord(record, index = 0) {
  const errors = [];
  const context = `agenticDay[${index}]`;
  
  if (!record || typeof record !== 'object') {
    return [`${context}: expected object, got ${typeof record}`];
  }
  
  if (typeof record.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(record.date)) {
    errors.push(`${context}.date: expected YYYY-MM-DD format, got "${record.date}"`);
  }
  
  const numericFields = [
    'agentActiveDevs', 'humanDevsActive', 'totalAgentRequests',
    'issueAssignmentRequests', 'issuesCreated', 'prFollowupRequests',
    'sessionsStarted', 'agentPrsCreated', 'agentPrsMerged',
    'agentLocAdded', 'agentLocDeleted', 'agentSessionMinutes',
    'changesRequestedTotal', 'mergedLocAdded', 'mergedLocDeleted',
    'mergedSessionMinutes', 'turbulence'
  ];
  
  for (const field of numericFields) {
    if (typeof record[field] !== 'number' || isNaN(record[field])) {
      errors.push(`${context}.${field}: expected number, got ${typeof record[field]}`);
    }
    if (record[field] < 0) {
      errors.push(`${context}.${field}: expected non-negative, got ${record[field]}`);
    }
  }
  
  return errors;
}

/**
 * Validate file-loaded data structure
 */
export function validateFileData(data) {
  const errors = [];
  
  if (!data) {
    return {
      valid: false,
      errors: ['No data provided'],
      type: 'empty'
    };
  }
  
  if (typeof data !== 'object') {
    return {
      valid: false,
      errors: [`Expected object, got ${typeof data}`],
      type: 'invalid'
    };
  }
  
  // Check for known structures
  if (data.day_totals) {
    // Enterprise report
    if (!Array.isArray(data.day_totals)) {
      errors.push('day_totals must be an array');
    }
    return {
      valid: errors.length === 0,
      errors,
      type: 'enterprise_report',
      recordCount: Array.isArray(data.day_totals) ? data.day_totals.length : 0
    };
  }
  
  if (Array.isArray(data)) {
    // User report
    return {
      valid: data.length > 0,
      errors: data.length === 0 ? ['Empty array'] : [],
      type: 'user_report',
      recordCount: data.length
    };
  }
  
  // Agentic data structure
  if (data.developer_day_summary || data.pr_sessions || data.requests) {
    if (data.developer_day_summary && !Array.isArray(data.developer_day_summary)) {
      errors.push('developer_day_summary must be an array');
    }
    if (data.pr_sessions && !Array.isArray(data.pr_sessions)) {
      errors.push('pr_sessions must be an array');
    }
    if (data.requests && !Array.isArray(data.requests)) {
      errors.push('requests must be an array');
    }
    
    return {
      valid: errors.length === 0,
      errors,
      type: 'agentic_data',
      recordCount: {
        devDays: data.developer_day_summary?.length || 0,
        prSessions: data.pr_sessions?.length || 0,
        requests: data.requests?.length || 0
      }
    };
  }
  
  return {
    valid: false,
    errors: ['Unknown data structure - expected enterprise_report, user_report, or agentic_data'],
    type: 'unknown'
  };
}

/**
 * Validate processed dashboard data (post-processing)
 */
export function validateProcessedData(data, expectedType) {
  const errors = [];
  
  if (!data || typeof data !== 'object') {
    return {
      valid: false,
      errors: ['Processed data must be an object']
    };
  }
  
  // For efficiency dashboards
  if (expectedType === 'efficiency') {
    if (!Array.isArray(data.days)) {
      errors.push('data.days must be an array');
    } else {
      data.days.forEach((day, i) => {
        errors.push(...validateNormalizedDayTotal(day, i));
      });
    }
    
    if (data.userDays && !Array.isArray(data.userDays)) {
      errors.push('data.userDays must be an array if present');
    }
  }
  
  // For agentic dashboards
  if (expectedType === 'agentic') {
    if (!Array.isArray(data.days)) {
      errors.push('data.days must be an array');
    } else {
      data.days.forEach((day, i) => {
        errors.push(...validateAgenticDayRecord(day, i));
      });
    }
    
    if (!data.metadata || typeof data.metadata !== 'object') {
      errors.push('data.metadata must be an object');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
